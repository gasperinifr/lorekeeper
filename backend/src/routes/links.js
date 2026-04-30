import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'

const VALID = ['characters','npcs','locations','items','spells','creatures','notes','sessions','arcs','encounters']

export async function linkRoutes(fastify) {
  const { db } = fastify

  fastify.get('/campaigns/:campaignId/links', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { rows } = await db.query('SELECT * FROM entity_links WHERE campaign_id=$1 ORDER BY created_at DESC', [req.params.campaignId])
    return reply.send(rows)
  })

  fastify.post('/campaigns/:campaignId/links', { preHandler: requireEditor }, async (req, reply) => {
    const { source_type, source_id, target_type, target_id, relation_label } = req.body
    for (const t of [source_type, target_type]) {
      if (!VALID.includes(t)) return reply.status(400).send({ error: `Tipo inválido: ${t}` })
    }
    const { rows } = await db.query(
      `INSERT INTO entity_links (campaign_id,source_type,source_id,target_type,target_id,relation_label)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (source_type,source_id,target_type,target_id) DO UPDATE SET relation_label=EXCLUDED.relation_label
       RETURNING *`,
      [req.params.campaignId, source_type, source_id, target_type, target_id, relation_label]
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
    return reply.send(rows)
  })
}
