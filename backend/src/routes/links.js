import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'
import { filterVisibleLinks } from '../lib/audience.js'

const VALID = ['characters','npcs','locations','items','spells','creatures','notes','sessions','arcs','encounters','events','groups']
const RELATION_TYPES = ['alianca','rivalidade','familia','lealdade','segredo','divida','amor','odio','mentor','neutro','outro']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LINK_TABLES = {
  characters: 'characters',
  npcs: 'npcs',
  locations: 'locations',
  items: 'items',
  spells: 'spells',
  creatures: 'creatures',
  notes: 'notes',
  sessions: 'sessions',
  arcs: 'arcs',
  encounters: 'encounters',
  events: 'events',
  groups: 'groups',
}

function normalizeLinkBody(body) {
  return {
    relation_type: RELATION_TYPES.includes(body.relation_type) ? body.relation_type : 'outro',
    relation_label: body.relation_label ? String(body.relation_label).slice(0, 100) : null,
  }
}

export async function linkRoutes(fastify) {
  const { db } = fastify

  async function entityExists(type, id, campaignId) {
    const table = LINK_TABLES[type]
    if (!table || !UUID_RE.test(String(id))) return false
    const { rowCount } = await db.query(
      `SELECT 1 FROM ${table} WHERE id=$1 AND campaign_id=$2 LIMIT 1`,
      [id, campaignId]
    )
    return rowCount > 0
  }

  fastify.get('/campaigns/:campaignId/links', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { rows } = await db.query('SELECT * FROM entity_links WHERE campaign_id=$1 ORDER BY created_at DESC', [req.params.campaignId])
    return reply.send(await filterVisibleLinks(db, req, rows))
  })

  fastify.post('/campaigns/:campaignId/links', { preHandler: requireEditor }, async (req, reply) => {
    const { source_type, source_id, target_type, target_id } = req.body
    const { relation_type, relation_label } = normalizeLinkBody(req.body)
    for (const t of [source_type, target_type]) {
      if (!VALID.includes(t)) return reply.status(400).send({ error: `Tipo inválido: ${t}` })
    }
    const [sourceExists, targetExists] = await Promise.all([
      entityExists(source_type, source_id, req.params.campaignId),
      entityExists(target_type, target_id, req.params.campaignId),
    ])
    if (!sourceExists) return reply.status(404).send({ error: 'Origem da conexao nao encontrada.' })
    if (!targetExists) return reply.status(404).send({ error: 'Destino da conexao nao encontrado.' })

    const { rows } = await db.query(
      `INSERT INTO entity_links (campaign_id,source_type,source_id,target_type,target_id,relation_label,relation_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (source_type,source_id,target_type,target_id) DO UPDATE SET
         relation_label=EXCLUDED.relation_label,
         relation_type=EXCLUDED.relation_type
       RETURNING *`,
      [req.params.campaignId, source_type, source_id, target_type, target_id, relation_label, relation_type]
    )
    return reply.status(201).send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/links/:id', { preHandler: requireEditor }, async (req, reply) => {
    const { rowCount } = await db.query('DELETE FROM entity_links WHERE id=$1 AND campaign_id=$2', [req.params.id, req.params.campaignId])
    if (!rowCount) return reply.status(404).send({ error: 'Link não encontrado.' })
    return reply.status(204).send()
  })

  fastify.get('/campaigns/:campaignId/links/entity/:type/:id', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { rows } = await db.query(
      `SELECT * FROM entity_links WHERE campaign_id=$1 AND ((source_type=$2 AND source_id=$3) OR (target_type=$2 AND target_id=$3))`,
      [req.params.campaignId, req.params.type, req.params.id]
    )
    return reply.send(await filterVisibleLinks(db, req, rows))
  })
}
