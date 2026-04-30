import { requireEditor } from '../middleware/authenticate.js'
import { complete } from '../lib/ai.js'

export async function aiRoutes(fastify) {
  const { db } = fastify

  function parseJSON(text) {
    try { return JSON.parse(text) } catch {}
    const match = text.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch {} }
    throw new Error('Falha ao parsear resposta da IA.')
  }

  async function getCampaignContext(campaignId) {
    const [camp, npcs, locs, chars] = await Promise.all([
      db.query('SELECT title,description,scenario_type FROM campaigns WHERE id=$1', [campaignId]),
      db.query('SELECT name,role,race FROM npcs WHERE campaign_id=$1 LIMIT 20', [campaignId]),
      db.query('SELECT name,type FROM locations WHERE campaign_id=$1 LIMIT 20', [campaignId]),
      db.query('SELECT name,race,class FROM characters WHERE campaign_id=$1', [campaignId]),
    ])
    const c = camp.rows[0]
    return `Campanha: "${c.title}" (${c.scenario_type ?? 'fantasia'})
Descricao: ${c.description ?? 'nao definida'}
Personagens: ${chars.rows.map(r => `${r.name} (${r.race} ${r.class})`).join(', ') || 'nenhum'}
NPCs: ${npcs.rows.map(r => `${r.name} (${r.role})`).join(', ') || 'nenhum'}
Locais: ${locs.rows.map(r => `${r.name} (${r.type})`).join(', ') || 'nenhum'}`
  }

  const SYSTEM = `Voce e um assistente especialista em D&D 5e e narrativa de RPG de mesa.
REGRAS OBRIGATORIAS:
- Responda SEMPRE em portugues brasileiro
- Quando pedido JSON, retorne APENAS o JSON, sem texto antes, sem blocos de codigo
- O JSON deve ser valido e parseable com JSON.parse()
- Seja criativo e coerente com o mundo da campanha`

  function aiErrorMessage(err) {
    const message = err?.message ?? 'Erro desconhecido.'
    if (/Groq nao configurado/i.test(message)) {
      return 'IA nao configurada no backend. Defina GROQ_API_KEY no Fly.'
    }
    if (/api key|unauthorized|authentication/i.test(message)) {
      return 'Falha ao autenticar na Groq. Verifique GROQ_API_KEY no Fly.'
    }
    if (/model/i.test(message)) {
      return `Falha ao gerar com IA: modelo da Groq invalido ou indisponivel (${message}).`
    }
    return `Falha ao gerar com IA: ${message}`
  }

  fastify.post('/campaigns/:campaignId/ai/npc', { preHandler: requireEditor }, async (req, reply) => {
    try {
      const ctx = await getCampaignContext(req.params.campaignId)
      const hint = req.body.hint ?? ''
      const text = await complete(SYSTEM, `${ctx}\n\nCrie um NPC.${hint ? ` Direcao: "${hint}".` : ''}
Retorne JSON:
{"name":"...","race":"...","role":"...","description":"...","personality":"...","secrets":"...","hook":"..."}`, 800)
      return reply.send(parseJSON(text))
    } catch (err) {
      req.log.error({ err }, 'Falha ao gerar NPC com IA')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  fastify.post('/campaigns/:campaignId/ai/location', { preHandler: requireEditor }, async (req, reply) => {
    try {
      const ctx = await getCampaignContext(req.params.campaignId)
      const hint = req.body.hint ?? ''
      let parentContext = ''
      if (req.body.parent_id) {
        const { rows } = await db.query(
          'SELECT name,type,description FROM locations WHERE id=$1 AND campaign_id=$2',
          [req.body.parent_id, req.params.campaignId]
        )
        if (rows.length) {
          const parent = rows[0]
          parentContext = `\nLocal pai/mae: "${parent.name}" (${parent.type ?? 'sem tipo'}). Descricao: ${parent.description ?? 'sem descricao'}. O novo local deve funcionar como sub-local coerente desse lugar.`
        }
      }
      const text = await complete(SYSTEM, `${ctx}${parentContext}\n\nCrie um local para a campanha.${hint ? ` Direcao: "${hint}".` : ''}
Retorne JSON:
{"name":"...","type":"Cidade|Vila|Taverna|Castelo|Dungeon|Floresta|Ruina|Planicie|Porto|Outro","description":"...","hook":"...","secret":"..."}`, 900)
      return reply.send(parseJSON(text))
    } catch (err) {
      req.log.error({ err }, 'Falha ao gerar local com IA')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  fastify.post('/campaigns/:campaignId/ai/session-summary', { preHandler: requireEditor }, async (req, reply) => {
    const { sessionId } = req.body
    const { rows } = await db.query(
      `SELECT s.title,s.dm_notes,json_agg(json_build_object('title',e.title)) AS encounters
       FROM sessions s LEFT JOIN encounters e ON e.session_id=s.id
       WHERE s.id=$1 AND s.campaign_id=$2 GROUP BY s.id`,
      [sessionId, req.params.campaignId]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Sessao nao encontrada.' })
    const ctx = await getCampaignContext(req.params.campaignId)
    const s = rows[0]
    const text = await complete(SYSTEM,
      `${ctx}\n\nSessao: "${s.title}"\nNotas: ${s.dm_notes ?? '(sem notas)'}\nEncontros: ${s.encounters?.map(e => e.title).filter(Boolean).join(', ') || 'nenhum'}\n\nEscreva um resumo narrativo em 3-5 paragrafos, terceira pessoa. Retorne apenas o texto.`,
      1000
    )
    return reply.send({ summary: text })
  })

  fastify.post('/campaigns/:campaignId/ai/encounter', { preHandler: requireEditor }, async (req, reply) => {
    try {
      const { difficulty = 'Medio', location, theme } = req.body
      const ctx = await getCampaignContext(req.params.campaignId)
      const text = await complete(SYSTEM,
        `${ctx}\n\nEncontro dificuldade "${difficulty}".${location ? ` Local: ${location}.` : ''} ${theme ? `Tema: ${theme}.` : ''}\nRetorne JSON:\n{"title":"...","description":"...","difficulty":"${difficulty}","monsters":[{"name":"...","quantity":1,"role":"..."}],"terrain":"...","twist":"...","loot":"..."}`,
        900
      )
      return reply.send(parseJSON(text))
    } catch (err) {
      req.log.error({ err }, 'Falha ao gerar encontro com IA')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  fastify.post('/campaigns/:campaignId/ai/expand-note', { preHandler: requireEditor }, async (req, reply) => {
    const { title, content } = req.body
    const ctx = await getCampaignContext(req.params.campaignId)
    const text = await complete(SYSTEM,
      `${ctx}\n\nNota:\nTitulo: "${title}"\nConteudo: "${content}"\n\nExpanda em lore rico, max 400 palavras. Retorne apenas o texto.`,
      700
    )
    return reply.send({ expanded: text })
  })
}
