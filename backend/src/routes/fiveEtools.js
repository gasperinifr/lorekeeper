import { authenticate, requireEditor } from '../middleware/authenticate.js'
import { getCreatures, getSpells, getItems, normalizeCreature, normalizeSpell, normalizeItem } from '../lib/fiveECache.js'

export async function fiveEtoolsRoutes(fastify) {
  const { db } = fastify

  fastify.get('/5e/creatures', { preHandler: authenticate }, async (req, reply) => {
    try {
      const { q='', cr, type } = req.query
      let data = await getCreatures()
      if (q)    data = data.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
      if (cr)   data = data.filter(m => (m.cr?.cr ?? m.cr) == cr)
      if (type) data = data.filter(m => (typeof m.type === 'object' ? m.type.type : m.type)?.toLowerCase() === type.toLowerCase())
      return reply.send({ total: data.length, results: data.slice(0,50).map(normalizeCreature) })
    } catch (err) {
      req.log.error({ err }, 'Falha ao carregar criaturas 5e')
      return reply.status(502).send({ error: 'Falha ao carregar criaturas do catálogo 5e.' })
    }
  })

  fastify.get('/5e/spells', { preHandler: authenticate }, async (req, reply) => {
    try {
      const { q='', level, school } = req.query
      let data = await getSpells()
      if (q)      data = data.filter(s => s.name.toLowerCase().includes(q.toLowerCase()))
      if (level !== undefined) data = data.filter(s => s.level == Number(level))
      if (school) data = data.filter(s => s.school?.toLowerCase().includes(school.toLowerCase()))
      return reply.send({ total: data.length, results: data.slice(0,50).map(normalizeSpell) })
    } catch (err) {
      req.log.error({ err }, 'Falha ao carregar magias 5e')
      return reply.status(502).send({ error: 'Falha ao carregar magias do catálogo 5e.' })
    }
  })

  fastify.get('/5e/items', { preHandler: authenticate }, async (req, reply) => {
    try {
      const { q='' } = req.query
      let data = await getItems()
      if (q) data = data.filter(i => i.name?.toLowerCase().includes(q.toLowerCase()))
      return reply.send({ total: data.length, results: data.slice(0,50).map(normalizeItem) })
    } catch (err) {
      req.log.error({ err }, 'Falha ao carregar itens 5e')
      return reply.status(502).send({ error: 'Falha ao carregar itens do catálogo 5e.' })
    }
  })

  fastify.post('/5e/import/:campaignId', { preHandler: requireEditor }, async (req, reply) => {
    const { campaignId } = req.params
    const { entityType, entityData } = req.body
    const tableMap = { creatures:'creatures', spells:'spells', items:'items' }
    const table = tableMap[entityType]
    if (!table) return reply.status(400).send({ error: 'Tipo não suportado.' })

    const { name, type, cr, rarity, description, source, source_key, image_url, data } = entityData
    const { rows: ex } = await db.query(`SELECT id FROM ${table} WHERE campaign_id=$1 AND source_key=$2`, [campaignId, source_key])
    if (ex.length) {
      if (entityType === 'creatures') {
        const { rows } = await db.query(
          `UPDATE creatures SET name=$1,type=$2,cr=$3,description=$4,image_url=$5,source=$6,data=$7,updated_at=NOW()
           WHERE id=$8 AND campaign_id=$9 RETURNING *`,
          [name, type, cr, description, image_url, source, JSON.stringify(data), ex[0].id, campaignId]
        )
        return reply.send(rows[0])
      }
      if (entityType === 'spells') {
        const { level, school, casting_time, range, components, duration } = entityData
        const { rows } = await db.query(
          `UPDATE spells SET name=$1,level=$2,school=$3,casting_time=$4,range=$5,components=$6,duration=$7,description=$8,image_url=$9,source=$10,data=$11,updated_at=NOW()
           WHERE id=$12 AND campaign_id=$13 RETURNING *`,
          [name, level, school, casting_time, range, components, duration, description, image_url, source, JSON.stringify(data), ex[0].id, campaignId]
        )
        return reply.send(rows[0])
      }
      const { rows } = await db.query(
        `UPDATE items SET name=$1,type=$2,rarity=$3,description=$4,image_url=$5,source=$6,data=$7,updated_at=NOW()
         WHERE id=$8 AND campaign_id=$9 RETURNING *`,
        [name, type, rarity, description, image_url, source, JSON.stringify(data), ex[0].id, campaignId]
      )
      return reply.send(rows[0])
    }

    let q, vals
    if (entityType === 'creatures') {
      q = `INSERT INTO creatures (campaign_id,name,type,cr,description,image_url,source,source_key,data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`
      vals = [campaignId, name, type, cr, description, image_url, source, source_key, JSON.stringify(data)]
    } else if (entityType === 'spells') {
      const { level, school, casting_time, range, components, duration } = entityData
      q = `INSERT INTO spells (campaign_id,name,level,school,casting_time,range,components,duration,description,image_url,source,source_key,data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`
      vals = [campaignId, name, level, school, casting_time, range, components, duration, description, image_url, source, source_key, JSON.stringify(data)]
    } else {
      q = `INSERT INTO items (campaign_id,name,type,rarity,description,image_url,source,source_key,data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`
      vals = [campaignId, name, type, rarity, description, image_url, source, source_key, JSON.stringify(data)]
    }
    const { rows } = await db.query(q, vals)
    return reply.status(201).send(rows[0])
  })
}
