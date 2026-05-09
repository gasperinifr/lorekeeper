import { requireCampaignAccess } from '../middleware/authenticate.js'

function isAdmin(req) { return req.campaignRole === 'admin' }
function isEditor(req) { return ['admin', 'editor'].includes(req.campaignRole) }
function isGm(req) { return req.campaignPlayRole === 'gm' }
function canModerateDiary(req) { return isAdmin(req) || isEditor(req) || isGm(req) }

export async function diaryRoutes(fastify) {
  const { db } = fastify

  fastify.get('/campaigns/:campaignId/diary/messages', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId } = req.params
    const channel = req.query.channel === 'private' ? 'private' : 'group'

    if (channel === 'group') {
      const { rows } = await db.query(
        `SELECT dm.*, u.username, u.avatar_url
         FROM diary_messages dm
         LEFT JOIN users u ON u.id = dm.author_id
         WHERE dm.campaign_id=$1 AND dm.channel='group'
         ORDER BY dm.created_at ASC
         LIMIT 400`,
        [campaignId]
      )
      return reply.send(rows)
    }

    const requestedPlayerId = req.query.player_id ?? req.user.id
    const canReadOthers = canModerateDiary(req)

    if (!canReadOthers && requestedPlayerId !== req.user.id) {
      return reply.status(403).send({ error: 'Voce so pode ler seu proprio diario.' })
    }

    const { rows } = await db.query(
      `SELECT dm.*, u.username, u.avatar_url
       FROM diary_messages dm
       LEFT JOIN users u ON u.id = dm.author_id
       WHERE dm.campaign_id=$1 AND dm.channel='private' AND dm.player_id=$2
       ORDER BY dm.created_at ASC
       LIMIT 400`,
      [campaignId, requestedPlayerId]
    )
    return reply.send(rows)
  })

  fastify.post('/campaigns/:campaignId/diary/messages', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId } = req.params
    const { content, image_url, mentions, channel: rawChannel, player_id: rawPlayerId } = req.body

    const text = String(content ?? '').trim()
    const safeMentions = Array.isArray(mentions) ? mentions.slice(0, 20) : []
    if (!text && !image_url) return reply.status(400).send({ error: 'Conteudo nao pode ser vazio.' })
    if (text.length > 10000) return reply.status(400).send({ error: 'Mensagem muito longa (maximo 10.000 caracteres).' })

    const channel = rawChannel === 'private' ? 'private' : 'group'

    let playerId = null
    if (channel === 'private') {
      const canWriteOthers = canModerateDiary(req)
      if (rawPlayerId && canWriteOthers) {
        playerId = rawPlayerId
      } else if (rawPlayerId && rawPlayerId !== req.user.id) {
        return reply.status(403).send({ error: 'Você só pode escrever no seu próprio diário.' })
      } else {
        playerId = req.user.id
      }
    }

    const { rows } = await db.query(
      `INSERT INTO diary_messages (campaign_id, author_id, channel, player_id, content, image_url, mentions)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [campaignId, req.user.id, channel, playerId, text, image_url || null, JSON.stringify(safeMentions)]
    )
    return reply.status(201).send(rows[0])
  })

  fastify.patch('/campaigns/:campaignId/diary/messages/:messageId', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId, messageId } = req.params
    const text = String(req.body.content ?? '').trim()
    if (!text) return reply.status(400).send({ error: 'Conteudo nao pode ser vazio.' })
    if (text.length > 10000) return reply.status(400).send({ error: 'Mensagem muito longa (maximo 10.000 caracteres).' })

    const { rows: existing } = await db.query(
      'SELECT author_id FROM diary_messages WHERE id=$1 AND campaign_id=$2',
      [messageId, campaignId]
    )
    if (!existing.length) return reply.status(404).send({ error: 'Entrada nao encontrada.' })
    if (existing[0].author_id !== req.user.id && !canModerateDiary(req)) {
      return reply.status(403).send({ error: 'Voce nao pode editar esta entrada.' })
    }

    const { rows } = await db.query(
      `UPDATE diary_messages SET content=$1, updated_at=NOW() WHERE id=$2 AND campaign_id=$3 RETURNING *`,
      [text, messageId, campaignId]
    )
    return reply.send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/diary/messages/:messageId', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { rows } = await db.query(
      'SELECT author_id FROM diary_messages WHERE id=$1 AND campaign_id=$2',
      [req.params.messageId, req.params.campaignId]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Entrada nao encontrada.' })
    if (rows[0].author_id !== req.user.id && !canModerateDiary(req)) {
      return reply.status(403).send({ error: 'Voce nao pode apagar esta entrada.' })
    }
    await db.query('DELETE FROM diary_messages WHERE id=$1 AND campaign_id=$2', [req.params.messageId, req.params.campaignId])
    return reply.status(204).send()
  })

  fastify.get('/campaigns/:campaignId/diary/players', { preHandler: requireCampaignAccess }, async (req, reply) => {
    if (!canModerateDiary(req)) {
      return reply.status(403).send({ error: 'Apenas o mestre pode listar os jogadores.' })
    }
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.avatar_url, cm.play_role
       FROM campaign_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.campaign_id=$1
       ORDER BY u.username ASC`,
      [req.params.campaignId]
    )
    return reply.send(rows)
  })
}
