import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'
import {
  buildAudienceFilter,
  canViewDm,
  filterVisibleLinks,
  protectPrivateWrite,
  sanitizeEntityRow,
  sanitizeEntityRows,
} from '../lib/audience.js'

const GROUP_FIELDS = ['name','type','description','headquarters','motto','secrets','image_url','is_active','visibility','shared_with_user_id','data']

function normalizeVisibility(value) {
  return ['public', 'private', 'gm', 'user'].includes(value) ? value : 'public'
}

async function normalizeAudience(db, req, body, existing = {}) {
  const next = { ...body }
  if (next.visibility !== undefined) next.visibility = normalizeVisibility(next.visibility)
  const visibility = next.visibility ?? existing.visibility ?? 'public'

  if (visibility === 'user') {
    if (!canViewDm(req)) return { error: 'Apenas administradores ou mestre podem compartilhar com um usuario unico.' }
    const targetId = next.shared_with_user_id ?? existing.shared_with_user_id
    if (!targetId) return { error: 'Escolha o usuario que podera ver este grupo.' }
    const { rows } = await db.query(
      'SELECT 1 FROM campaign_members WHERE campaign_id=$1 AND user_id=$2',
      [req.params.campaignId, targetId]
    )
    if (!rows.length) return { error: 'Usuario alvo nao pertence a esta campanha.' }
    next.shared_with_user_id = targetId
  } else if (next.visibility !== undefined || next.shared_with_user_id !== undefined) {
    next.shared_with_user_id = null
  }

  return { body: next }
}

function memberSelectWhere(canSeeSecrets, clause = 'gm.group_id = ANY($1)') {
  return `SELECT
     gm.*,
     n.name AS npc_name, n.role AS npc_role, n.portrait_url AS npc_portrait, n.is_alive AS npc_is_alive,
     c.name AS char_name, c.class AS char_class, c.portrait_url AS char_portrait
   FROM group_members gm
   LEFT JOIN npcs n ON n.id = gm.npc_id
   LEFT JOIN characters c ON c.id = gm.character_id
   WHERE ${clause}
     ${canSeeSecrets ? '' : 'AND gm.is_secret = false'}
   ORDER BY COALESCE(n.name, c.name) ASC`
}

