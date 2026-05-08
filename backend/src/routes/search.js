import { requireCampaignAccess } from '../middleware/authenticate.js'
import { buildAudienceFilter } from '../lib/audience.js'

const SEARCHABLE = [
  { table: 'characters', label: 'characters', fields: ['name','description','backstory'], audience: true },
  { table: 'npcs',       label: 'npcs',       fields: ['name','description','personality'], audience: true },
  { table: 'locations',  label: 'locations',  fields: ['name','description'], audience: true },
  { table: 'items',      label: 'items',      fields: ['name','description'], audience: true },
  { table: 'spells',     label: 'spells',     fields: ['name','description'], audience: true },
  { table: 'creatures',  label: 'creatures',  fields: ['name','description'], audience: true },
  { table: 'notes',      label: 'notes',      fields: ['title','content'], audience: true },
  { table: 'arcs',       label: 'arcs',       fields: ['title','summary'] },
  { table: 'sessions',   label: 'sessions',   fields: ['title','summary'] },
]

export async function searchRoutes(fastify) {
  const { db } = fastify

  fastify.get('/campaigns/:campaignId/search', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const q = (req.query.q ?? '').trim()
    if (q.length < 2) return reply.status(400).send({ error: 'Query minima: 2 caracteres.' })
    const canSeeLegacyPrivate = ['admin','editor'].includes(req.campaignRole)
    const results = []

    await Promise.all(SEARCHABLE.map(async ({ table, label, fields, audience }) => {
      const conditions = fields.map(f => `${f} ILIKE $2`).join(' OR ')
      const extraColumns = table === 'sessions' ? ',arc_id' : ''
      let query = `SELECT id,${fields[0]} AS title,'${label}' AS type${extraColumns} FROM ${table} WHERE campaign_id=$1 AND (${conditions})`
      const params = [req.params.campaignId, `%${q}%`]

      if (audience) {
        const access = buildAudienceFilter(table, req, 3)
        query += ` ${access.sql}`
        params.push(...access.vals)
      } else if (!canSeeLegacyPrivate) {
        query += " AND visibility='public'"
      }

      query += ' LIMIT 10'
      const { rows } = await db.query(query, params)
      results.push(...rows)
    }))

    return reply.send(results)
  })
}
