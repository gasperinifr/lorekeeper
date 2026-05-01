import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'

const AUDIENCE_FIELDS = ['visibility', 'shared_with_user_id']
const ENTITY_CONFIG = {
  characters: {
    table: 'characters', required: ['name'],
    fields: ['name','race','class','level','description','backstory','portrait_url','is_active','visibility','shared_with_user_id','data','user_id'],
    listOrder: 'name ASC',
  },
  npcs: {
    table: 'npcs', required: ['name'],
    fields: ['name','role','race','description','personality','secrets','portrait_url','is_alive','visibility','shared_with_user_id','data'],
    listOrder: 'name ASC',
  },
  locations: {
    table: 'locations', required: ['name'],
    fields: ['name','type','description','image_url','parent_id','visibility','shared_with_user_id','data'],
    listOrder: 'name ASC', extraSelect: ',parent_id',
  },
  items: {
    table: 'items', required: ['name'],
    fields: ['name','type','rarity','description','properties','image_url','visibility','shared_with_user_id','source','source_key','data'],
    listOrder: 'name ASC',
  },
  spells: {
    table: 'spells', required: ['name'],
    fields: ['name','level','school','casting_time','range','components','duration','description','image_url','visibility','shared_with_user_id','source','source_key','data'],
    listOrder: 'level ASC,name ASC',
  },
  creatures: {
    table: 'creatures', required: ['name'],
    fields: ['name','type','cr','description','image_url','visibility','shared_with_user_id','source','source_key','data'],
    listOrder: 'name ASC',
  },
  notes: {
    table: 'notes', required: ['title'],
    fields: ['title','content','image_url','is_secret','visibility','shared_with_user_id'],
    listOrder: 'updated_at DESC',
  },
}

function isAdmin(req) {
  return req.campaignRole === 'admin'
}

function isGm(req) {
  return req.campaignPlayRole === 'gm'
}

function isEditor(req) {
  return req.campaignRole === 'editor'
}

function normalizeVisibility(value) {
  return ['public', 'private', 'gm', 'user'].includes(value) ? value : 'public'
}

function buildAudienceFilter(cfg, req, startIdx = 1, alias = '', includeSharedTarget = true) {
  if (isAdmin(req)) return { sql: '', vals: [], nextIdx: startIdx }

  const p = alias ? `${alias}.` : ''
  const vals = []
  let i = startIdx
  const rules = [`${p}visibility='public'`]
  if (isEditor(req)) rules.push(`${p}visibility='private'`)
  if (isGm(req)) rules.push(`${p}visibility IN ('gm','user')`)

  rules.push(`${p}created_by=$${i++}`)
  vals.push(req.user.id)
  if (includeSharedTarget) {
    rules.push(`${p}shared_with_user_id=$${i++}`)
    vals.push(req.user.id)
  }

  let sql = `AND (${rules.join(' OR ')})`
  if (cfg.table === 'notes' && !isGm(req)) {
    sql += ` AND (${p}is_secret=false OR ${p}created_by=$${i++})`
    vals.push(req.user.id)
  }

  return { sql, vals, nextIdx: i }
}

async function normalizeAudience(db, req, body, existing = {}) {
  const next = { ...body }
  if (next.visibility !== undefined) next.visibility = normalizeVisibility(next.visibility)
  const visibility = next.visibility ?? existing.visibility ?? 'public'

  if (visibility === 'user') {
    if (!isAdmin(req) && !isGm(req)) {
      return { error: 'Apenas admins ou mestre podem compartilhar com um usuario unico.' }
    }
    const targetId = next.shared_with_user_id ?? existing.shared_with_user_id
    if (!targetId) return { error: 'Escolha o usuario que podera ver esta criacao.' }
    const { rows } = await db.query(
      'SELECT 1 FROM campaign_members WHERE campaign_id=$1 AND user_id=$2',
      [req.params.campaignId, targetId]
    )
    if (!rows.length) return { error: 'Usuario alvo nao pertence a esta campanha.' }
    next.shared_with_user_id = targetId
  } else if (AUDIENCE_FIELDS.some(field => next[field] !== undefined)) {
    next.shared_with_user_id = null
  }

  return { body: next }
}

function buildInsert(cfg, body, campaignId, userId) {
  const cols = ['campaign_id', 'created_by']; const vals = [campaignId, userId]
  if (cfg.table === 'notes') { cols.push('author_id'); vals.push(userId) }
  for (const f of cfg.fields) { if (body[f] !== undefined) { cols.push(f); vals.push(body[f]) } }
  return { cols, vals, placeholders: vals.map((_,i) => `$${i+1}`) }
}

