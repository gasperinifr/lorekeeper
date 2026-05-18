import { authenticate, requireCampaignAccess, requireEditor, invalidateCampaignAllUsers, invalidateUserCampaignList } from '../middleware/authenticate.js'
import { cache, cacheKey, TTL } from '../lib/cache.js'
import crypto from 'node:crypto'

function createInviteCode() {
  const part = () => crypto.randomBytes(3).toString('base64url').slice(0, 4).toUpperCase()
  return `LK-${part()}-${part()}`
}

async function createUniqueInviteCode(db) {
  for (let i = 0; i < 5; i++) {
    const code = createInviteCode()
    const { rows } = await db.query('SELECT id FROM campaign_invites WHERE code=$1', [code])
    if (!rows.length) return code
  }
  throw new Error('Não foi possível gerar um código de convite.')
}

function assertRole(role) {
  return ['viewer', 'editor', 'admin'].includes(role) ? role : 'viewer'
}

function assertPlayRole(playRole) {
  return ['player', 'gm'].includes(playRole) ? playRole : 'player'
}

function canAssignRole(req, role, playRole) {
  return (role !== 'admin' && playRole !== 'gm') || req.campaignRole === 'admin'
}

function requireAdminRole(req, reply) {
  if (req.campaignRole !== 'admin') {
    reply.status(403).send({ error: 'Apenas administradores podem acessar as configurações da campanha.' })
    return false
  }
  return true
}

