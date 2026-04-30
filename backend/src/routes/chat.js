import { requireCampaignAccess } from '../middleware/authenticate.js'

export async function chatRoutes(fastify) {
  const { db } = fastify

  fastify.get('/campaigns/:campaignId/chat/messages', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { rows } = await db.query(
      `SELECT cm.*, u.username, u.avatar_url
       FROM chat_messages cm
       LEFT JOIN users u ON u.id=cm.user_id
       WHERE cm.campaign_id=$1
       ORDER BY cm.created_at ASC
       LIMIT 300`,
      [req.params.campaignId]
    )
    return reply.send(rows)
  })

  fastify.post('/campaigns/:campaignId/chat/messages', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { content, image_url, mentions } = req.body
    const text = String(content ?? '').trim()
    const safeMentions = Array.isArray(mentions) ? mentions.slice(0, 20) : []
    if (!text && !image_url) return reply.status(400).send({ error: 'Mensagem vazia.' })

    const { rows } = await db.query(
      `INSERT INTO chat_messages (campaign_id,user_id,content,image_url,mentions)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [req.params.campaignId, req.user.id, text || null, image_url || null, JSON.stringify(safeMentions)]
    )
    return reply.status(201).send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/chat/messages/:messageId', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { rows } = await db.query('SELECT user_id FROM chat_messages WHERE id=$1 AND campaign_id=$2', [req.params.messageId, req.params.campaignId])
    if (!rows.length) return reply.status(404).send({ error: 'Mensagem nao encontrada.' })
    if (rows[0].user_id !== req.user.id && !['admin', 'editor'].includes(req.campaignRole)) {
      return reply.status(403).send({ error: 'Voce nao pode apagar esta mensagem.' })
    }
    await db.query('DELETE FROM chat_messages WHERE id=$1 AND campaign_id=$2', [req.params.messageId, req.params.campaignId])
    return reply.status(204).send()
  })
}
