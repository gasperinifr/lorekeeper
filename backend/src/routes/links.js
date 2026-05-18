import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'
import { filterVisibleLinks } from '../lib/audience.js'
import { cache, cacheKey } from '../lib/cache.js'

const VALID = ['characters','npcs','locations','items','spells','creatures','notes','sessions','arcs','encounters','events','groups']
const RELATION_TYPES = [
  'alianca','rivalidade','familia','lealdade','segredo','divida','amor','amizade',
  'parceria','posse','membro','localizacao','protecao','subordinacao','mentor','neutro','outro',
]
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
  const relationText = `${body.relation_type ?? ''} ${body.relation_label ?? ''}`.toLowerCase()
  const relationType = normalizeRelationType(body.relation_type, relationText)
  return {
    relation_type: relationType,
    relation_label: body.relation_label ? String(body.relation_label).slice(0, 100) : null,
  }
}

function normalizeRelationType(rawType, relationText = '') {
  const raw = String(rawType ?? '').trim().toLowerCase()
  if (raw === 'odio' || raw === 'ódio') return 'rivalidade'
  if (RELATION_TYPES.includes(raw) && raw !== 'outro') return raw
  if (/(rival|inimig|conflit|ódio|odio|hostil)/i.test(relationText)) return 'rivalidade'
  if (/(alian|aliad|pacto)/i.test(relationText)) return 'alianca'
  if (/(amiz|amig)/i.test(relationText)) return 'amizade'
  if (/(parce|socied|colabora)/i.test(relationText)) return 'parceria'
  if (/(fam[ií]l|irm[aã]o|irmã|pai|m[ãa]e|filh|parent)/i.test(relationText)) return 'familia'
  if (/(leal|jurament|fidel)/i.test(relationText)) return 'lealdade'
  if (/(segred|ocult|escond)/i.test(relationText)) return 'segredo'
  if (/(d[ií]vid|deve|credor)/i.test(relationText)) return 'divida'
  if (/(amor|romanc|paix|amante)/i.test(relationText)) return 'amor'
  if (/(mentor|tutor|mestre|aprendiz)/i.test(relationText)) return 'mentor'
  if (/(possu|dono|portador|pertence|propriet)/i.test(relationText)) return 'posse'
  if (/(membro|integrante|filiad|pertence a|fac[cç][aã]o|grupo)/i.test(relationText)) return 'membro'
  if (/(localiz|fica em|vive em|mora em|acontece em|aparece em|sediad)/i.test(relationText)) return 'localizacao'
  if (/(prote[çc]|guard|defend)/i.test(relationText)) return 'protecao'
  if (/(subordin|comanda|lidera|servo|vassal|chefe)/i.test(relationText)) return 'subordinacao'
  return RELATION_TYPES.includes(raw) ? raw : 'outro'
}

export async function linkRoutes(fastify) {
  const { db } = fastify

  function invalidateLinkedDetails(campaignId, ...links) {
    return Promise.all(
      links
        .filter(link => link?.source_type && link?.source_id && link?.target_type && link?.target_id)
        .flatMap(link => [
          cache.delByPrefix(cacheKey.entityDetailPrefix(campaignId, link.source_type, link.source_id)),
          cache.delByPrefix(cacheKey.entityDetailPrefix(campaignId, link.target_type, link.target_id)),
        ])
    )
  }

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
    await invalidateLinkedDetails(req.params.campaignId, rows[0])
    return reply.status(201).send(rows[0])
  })

  fastify.delete('/campaigns/:campaignId/links/:id', { preHandler: requireEditor }, async (req, reply) => {
    const { rows } = await db.query('DELETE FROM entity_links WHERE id=$1 AND campaign_id=$2 RETURNING *', [req.params.id, req.params.campaignId])
    if (!rows.length) return reply.status(404).send({ error: 'Link não encontrado.' })
    await invalidateLinkedDetails(req.params.campaignId, rows[0])
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
