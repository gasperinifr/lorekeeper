import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'
import { filterVisibleEventEntityLinks } from '../lib/audience.js'

const VALID_TYPES = [
  'batalha', 'revelacao', 'morte', 'alianca', 'descoberta',
  'traicao', 'destruicao', 'evento_magico', 'politico', 'outro',
]
const VALID_IMPACTS = ['menor', 'significativo', 'divisor']
const VALID_ENTITY_TYPES = [
  'characters', 'npcs', 'locations', 'items',
  'spells', 'creatures', 'notes', 'groups', 'arcs', 'sessions',
]

export async function eventRoutes(fastify) {
  const { db } = fastify

  fastify.get('/campaigns/:campaignId/events', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId } = req.params
    const isEditor = ['admin', 'editor'].includes(req.campaignRole)
    const visFilter = isEditor ? '' : "AND e.visibility='public'"
    const relatedFilter = isEditor ? '' : "AND visibility='public'"

    const { rows: events } = await db.query(
      `SELECT e.*,
              s.title AS session_title,
              a.title AS arc_title,
              u.username AS created_by_username
       FROM events e
       LEFT JOIN sessions s ON s.id = e.session_id ${relatedFilter.replace('visibility', 's.visibility')}
       LEFT JOIN arcs a ON a.id = e.arc_id ${relatedFilter.replace('visibility', 'a.visibility')}
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.campaign_id=$1 ${visFilter}
       ORDER BY e.created_at DESC`,
      [campaignId]
    )

    if (!events.length) return reply.send([])

    const eventIds = events.map(e => e.id)
    const { rows: links } = await db.query(
      'SELECT * FROM event_entity_links WHERE event_id = ANY($1)',
      [eventIds]
    )

    const visibleLinks = await filterVisibleEventEntityLinks(db, req, links)
    const linksByEvent = {}
    for (const l of visibleLinks) {
      if (!linksByEvent[l.event_id]) linksByEvent[l.event_id] = []
      linksByEvent[l.event_id].push(l)
    }

    return reply.send(events.map(e => ({ ...e, entity_links: linksByEvent[e.id] ?? [] })))
  })

  fastify.get('/campaigns/:campaignId/events/:eventId', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId, eventId } = req.params
    const isEditor = ['admin', 'editor'].includes(req.campaignRole)
    const visFilter = isEditor ? '' : "AND e.visibility='public'"
    const relatedFilter = isEditor ? '' : "AND visibility='public'"

    const { rows } = await db.query(
      `SELECT e.*, s.title AS session_title, a.title AS arc_title
       FROM events e
       LEFT JOIN sessions s ON s.id = e.session_id ${relatedFilter.replace('visibility', 's.visibility')}
       LEFT JOIN arcs a ON a.id = e.arc_id ${relatedFilter.replace('visibility', 'a.visibility')}
       WHERE e.id=$1 AND e.campaign_id=$2 ${visFilter}`,
      [eventId, campaignId]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Evento não encontrado.' })

    const { rows: links } = await db.query(
      'SELECT * FROM event_entity_links WHERE event_id=$1',
      [eventId]
    )

    return reply.send({ ...rows[0], entity_links: await filterVisibleEventEntityLinks(db, req, links) })
  })

  fastify.post('/campaigns/:campaignId/events', { preHandler: requireEditor }, async (req, reply) => {
    const { campaignId } = req.params
    const {
      title, type, impact, date_in_world, description, data,
      visibility, session_id, arc_id, entity_links,
    } = req.body

    if (!title) return reply.status(400).send({ error: 'title é obrigatório.' })

    const safeType = VALID_TYPES.includes(type) ? type : 'outro'
    const safeImpact = VALID_IMPACTS.includes(impact) ? impact : 'significativo'
    const safeVis = ['public', 'private'].includes(visibility) ? visibility : 'public'

    const { rows } = await db.query(
      `INSERT INTO events
         (campaign_id, session_id, arc_id, created_by, title, type, impact, date_in_world, description, visibility, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        campaignId, session_id ?? null, arc_id ?? null, req.user.id,
        title, safeType, safeImpact, date_in_world ?? null, description ?? null, safeVis, JSON.stringify(data ?? {}),
      ]
    )
    const event = rows[0]

    if (Array.isArray(entity_links) && entity_links.length) {
      for (const l of entity_links) {
        if (!VALID_ENTITY_TYPES.includes(l.entity_type) || !l.entity_id) continue
        await db.query(
          `INSERT INTO event_entity_links (event_id, campaign_id, entity_type, entity_id, role)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT DO NOTHING`,
          [event.id, campaignId, l.entity_type, l.entity_id, l.role ?? null]
        )
      }
    }

    const { rows: links } = await db.query(
      'SELECT * FROM event_entity_links WHERE event_id=$1',
      [event.id]
    )
    return reply.status(201).send({ ...event, entity_links: links })
  })

  fastify.patch('/campaigns/:campaignId/events/:eventId', { preHandler: requireEditor }, async (req, reply) => {
    const { campaignId, eventId } = req.params
    const allowed = ['title', 'type', 'impact', 'date_in_world', 'description', 'visibility', 'session_id', 'arc_id', 'data']
    const updates = {}
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k]
    }

    if (!Object.keys(updates).length) return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })

    const keys = Object.keys(updates)
    const vals = keys.map(k => k === 'data' ? JSON.stringify(updates[k] ?? {}) : updates[k])
    const set = keys.map((k, i) => `${k}=$${i + 1}`).join(', ')

    const { rows } = await db.query(
      `UPDATE events SET ${set}, updated_at=NOW() WHERE id=$${keys.length + 1} AND campaign_id=$${keys.length + 2} RETURNING *`,
      [...vals, eventId, campaignId]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Evento não encontrado.' })
    return reply.send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/events/:eventId', { preHandler: requireEditor }, async (req, reply) => {
    const { rowCount } = await db.query(
      'DELETE FROM events WHERE id=$1 AND campaign_id=$2',
      [req.params.eventId, req.params.campaignId]
    )
    if (!rowCount) return reply.status(404).send({ error: 'Evento não encontrado.' })
    return reply.status(204).send()
  })

  fastify.post('/campaigns/:campaignId/events/:eventId/links', { preHandler: requireEditor }, async (req, reply) => {
    const { eventId, campaignId } = req.params
    const { entity_type, entity_id, role } = req.body
    if (!VALID_ENTITY_TYPES.includes(entity_type) || !entity_id) {
      return reply.status(400).send({ error: 'entity_type ou entity_id inválido.' })
    }
    const { rows } = await db.query(
      `INSERT INTO event_entity_links (event_id, campaign_id, entity_type, entity_id, role)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (event_id, entity_type, entity_id) DO UPDATE SET role=EXCLUDED.role
       RETURNING *`,
      [eventId, campaignId, entity_type, entity_id, role ?? null]
    )
    return reply.status(201).send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/events/:eventId/links/:linkId', { preHandler: requireEditor }, async (req, reply) => {
    const { rowCount } = await db.query(
      'DELETE FROM event_entity_links WHERE id=$1 AND event_id=$2',
      [req.params.linkId, req.params.eventId]
    )
    if (!rowCount) return reply.status(404).send({ error: 'Link não encontrado.' })
    return reply.status(204).send()
  })

  fastify.post('/campaigns/:campaignId/events/:eventId/propagate', { preHandler: requireEditor }, async (req, reply) => {
    const { campaignId, eventId } = req.params
    const { consequences } = req.body

    if (!Array.isArray(consequences) || !consequences.length) {
      return reply.status(400).send({ error: 'consequences deve ser um array não vazio.' })
    }

    const TABLE_MAP = {
      characters: 'characters',
      npcs: 'npcs',
      locations: 'locations',
      items: 'items',
      spells: 'spells',
      creatures: 'creatures',
      notes: 'notes',
    }

    const ALLOWED_FIELDS = {
      npcs: ['is_alive', 'role', 'description'],
      characters: ['is_active', 'description'],
      locations: ['type', 'description'],
      items: ['description', 'properties'],
    }

    const applied = []
    for (const c of consequences) {
      const table = TABLE_MAP[c.entity_type]
      const allowed = ALLOWED_FIELDS[c.entity_type]
      if (!table || !allowed || !allowed.includes(c.field)) continue

      await db.query(
        `UPDATE ${table} SET ${c.field}=$1, updated_at=NOW() WHERE id=$2 AND campaign_id=$3`,
        [c.value, c.entity_id, campaignId]
      )
      applied.push(c)
    }

    await db.query(
      'UPDATE events SET data = data || $1::jsonb, updated_at=NOW() WHERE id=$2',
      [JSON.stringify({ propagated_at: new Date().toISOString(), applied }), eventId]
    )

    return reply.send({ applied })
  })
}