export async function groupRoutes(fastify) {
  const { db } = fastify

  fastify.get('/campaigns/:campaignId/groups', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId } = req.params
    const audience = buildAudienceFilter('groups', req, 2)

    const { rows: groups } = await db.query(
      `SELECT g.*, u.username AS created_by_username
       FROM groups g
       LEFT JOIN users u ON u.id = g.created_by
       WHERE g.campaign_id=$1 ${audience.sql}
       ORDER BY g.name ASC`,
      [campaignId, ...audience.vals]
    )

    if (!groups.length) return reply.send([])

    const groupIds = groups.map(g => g.id)
    const canSeeSecrets = canViewDm(req)
    const { rows: members } = await db.query(memberSelectWhere(canSeeSecrets), [groupIds])
    const membersByGroup = {}
    for (const member of members) {
      if (!membersByGroup[member.group_id]) membersByGroup[member.group_id] = []
      membersByGroup[member.group_id].push(member)
    }

    return reply.send(
      sanitizeEntityRows(groups, req, 'groups').map(group => ({
        ...group,
        secrets: canSeeSecrets ? group.secrets : undefined,
        members: membersByGroup[group.id] ?? [],
        _role: req.campaignRole,
        _play_role: req.campaignPlayRole,
        _can_view_dm: canSeeSecrets,
      }))
    )
  })

  fastify.get('/campaigns/:campaignId/groups/:groupId', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId, groupId } = req.params
    const audience = buildAudienceFilter('groups', req, 3)

    const { rows } = await db.query(
      `SELECT g.*, u.username AS created_by_username
       FROM groups g
       LEFT JOIN users u ON u.id = g.created_by
       WHERE g.id=$1 AND g.campaign_id=$2 ${audience.sql}`,
      [groupId, campaignId, ...audience.vals]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Grupo nao encontrado.' })

    const canSeeSecrets = canViewDm(req)
    const group = sanitizeEntityRow(rows[0], req, 'groups')
    const { rows: members } = await db.query(memberSelectWhere(canSeeSecrets, 'gm.group_id=$1'), [groupId])
    const { rows: rawLinks } = await db.query(
      `SELECT * FROM entity_links
       WHERE campaign_id=$1 AND (
         (source_type='groups' AND source_id=$2) OR
         (target_type='groups' AND target_id=$2)
       )`,
      [campaignId, groupId]
    )
    const links = await filterVisibleLinks(db, req, rawLinks)

    return reply.send({
      ...group,
      secrets: canSeeSecrets ? rows[0].secrets : undefined,
      members,
      links,
      _role: req.campaignRole,
      _play_role: req.campaignPlayRole,
      _can_view_dm: canSeeSecrets,
    })
  })

  fastify.post('/campaigns/:campaignId/groups', { preHandler: requireEditor }, async (req, reply) => {
    const { campaignId } = req.params
    if (!req.body.name) return reply.status(400).send({ error: 'name e obrigatorio.' })

    const audience = await normalizeAudience(db, req, req.body)
    if (audience.error) return reply.status(403).send({ error: audience.error })
    const safeBody = protectPrivateWrite(audience.body, req)

    const cols = ['campaign_id', 'created_by']
    const vals = [campaignId, req.user.id]
    for (const field of GROUP_FIELDS) {
      if (safeBody[field] !== undefined) {
        cols.push(field)
        vals.push(field === 'visibility' ? normalizeVisibility(safeBody[field]) : safeBody[field])
      }
    }
    const placeholders = vals.map((_, index) => `$${index + 1}`)
    const { rows } = await db.query(
      `INSERT INTO groups (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
      vals
    )
    return reply.status(201).send({
      ...sanitizeEntityRow(rows[0], req, 'groups'),
      members: [],
      links: [],
      _role: req.campaignRole,
      _play_role: req.campaignPlayRole,
      _can_view_dm: canViewDm(req),
    })
  })

  fastify.patch('/campaigns/:campaignId/groups/:groupId', { preHandler: requireEditor }, async (req, reply) => {
    const { campaignId, groupId } = req.params
    const audience = buildAudienceFilter('groups', req, 3, '', false)
    const { rows: existing } = await db.query(
      `SELECT * FROM groups WHERE id=$1 AND campaign_id=$2 ${audience.sql}`,
      [groupId, campaignId, ...audience.vals]
    )
    if (!existing.length) return reply.status(404).send({ error: 'Grupo nao encontrado.' })

    const normalized = await normalizeAudience(db, req, req.body, existing[0])
    if (normalized.error) return reply.status(403).send({ error: normalized.error })
    const safeBody = protectPrivateWrite(normalized.body, req, existing[0])
    const updates = {}
    for (const field of GROUP_FIELDS) {
      if (safeBody[field] !== undefined) updates[field] = field === 'visibility' ? normalizeVisibility(safeBody[field]) : safeBody[field]
    }
    const keys = Object.keys(updates)
    if (!keys.length) return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })

    const vals = Object.values(updates)
    const set = keys.map((key, index) => `${key}=$${index + 1}`).join(', ')
    const { rows } = await db.query(
      `UPDATE groups SET ${set}, updated_at=NOW()
       WHERE id=$${keys.length + 1} AND campaign_id=$${keys.length + 2}
       RETURNING *`,
      [...vals, groupId, campaignId]
    )
    return reply.send(sanitizeEntityRow({ ...rows[0], _role: req.campaignRole }, req, 'groups'))
  })

  fastify.delete('/campaigns/:campaignId/groups/:groupId', { preHandler: requireEditor }, async (req, reply) => {
    const audience = buildAudienceFilter('groups', req, 3, '', false)
    const { rowCount } = await db.query(
      `DELETE FROM groups WHERE id=$1 AND campaign_id=$2 ${audience.sql}`,
      [req.params.groupId, req.params.campaignId, ...audience.vals]
    )
    if (!rowCount) return reply.status(404).send({ error: 'Grupo nao encontrado.' })
    return reply.status(204).send()
  })

  fastify.post('/campaigns/:campaignId/groups/:groupId/members', { preHandler: requireEditor }, async (req, reply) => {
    const { campaignId, groupId } = req.params
    const { npc_id, character_id, role, is_secret } = req.body

    if (!npc_id && !character_id) return reply.status(400).send({ error: 'Informe npc_id ou character_id.' })
    if (npc_id && character_id) return reply.status(400).send({ error: 'Informe apenas npc_id ou character_id.' })

    const { rows: groups } = await db.query('SELECT id FROM groups WHERE id=$1 AND campaign_id=$2', [groupId, campaignId])
    if (!groups.length) return reply.status(404).send({ error: 'Grupo nao encontrado.' })

    if (npc_id) {
      const { rows } = await db.query('SELECT id FROM npcs WHERE id=$1 AND campaign_id=$2', [npc_id, campaignId])
      if (!rows.length) return reply.status(400).send({ error: 'NPC invalido para esta campanha.' })
    }
    if (character_id) {
      const { rows } = await db.query('SELECT id FROM characters WHERE id=$1 AND campaign_id=$2', [character_id, campaignId])
      if (!rows.length) return reply.status(400).send({ error: 'Personagem invalido para esta campanha.' })
    }

    const conflictClause = npc_id
      ? 'ON CONFLICT (group_id, npc_id) WHERE npc_id IS NOT NULL DO UPDATE SET role=EXCLUDED.role, is_secret=EXCLUDED.is_secret'
      : 'ON CONFLICT (group_id, character_id) WHERE character_id IS NOT NULL DO UPDATE SET role=EXCLUDED.role, is_secret=EXCLUDED.is_secret'

    const { rows } = await db.query(
      `INSERT INTO group_members (group_id, campaign_id, npc_id, character_id, role, is_secret)
       VALUES ($1,$2,$3,$4,$5,$6)
       ${conflictClause}
       RETURNING *`,
      [groupId, campaignId, npc_id ?? null, character_id ?? null, role ?? null, is_secret ?? false]
    )
    return reply.status(201).send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/groups/:groupId/members/:memberId', { preHandler: requireEditor }, async (req, reply) => {
    const { rowCount } = await db.query(
      'DELETE FROM group_members WHERE id=$1 AND group_id=$2 AND campaign_id=$3',
      [req.params.memberId, req.params.groupId, req.params.campaignId]
    )
    if (!rowCount) return reply.status(404).send({ error: 'Membro nao encontrado.' })
    return reply.status(204).send()
  })
}
