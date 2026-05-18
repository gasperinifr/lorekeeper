import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'
import { cache, cacheKey, TTL } from '../lib/cache.js'

export async function tagRoutes(fastify) {
  const { db } = fastify

  fastify.get('/campaigns/:campaignId/tags', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const key = cacheKey.tags(req.params.campaignId)
    const rows = await cache.getOrSet(key, TTL.TAGS, async () => {
      const { rows } = await db.query('SELECT * FROM tags WHERE campaign_id=$1 ORDER BY name', [req.params.campaignId])
      return rows
    })
    return reply.send(rows)
  })

  fastify.post('/campaigns/:campaignId/tags', { preHandler: requireEditor }, async (req, reply) => {
    const { name, color } = req.body
    const { rows } = await db.query(
      `INSERT INTO tags (campaign_id,name,color) VALUES ($1,$2,$3)
       ON CONFLICT (campaign_id,name) DO UPDATE SET color=EXCLUDED.color RETURNING *`,
      [req.params.campaignId, name, color ?? '#6366f1']
    )
    await cache.del(cacheKey.tags(req.params.campaignId))
    return reply.status(201).send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/tags/:id', { preHandler: requireEditor }, async (req, reply) => {
    await db.query('DELETE FROM tags WHERE id=$1 AND campaign_id=$2', [req.params.id, req.params.campaignId])
    await cache.del(cacheKey.tags(req.params.campaignId))
    return reply.status(204).send()
  })

  fastify.post('/campaigns/:campaignId/tags/:tagId/attach', { preHandler: requireEditor }, async (req, reply) => {
    const { entity_type, entity_id } = req.body
    const { rows } = await db.query(
      `INSERT INTO entity_tags (tag_id,entity_type,entity_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *`,
      [req.params.tagId, entity_type, entity_id]
    )
    await cache.delByPrefix(cacheKey.entityDetailPrefix(req.params.campaignId, entity_type, entity_id))
    return reply.status(201).send(rows[0] ?? { message: 'Tag já aplicada.' })
  })

  fastify.delete('/campaigns/:campaignId/tags/:tagId/detach', { preHandler: requireEditor }, async (req, reply) => {
    const { entity_type, entity_id } = req.body
    await db.query('DELETE FROM entity_tags WHERE tag_id=$1 AND entity_type=$2 AND entity_id=$3', [req.params.tagId, entity_type, entity_id])
    await cache.delByPrefix(cacheKey.entityDetailPrefix(req.params.campaignId, entity_type, entity_id))
    return reply.status(204).send()
  })
}
