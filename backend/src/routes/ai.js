import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'
import { complete, completeMessages, getCampaignContextFull } from '../lib/ai.js'

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
{"name":"...","race":"...","role":"...","description":"...","personality":"...","secrets":"...","hook":"...","data":{"age":"...","appearance":"...","voice":"...","motivation":"...","fear":"...","mannerism":"...","plot_hook":"...","dm_notes":"..."}}
Inclua os campos data quando tiver uma boa ideia. Seja conciso: maximo 2 frases por campo.`, 950)
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
{"name":"...","type":"Cidade|Vila|Taverna|Castelo|Dungeon|Floresta|Ruina|Planicie|Porto|Outro","description":"...","hook":"...","secret":"...","data":{"atmosphere":"...","climate":"...","history":"...","culture":"...","rulers":"...","dangers":"...","plot_hook":"...","dm_notes":"..."}}
Inclua os campos data quando tiver uma boa ideia. Seja conciso: maximo 2 frases por campo.`, 1050)
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

  fastify.post('/campaigns/:campaignId/ai/entity-draft', { preHandler: requireEditor }, async (req, reply) => {
    try {
      const { entity_type, name, hint } = req.body
      if (!entity_type || !name) return reply.status(400).send({ error: 'entity_type e name sao obrigatorios.' })

      const ctx = await getCampaignContext(req.params.campaignId)
      const direction = hint ? ` Direcao: "${hint}".` : ''
      const PROMPTS = {
        npcs: `Crie um rascunho para o NPC chamado "${name}".${direction}
Retorne JSON com estes campos (todos opcionais, pule se nao tiver boa ideia):
{"role":"...","race":"...","description":"...","personality":"...","data":{"age":"...","appearance":"...","voice":"...","motivation":"...","fear":"...","mannerism":"..."}}
Tambem pode incluir em data: {"dm_notes":"...","plot_hook":"...","hook":"..."} quando fizer sentido.
IMPORTANTE: seja conciso. Maximo 2 frases por campo. Nao invente fatos que contradigam o contexto.`,
        locations: `Crie um rascunho para o local chamado "${name}".${direction}
Retorne JSON:
{"type":"Cidade|Vila|Taverna|Castelo|Dungeon|Floresta|Ruina|Planicie|Porto|Outro","description":"...","data":{"atmosphere":"...","climate":"...","history":"...","culture":"...","rulers":"...","dangers":"...","plot_hook":"...","dm_notes":"..."}}
IMPORTANTE: seja conciso. Maximo 2 frases por campo.`,
        creatures: `Crie um rascunho para a criatura chamada "${name}".${direction}
Retorne JSON:
{"type":"Aberracao|Besta|Celestial|Construto|Dragao|Elemental|Fada|Fiend|Gigante|Humanoide|Morto-Vivo|Monstruosidade|Planta|Slime|Outro","cr":"...","description":"...","data":{"behavior":"...","habitat":"...","threat_level":3,"tactics":"...","weaknesses":"...","loot":"...","dm_notes":"..."}}
IMPORTANTE: seja conciso. Maximo 2 frases por campo.`,
        items: `Crie um rascunho para o item chamado "${name}".${direction}
Retorne JSON:
{"type":"Arma|Armadura|Artefato|Consumivel|Ferramenta|Tesouro|Outro","rarity":"Comum|Incomum|Raro|Muito Raro|Lendario|Artefato","description":"...","properties":"...","data":{"appearance":"...","history":"...","curse":"...","dm_notes":"..."}}
IMPORTANTE: seja conciso. Maximo 2 frases por campo.`,
      }

      const prompt = PROMPTS[entity_type]
      if (!prompt) return reply.status(400).send({ error: `Tipo nao suportado: ${entity_type}` })

      const text = await complete(SYSTEM, `${ctx}\n\n${prompt}`, 900)
      return reply.send(parseJSON(text))
    } catch (err) {
      req.log.error({ err }, 'Falha ao gerar rascunho de entidade')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  fastify.post('/campaigns/:campaignId/ai/suggest-links', { preHandler: requireEditor }, async (req, reply) => {
    try {
      const { entity_type, entity_id, name, description } = req.body

      const [chars, npcs, locs, items] = await Promise.all([
        db.query('SELECT id,name FROM characters WHERE campaign_id=$1 LIMIT 30', [req.params.campaignId]),
        db.query('SELECT id,name FROM npcs WHERE campaign_id=$1 LIMIT 30', [req.params.campaignId]),
        db.query('SELECT id,name,type FROM locations WHERE campaign_id=$1 LIMIT 30', [req.params.campaignId]),
        db.query('SELECT id,name FROM items WHERE campaign_id=$1 LIMIT 20', [req.params.campaignId]),
      ])

      const allEntities = [
        ...chars.rows.map(r => ({ ...r, type: 'characters' })),
        ...npcs.rows.map(r => ({ ...r, type: 'npcs' })),
        ...locs.rows.map(r => ({ ...r, type: 'locations' })),
        ...items.rows.map(r => ({ ...r, type: 'items' })),
      ].filter(e => !(e.type === entity_type && e.id === entity_id))

      if (!allEntities.length) return reply.send({ suggestions: [] })

      const entityList = allEntities.map(e => `[${e.type}/${e.id}] ${e.name}`).join('\n')
      const text = await complete(SYSTEM,
        `Nova entidade criada: ${entity_type} chamado(a) "${name}".
Descricao: ${description ?? '(sem descricao)'}

Entidades existentes na campanha:
${entityList}

Identifique ate 3 conexoes que fazem sentido narrativo entre a nova entidade e as existentes.
Retorne JSON:
{"suggestions":[{"target_id":"uuid","target_type":"tipo","relation_type":"alianca|rivalidade|familia|lealdade|segredo|divida|amor|odio|mentor|neutro|outro","relation_label":"descricao curta da relacao","confidence":0.0-1.0}]}
So inclua sugestoes com confidence >= 0.6. Se nao houver, retorne {"suggestions":[]}.`,
        600
      )
      const parsed = parseJSON(text)
      const suggestions = (parsed.suggestions ?? [])
        .filter(s => Number(s.confidence ?? 0) >= 0.6)
        .slice(0, 3)
        .map(s => {
          const target = allEntities.find(e => e.id === s.target_id && e.type === s.target_type)
          return target ? { ...s, target_name: target.name } : s
        })
      return reply.send({ suggestions })
    } catch (err) {
      req.log.error({ err }, 'Falha ao sugerir links')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  function oracleMode(req) {
    const requested = req.body?.mode ?? req.query?.mode
    const wantsDm = requested === 'dm'
    const canDm = ['admin', 'editor'].includes(req.campaignRole)
    return wantsDm && canDm ? 'dm' : 'player'
  }

  function oracleSystemPrompt(context, mode) {
    return `Voce e o Oracle do Lorekeeper: um assistente narrativo persistente que conhece a campanha abaixo.
Responda SEMPRE em portugues brasileiro.
Use o contexto da campanha como fonte principal. Se uma informacao nao estiver no contexto, diga isso claramente e ofereca uma inferencia util.
Mantenha continuidade com o historico da conversa.
Modo atual: ${mode === 'dm' ? 'DM. Voce pode mencionar segredos, notas privadas e bastidores.' : 'Jogador. Nao revele segredos, notas privadas, conteudo de DM ou informacoes marcadas como nao publicas.'}
Sempre que citar uma entidade, evento, sessao, arco, local, nota, item, magia, criatura ou personagem listado em <citations>, escreva o nome exato com @ no inicio, por exemplo @Nome Citavel. Nao coloque @ em conceitos que nao estejam em <citations>.
Seja direto, criativo e pratico para mesa de RPG.

${context}`
  }

  fastify.get('/campaigns/:campaignId/ai/oracle', { preHandler: requireCampaignAccess }, async (req, reply) => {
    const mode = oracleMode(req)
    const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 200)
    const { rows } = await db.query(
      `SELECT om.*, u.username
       FROM oracle_messages om
       LEFT JOIN users u ON u.id=om.user_id
       WHERE om.campaign_id=$1 AND om.mode=$2
       ORDER BY om.created_at ASC
       LIMIT $3`,
      [req.params.campaignId, mode, limit]
    )
    return reply.send({ mode, messages: rows })
  })

  fastify.post('/campaigns/:campaignId/ai/oracle', { preHandler: requireCampaignAccess }, async (req, reply) => {
    try {
      const message = String(req.body.message ?? '').trim()
      if (!message) return reply.status(400).send({ error: 'Mensagem obrigatoria.' })

      const mode = oracleMode(req)
      const [{ rows: history }, context] = await Promise.all([
        db.query(
          `SELECT role,content FROM (
             SELECT role,content,created_at FROM oracle_messages
             WHERE campaign_id=$1 AND mode=$2
             ORDER BY created_at DESC
             LIMIT 20
           ) recent ORDER BY created_at ASC`,
          [req.params.campaignId, mode]
        ),
        getCampaignContextFull(db, req.params.campaignId, mode),
      ])

      const messages = [
        ...history.map(row => ({ role: row.role, content: row.content })),
        { role: 'user', content: message },
      ]
      const answer = await completeMessages(oracleSystemPrompt(context, mode), messages, 1300)

      const { rows } = await db.query(
        `WITH user_message AS (
           INSERT INTO oracle_messages (campaign_id,user_id,role,content,mode)
           VALUES ($1,$2,'user',$3,$5)
           RETURNING *
         ), assistant_message AS (
           INSERT INTO oracle_messages (campaign_id,user_id,role,content,mode)
           VALUES ($1,NULL,'assistant',$4,$5)
           RETURNING *
         )
         SELECT * FROM user_message
         UNION ALL
         SELECT * FROM assistant_message
         ORDER BY created_at ASC`,
        [req.params.campaignId, req.user.id, message, answer, mode]
      )

      return reply.status(201).send({ mode, answer, messages: rows })
    } catch (err) {
      req.log.error({ err }, 'Falha ao conversar com Oracle')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  fastify.delete('/campaigns/:campaignId/ai/oracle', { preHandler: requireEditor }, async (req, reply) => {
    const mode = oracleMode(req)
    await db.query('DELETE FROM oracle_messages WHERE campaign_id=$1 AND mode=$2', [req.params.campaignId, mode])
    return reply.status(204).send()
  })
}
