import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'
import { canViewDm, filterVisibleLinks, sanitizeEntityRow, sanitizeEntityRows } from '../lib/audience.js'
import { cache, cacheKey, TTL } from '../lib/cache.js'

async function invalidateArcsSessions(campaignId) {
  await Promise.all([
    cache.delByPrefix(`campaign:${campaignId}:arcs:`),
    cache.delByPrefix(`campaign:${campaignId}:sessions:`),
  ])
}

export async function arcRoutes(fastify) {
  const { db } = fastify

  fastify.get('/campaigns/:campaignId/arcs', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId } = req.params
    const isEditor = ['admin','editor'].includes(req.campaignRole)
    const roleKey = isEditor ? 'editor' : 'viewer'
    const key = cacheKey.arcs(campaignId, roleKey)

    const rows = await cache.getOrSet(key, TTL.ARCS_SESSIONS, async () => {
      const arcFilter = isEditor ? '' : "AND a.visibility='public'"
      const sessionFilter = isEditor ? '' : "AND sessions.visibility='public'"
      const { rows } = await db.query(
        `SELECT a.*,(SELECT COUNT(*) FROM sessions WHERE arc_id=a.id ${sessionFilter}) AS session_count
         FROM arcs a WHERE a.campaign_id=$1 ${arcFilter} ORDER BY sort_order,created_at`,
        [campaignId]
      )
      return rows
    })
    return reply.send(rows)
  })

  fastify.get('/campaigns/:campaignId/sessions', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const { campaignId } = req.params
    const isEditor = ['admin','editor'].includes(req.campaignRole)
    const roleKey = isEditor ? 'editor' : 'viewer'
    const key = cacheKey.sessions(campaignId, roleKey)

    const rows = await cache.getOrSet(key, TTL.ARCS_SESSIONS, async () => {
      const sf = isEditor ? '' : "AND s.visibility='public' AND a.visibility='public'"
      const { rows } = await db.query(
        `SELECT s.*,a.title AS arc_title
         FROM sessions s
         JOIN arcs a ON a.id=s.arc_id
         WHERE s.campaign_id=$1 ${sf}
         ORDER BY COALESCE(s.played_at, s.created_at) DESC,s.session_number DESC`,
        [campaignId]
      )
      return rows
    })
    return reply.send(sanitizeEntityRows(rows, req, 'sessions'))
  })

  fastify.post('/campaigns/:campaignId/arcs', { preHandler: requireEditor }, async (req, reply) => {
    const { title, summary, status, visibility, sort_order, started_at, ended_at } = req.body
    if (!title) return reply.status(400).send({ error: 'title é obrigatório.' })
    const { rows } = await db.query(
      `INSERT INTO arcs (campaign_id,title,summary,status,visibility,sort_order,started_at,ended_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.campaignId, title, summary, status ?? 'upcoming', visibility ?? 'public', sort_order ?? 0, started_at, ended_at]
    )
    await invalidateArcsSessions(req.params.campaignId)
    return reply.status(201).send(rows[0])
  })

  fastify.get('/campaigns/:campaignId/arcs/:arcId', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const isEditor = ['admin','editor'].includes(req.campaignRole)
    const arcFilter = isEditor ? '' : "AND visibility='public'"
    const sessionFilter = isEditor ? '' : "AND s.visibility='public'"
    const [a, s, l] = await Promise.all([
      db.query(`SELECT * FROM arcs WHERE id=$1 AND campaign_id=$2 ${arcFilter}`, [req.params.arcId, req.params.campaignId]),
      db.query(`SELECT s.*,(SELECT COUNT(*) FROM encounters WHERE session_id=s.id) AS encounter_count
                FROM sessions s WHERE s.arc_id=$1 ${sessionFilter} ORDER BY session_number,played_at`, [req.params.arcId]),
      db.query(`SELECT * FROM entity_links WHERE campaign_id=$1 AND ((source_type='arcs' AND source_id=$2) OR (target_type='arcs' AND target_id=$2))`, [req.params.campaignId, req.params.arcId]),
    ])
    if (!a.rows.length) return reply.status(404).send({ error: 'Arco não encontrado.' })
    return reply.send({
      ...a.rows[0],
      sessions: sanitizeEntityRows(s.rows, req, 'sessions'),
      links: await filterVisibleLinks(db, req, l.rows),
      _role: req.campaignRole,
      _can_view_dm: canViewDm(req),
    })
  })

  fastify.patch('/campaigns/:campaignId/arcs/:arcId', { preHandler: requireEditor }, async (req, reply) => {
    const fields = ['title','summary','status','visibility','sort_order','started_at','ended_at']
    const sets = []; const vals = []; let i = 1
    for (const f of fields) { if (req.body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(req.body[f]) } }
    if (!sets.length) return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })
    sets.push('updated_at=NOW()')
    vals.push(req.params.arcId, req.params.campaignId)
    const { rows } = await db.query(`UPDATE arcs SET ${sets.join(',')} WHERE id=$${i} AND campaign_id=$${i+1} RETURNING *`, vals)
    await invalidateArcsSessions(req.params.campaignId)
    return reply.send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/arcs/:arcId', { preHandler: requireEditor }, async (req, reply) => {
    await db.query('DELETE FROM arcs WHERE id=$1 AND campaign_id=$2', [req.params.arcId, req.params.campaignId])
    await invalidateArcsSessions(req.params.campaignId)
    return reply.status(204).send()
  })

  fastify.patch('/campaigns/:campaignId/arcs/reorder', { preHandler: requireEditor }, async (req, reply) => {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      for (const { id, sort_order } of req.body) {
        await client.query('UPDATE arcs SET sort_order=$1 WHERE id=$2 AND campaign_id=$3', [sort_order, id, req.params.campaignId])
      }
      await client.query('COMMIT')
    } catch { await client.query('ROLLBACK'); return reply.status(500).send({ error: 'Erro ao reordenar.' }) }
    finally { client.release() }
    await invalidateArcsSessions(req.params.campaignId)
    return reply.send({ ok: true })
  })

  fastify.post('/campaigns/:campaignId/arcs/:arcId/sessions', { preHandler: requireEditor }, async (req, reply) => {
    const { title, session_number, summary, dm_notes, played_at, duration_min, status, visibility } = req.body
    if (!title) return reply.status(400).send({ error: 'title é obrigatório.' })
    const safeDmNotes = canViewDm(req) ? dm_notes : null
    const { rows } = await db.query(
      `INSERT INTO sessions (arc_id,campaign_id,title,session_number,summary,dm_notes,played_at,duration_min,status,visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.arcId, req.params.campaignId, title, session_number, summary, safeDmNotes, played_at, duration_min, status ?? 'planned', visibility ?? 'public']
    )
    await invalidateArcsSessions(req.params.campaignId)
    return reply.status(201).send(rows[0])
  })

  fastify.get('/campaigns/:campaignId/arcs/:arcId/sessions/:sessionId', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const isEditor = ['admin','editor'].includes(req.campaignRole)
    const sessionFilter = isEditor ? '' : "AND visibility='public'"
    const encounterFilter = isEditor ? '' : "AND visibility='public'"
    const [s, e, l] = await Promise.all([
      db.query(`SELECT * FROM sessions WHERE id=$1 AND campaign_id=$2 ${sessionFilter}`, [req.params.sessionId, req.params.campaignId]),
      db.query(`SELECT * FROM encounters WHERE session_id=$1 ${encounterFilter} ORDER BY created_at`, [req.params.sessionId]),
      db.query(`SELECT * FROM entity_links WHERE campaign_id=$1 AND ((source_type='sessions' AND source_id=$2) OR (target_type='sessions' AND target_id=$2))`, [req.params.campaignId, req.params.sessionId]),
    ])
    if (!s.rows.length) return reply.status(404).send({ error: 'Sessão não encontrada.' })
    return reply.send({
      ...sanitizeEntityRow(s.rows[0], req, 'sessions'),
      encounters: e.rows,
      links: await filterVisibleLinks(db, req, l.rows),
      _role: req.campaignRole,
      _can_view_dm: canViewDm(req),
    })
  })

  fastify.patch('/campaigns/:campaignId/arcs/:arcId/sessions/:sessionId', { preHandler: requireEditor }, async (req, reply) => {
    const fields = ['title','session_number','summary','dm_notes','played_at','duration_min','status','visibility']
    const sets = []; const vals = []; let i = 1
    for (const f of fields) {
      if (f === 'dm_notes' && !canViewDm(req)) continue
      if (req.body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(req.body[f]) }
    }
    if (!sets.length) return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })
    sets.push('updated_at=NOW()')
    vals.push(req.params.sessionId, req.params.campaignId)
    const { rows } = await db.query(`UPDATE sessions SET ${sets.join(',')} WHERE id=$${i} AND campaign_id=$${i+1} RETURNING *`, vals)
    await invalidateArcsSessions(req.params.campaignId)
    return reply.send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/arcs/:arcId/sessions/:sessionId', { preHandler: requireEditor }, async (req, reply) => {
    await db.query('DELETE FROM sessions WHERE id=$1 AND campaign_id=$2', [req.params.sessionId, req.params.campaignId])
    await invalidateArcsSessions(req.params.campaignId)
    return reply.status(204).send()
  })

  fastify.post('/campaigns/:campaignId/arcs/:arcId/sessions/:sessionId/encounters', { preHandler: requireEditor }, async (req, reply) => {
    const { title, description, difficulty, visibility, data } = req.body
    if (!title) return reply.status(400).send({ error: 'title é obrigatório.' })
    const { rows } = await db.query(
      `INSERT INTO encounters (session_id,campaign_id,title,description,difficulty,visibility,data) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.sessionId, req.params.campaignId, title, description, difficulty, visibility ?? 'public', JSON.stringify(data ?? {})]
    )
    return reply.status(201).send(rows[0])
  })

  fastify.patch('/campaigns/:campaignId/arcs/:arcId/sessions/:sessionId/encounters/:encId', { preHandler: requireEditor }, async (req, reply) => {
    const fields = ['title','description','difficulty','status','visibility','data']
    const sets = []; const vals = []; let i = 1
    for (const f of fields) {
      if (req.body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(f === 'data' ? JSON.stringify(req.body[f]) : req.body[f]) }
    }
    if (!sets.length) return reply.status(400).send({ error: 'Nenhum campo para atualizar.' })
    sets.push('updated_at=NOW()')
    vals.push(req.params.encId, req.params.campaignId)
    const { rows } = await db.query(`UPDATE encounters SET ${sets.join(',')} WHERE id=$${i} AND campaign_id=$${i+1} RETURNING *`, vals)
    return reply.send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/arcs/:arcId/sessions/:sessionId/encounters/:encId', { preHandler: requireEditor }, async (req, reply) => {
    await db.query('DELETE FROM encounters WHERE id=$1 AND campaign_id=$2', [req.params.encId, req.params.campaignId])
    return reply.status(204).send()
  })
}