function buildUpdate(cfg, body) {
  const sets = []; const vals = []; let i = 1
  for (const f of cfg.fields) { if (body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(body[f]) } }
  if (sets.length) sets.push('updated_at=NOW()')
  return { sets, vals, nextIdx: i }
}

async function validateLocationParent(db, campaignId, locationId, parentId, reply) {
  if (!parentId) return true
  if (locationId && parentId === locationId) {
    reply.status(400).send({ error: 'Um local nao pode ser pai de si mesmo.' })
    return false
  }

  const { rows: parent } = await db.query(
    'SELECT id FROM locations WHERE id=$1 AND campaign_id=$2',
    [parentId, campaignId]
  )
  if (!parent.length) {
    reply.status(400).send({ error: 'Local pai invalido para esta campanha.' })
    return false
  }

  if (locationId) {
    const { rows: descendants } = await db.query(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM locations WHERE parent_id=$1 AND campaign_id=$2
         UNION ALL
         SELECT l.id FROM locations l JOIN descendants d ON l.parent_id=d.id WHERE l.campaign_id=$2
       ) SELECT id FROM descendants WHERE id=$3 LIMIT 1`,
      [locationId, campaignId, parentId]
    )
    if (descendants.length) {
      reply.status(400).send({ error: 'Um local nao pode ser movido para dentro de um sub-local dele.' })
      return false
    }
  }

  return true
}

async function canReadEntity(db, req, entityType, id) {
  const cfg = ENTITY_CONFIG[entityType]
  if (!cfg) return true
  const access = buildAudienceFilter(cfg, req, 3)
  const { rows } = await db.query(
    `SELECT id FROM ${cfg.table} WHERE id=$1 AND campaign_id=$2 ${access.sql}`,
    [id, req.params.campaignId, ...access.vals]
  )
  return rows.length > 0
}

async function filterVisibleLinks(db, req, entityType, id, links) {
  const visible = []
  for (const link of links) {
    const otherType = link.source_type === entityType && link.source_id === id ? link.target_type : link.source_type
    const otherId = link.source_type === entityType && link.source_id === id ? link.target_id : link.source_id
    if (await canReadEntity(db, req, otherType, otherId)) visible.push(link)
  }
  return visible
}

export async function entityRoutes(fastify) {
  const { db } = fastify

  for (const [entityType, cfg] of Object.entries(ENTITY_CONFIG)) {
    const base = `/campaigns/:campaignId/${entityType}`

    fastify.get(base, { preHandler: requireCampaignAccess }, async (req, reply) => {
      const access = buildAudienceFilter(cfg, req, 2)
      const { rows } = await db.query(
        `SELECT *${cfg.extraSelect??''} FROM ${cfg.table} WHERE campaign_id=$1 ${access.sql} ORDER BY ${cfg.listOrder}`,
        [req.params.campaignId, ...access.vals]
      )
      return reply.send(rows)
    })

    fastify.post(base, { preHandler: requireEditor }, async (req, reply) => {
      for (const f of cfg.required) {
        if (!req.body[f]) return reply.status(400).send({ error: `Campo obrigatorio: ${f}` })
      }
      if (cfg.table === 'locations') {
        const ok = await validateLocationParent(db, req.params.campaignId, null, req.body.parent_id, reply)
        if (!ok) return
      }
      const audience = await normalizeAudience(db, req, req.body)
      if (audience.error) return reply.status(403).send({ error: audience.error })
      const { cols, vals, placeholders } = buildInsert(cfg, audience.body, req.params.campaignId, req.user.id)
      const { rows } = await db.query(
        `INSERT INTO ${cfg.table} (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`, vals
      )
      return reply.status(201).send(rows[0])
    })

    fastify.get(`${base}/:id`, { preHandler: requireCampaignAccess }, async (req, reply) => {
      const access = buildAudienceFilter(cfg, req, 3)
      const canSeePrivateEvents = ['admin', 'editor'].includes(req.campaignRole)
      const eventVisibility = canSeePrivateEvents ? '' : "AND e.visibility='public'"
      const [e, l, t, ev] = await Promise.all([
        db.query(`SELECT * FROM ${cfg.table} WHERE id=$1 AND campaign_id=$2 ${access.sql}`, [req.params.id, req.params.campaignId, ...access.vals]),
        db.query(`SELECT * FROM entity_links WHERE campaign_id=$1 AND ((source_type=$2 AND source_id=$3) OR (target_type=$2 AND target_id=$3))`, [req.params.campaignId, entityType, req.params.id]),
        db.query(`SELECT t.id,t.name,t.color FROM tags t JOIN entity_tags et ON et.tag_id=t.id WHERE et.entity_type=$1 AND et.entity_id=$2`, [entityType, req.params.id]),
        db.query(
          `SELECT eel.*, e.title AS event_title, e.type AS event_type, e.impact AS event_impact,
                  e.date_in_world AS event_date_in_world, e.visibility AS event_visibility
           FROM event_entity_links eel
           JOIN events e ON e.id=eel.event_id
           WHERE eel.campaign_id=$1 AND eel.entity_type=$2 AND eel.entity_id=$3 ${eventVisibility}
           ORDER BY e.created_at DESC`,
          [req.params.campaignId, entityType, req.params.id]
        ),
      ])
      if (!e.rows.length) return reply.status(404).send({ error: 'Entidade nao encontrada.' })
      const links = await filterVisibleLinks(db, req, entityType, req.params.id, l.rows)
      return reply.send({ ...e.rows[0], links, event_links: ev.rows, tags: t.rows, _role: req.campaignRole, _play_role: req.campaignPlayRole })
    })

    fastify.patch(`${base}/:id`, { preHandler: requireEditor }, async (req, reply) => {
      const access = buildAudienceFilter(cfg, req, 3, '', false)
      const { rows: existing } = await db.query(
        `SELECT * FROM ${cfg.table} WHERE id=$1 AND campaign_id=$2 ${access.sql}`,
        [req.params.id, req.params.campaignId, ...access.vals]
      )
      if (!existing.length) return reply.status(404).send({ error: 'Entidade nao encontrada.' })

      if (cfg.table === 'locations' && req.body.parent_id) {
        const ok = await validateLocationParent(db, req.params.campaignId, req.params.id, req.body.parent_id, reply)
        if (!ok) return
      }
      const audience = await normalizeAudience(db, req, req.body, existing[0])
      if (audience.error) return reply.status(403).send({ error: audience.error })
      const { sets, vals, nextIdx } = buildUpdate(cfg, audience.body)
      if (!sets.length) return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })
      vals.push(req.params.id, req.params.campaignId)
      const { rows } = await db.query(
        `UPDATE ${cfg.table} SET ${sets.join(',')} WHERE id=$${nextIdx} AND campaign_id=$${nextIdx+1} RETURNING *`, vals
      )
      return reply.send(rows[0])
    })

    fastify.delete(`${base}/:id`, { preHandler: requireEditor }, async (req, reply) => {
      const access = buildAudienceFilter(cfg, req, 3, '', false)
      const vals = [req.params.id, req.params.campaignId, ...access.vals]
      const { rowCount } = await db.query(
        `DELETE FROM ${cfg.table} WHERE id=$1 AND campaign_id=$2 ${access.sql}`,
        vals
      )
      if (!rowCount) return reply.status(404).send({ error: 'Entidade nao encontrada.' })
      return reply.status(204).send()
    })
  }

  fastify.get('/campaigns/:campaignId/locations/tree', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const cfg = ENTITY_CONFIG.locations
    const access = buildAudienceFilter(cfg, req, 2)
    const { rows } = await db.query(
      `WITH RECURSIVE loc_tree AS (
         SELECT *,0 AS depth FROM locations WHERE campaign_id=$1 AND parent_id IS NULL ${access.sql}
         UNION ALL
         SELECT l.*,lt.depth+1 FROM locations l JOIN loc_tree lt ON l.parent_id=lt.id
         WHERE l.campaign_id=$1 ${access.sql.replaceAll('visibility', 'l.visibility').replaceAll('created_by', 'l.created_by').replaceAll('shared_with_user_id', 'l.shared_with_user_id').replaceAll('is_secret', 'l.is_secret')}
       ) SELECT * FROM loc_tree ORDER BY depth,name`,
      [req.params.campaignId, ...access.vals]
    )
    const map = {}; const roots = []
    for (const row of rows) map[row.id] = { ...row, children: [] }
    for (const row of rows) {
      if (row.parent_id && map[row.parent_id]) map[row.parent_id].children.push(map[row.id])
      else roots.push(map[row.id])
    }
    return reply.send(roots)
  })
}