export async function campaignRoutes(fastify) {
  const { db } = fastify

  fastify.get('/', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.user.id
    const key = cacheKey.campaignList(userId)

    const rows = await cache.getOrSet(key, TTL.CAMPAIGN_LIST, async () => {
      const { rows } = await db.query(
        `SELECT c.*, cm.role, cm.play_role,
          (SELECT COUNT(*) FROM campaign_members WHERE campaign_id=c.id) AS member_count
         FROM campaigns c
         JOIN campaign_members cm ON cm.campaign_id=c.id AND cm.user_id=$1
         ORDER BY c.updated_at DESC`,
        [userId]
      )
      return rows
    })
    return reply.send(rows)
  })

  fastify.post('/', { preHandler: authenticate }, async (req, reply) => {
    const { title, description, scenario_type, visibility, started_at, estimated_end_at } = req.body
    if (!title) return reply.status(400).send({ error: 'title é obrigatório.' })
    const { rows } = await db.query(
      `INSERT INTO campaigns (owner_id,title,description,scenario_type,visibility,started_at,estimated_end_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, title, description, scenario_type, visibility ?? 'private', started_at, estimated_end_at]
    )
    await db.query(
      `INSERT INTO campaign_members (campaign_id,user_id,role,play_role) VALUES ($1,$2,'admin','gm')`,
      [rows[0].id, req.user.id]
    )
    await invalidateUserCampaignList(req.user.id)
    return reply.status(201).send(rows[0])
  })

  fastify.post('/join', { preHandler: authenticate }, async (req, reply) => {
    const code = String(req.body.code ?? '').trim().toUpperCase()
    if (!code) return reply.status(400).send({ error: 'Código obrigatório.' })

    const { rows: invites } = await db.query(
      `SELECT ci.*,c.title
       FROM campaign_invites ci
       JOIN campaigns c ON c.id=ci.campaign_id
       WHERE ci.code=$1 AND ci.used_at IS NULL AND ci.expires_at > NOW()`,
      [code]
    )
    if (!invites.length) return reply.status(404).send({ error: 'Convite inválido ou expirado.' })

    const invite = invites[0]
    const { rows: users } = await db.query('SELECT email FROM users WHERE id=$1', [req.user.id])
    if (invite.invited_email && users[0]?.email?.toLowerCase() !== invite.invited_email.toLowerCase()) {
      return reply.status(403).send({ error: 'Este convite foi gerado para outro email.' })
    }

    await db.query(
      `INSERT INTO campaign_members (campaign_id,user_id,role,play_role) VALUES ($1,$2,$3,$4)
       ON CONFLICT (campaign_id,user_id) DO UPDATE SET role=EXCLUDED.role,play_role=EXCLUDED.play_role`,
      [invite.campaign_id, req.user.id, invite.role, invite.play_role ?? 'player']
    )
    await db.query('UPDATE campaign_invites SET used_at=NOW(),used_by=$1 WHERE id=$2', [req.user.id, invite.id])

    await Promise.all([
      invalidateUserCampaignList(req.user.id),
      cache.del(cacheKey.campaignAccess(invite.campaign_id, req.user.id)),
    ])

    return reply.status(201).send({
      campaign_id: invite.campaign_id,
      title: invite.title,
      role: invite.role,
      play_role: invite.play_role ?? 'player',
    })
  })

  fastify.get('/:campaignId', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId } = req.params
    const userId = req.user.id
    const key = cacheKey.campaignDetail(campaignId, userId)

    const campaign = await cache.getOrSet(key, TTL.CAMPAIGN_DETAIL, async () => {
      const { rows } = await db.query(
        `SELECT c.*, cm_current.role, cm_current.play_role,
          (SELECT json_agg(json_build_object('id',u.id,'username',u.username,'role',cm.role,'play_role',cm.play_role))
           FROM campaign_members cm JOIN users u ON u.id=cm.user_id
           WHERE cm.campaign_id=c.id) AS members
         FROM campaigns c
         JOIN campaign_members cm_current ON cm_current.campaign_id=c.id AND cm_current.user_id=$2
         WHERE c.id=$1`,
        [campaignId, userId]
      )
      return rows[0] ?? null
    })
    if (!campaign) return reply.status(404).send({ error: 'Campanha não encontrada.' })
    return reply.send(campaign)
  })

  fastify.patch('/:campaignId', { preHandler: requireEditor }, async (req, reply) => {
    if (!requireAdminRole(req, reply)) return
    const fields = ['title','description','scenario_type','status','visibility','cover_image_url','hub_banner_url','hub_banner_fit','hub_banner_position','started_at','estimated_end_at']
    const updates = []; const vals = []; let i = 1
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]) }
    }
    if (!updates.length) return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })
    updates.push('updated_at=NOW()')
    vals.push(req.params.campaignId)
    const { rows } = await db.query(`UPDATE campaigns SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals)

    await invalidateCampaignAllUsers(req.params.campaignId)
    return reply.send(rows[0])
  })

  fastify.delete('/:campaignId', { preHandler: requireEditor }, async (req, reply) => {
    if (req.campaignRole !== 'admin') return reply.status(403).send({ error: 'Apenas admins podem excluir.' })
    await db.query('DELETE FROM campaigns WHERE id=$1', [req.params.campaignId])
    await invalidateCampaignAllUsers(req.params.campaignId)
    return reply.status(204).send()
  })

  fastify.post('/:campaignId/members', { preHandler: requireEditor }, async (req, reply) => {
    if (!requireAdminRole(req, reply)) return
    const { email, role, play_role } = req.body
    const memberRole = assertRole(role)
    const memberPlayRole = assertPlayRole(play_role)
    if (!canAssignRole(req, memberRole, memberPlayRole)) {
      return reply.status(403).send({ error: 'Apenas admins podem atribuir Admin ou Mestre.' })
    }
    const { rows: u } = await db.query('SELECT id FROM users WHERE email=$1', [email])
    if (!u.length) return reply.status(404).send({ error: 'Usuário não encontrado.' })
    const { rows } = await db.query(
      `INSERT INTO campaign_members (campaign_id,user_id,role,play_role) VALUES ($1,$2,$3,$4)
       ON CONFLICT (campaign_id,user_id) DO UPDATE SET role=$3,play_role=$4 RETURNING *`,
      [req.params.campaignId, u[0].id, memberRole, memberPlayRole]
    )
    await Promise.all([
      cache.del(cacheKey.campaignAccess(req.params.campaignId, u[0].id)),
      cache.del(cacheKey.campaignList(u[0].id)),
      invalidateCampaignAllUsers(req.params.campaignId),
    ])
    return reply.status(201).send(rows[0])
  })

  fastify.patch('/:campaignId/members/:memberId', { preHandler: requireEditor }, async (req, reply) => {
    if (req.campaignRole !== 'admin') {
      return reply.status(403).send({ error: 'Apenas admins podem alterar cargos de membros.' })
    }
    const role = req.body.role === undefined ? undefined : assertRole(req.body.role)
    const playRole = req.body.play_role === undefined ? undefined : assertPlayRole(req.body.play_role)
    const updates = []; const vals = []; let i = 1
    if (role !== undefined) { updates.push(`role=$${i++}`); vals.push(role) }
    if (playRole !== undefined) { updates.push(`play_role=$${i++}`); vals.push(playRole) }
    if (!updates.length) return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })
    vals.push(req.params.campaignId, req.params.memberId)
    const { rows } = await db.query(
      `UPDATE campaign_members SET ${updates.join(',')}
       WHERE campaign_id=$${i} AND user_id=$${i + 1}
       RETURNING id,campaign_id,user_id,role,play_role`,
      vals
    )
    if (!rows.length) return reply.status(404).send({ error: 'Membro não encontrado.' })

    await cache.del(cacheKey.campaignAccess(req.params.campaignId, req.params.memberId))
    await invalidateCampaignAllUsers(req.params.campaignId)
    return reply.send(rows[0])
  })

  fastify.post('/:campaignId/invites', { preHandler: requireEditor }, async (req, reply) => {
    if (!requireAdminRole(req, reply)) return
    const { email, role, play_role } = req.body
    const inviteRole = assertRole(role)
    const invitePlayRole = assertPlayRole(play_role)
    if (!canAssignRole(req, inviteRole, invitePlayRole)) {
      return reply.status(403).send({ error: 'Apenas admins podem convidar Admin ou Mestre.' })
    }
    const code = await createUniqueInviteCode(db)
    const { rows } = await db.query(
      `INSERT INTO campaign_invites (campaign_id,created_by,invited_email,role,play_role,code)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,campaign_id,invited_email,role,play_role,code,expires_at,created_at`,
      [req.params.campaignId, req.user.id, email || null, inviteRole, invitePlayRole, code]
    )
    return reply.status(201).send(rows[0])
  })
}
