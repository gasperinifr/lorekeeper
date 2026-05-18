import { requireCampaignAccess, requireEditor } from '../middleware/authenticate.js'
import { complete, completeMessages, getCampaignContextFull } from '../lib/ai.js'
import { canViewDm } from '../lib/audience.js'
import { cache, cacheKey } from '../lib/cache.js'

export async function aiRoutes(fastify) {
  const { db } = fastify
  const LINK_RELATION_TYPES = [
    'alianca','rivalidade','familia','lealdade','segredo','divida','amor','amizade',
    'parceria','posse','membro','localizacao','protecao','subordinacao','mentor','neutro','outro',
  ]
  const LINK_TYPE_ALIASES = {
    character: 'characters',
    characters: 'characters',
    npc: 'npcs',
    npcs: 'npcs',
    location: 'locations',
    locations: 'locations',
    item: 'items',
    items: 'items',
    group: 'groups',
    groups: 'groups',
  }

  function invalidateEntityCaches(campaignId, entityType, entityId) {
    return Promise.all([
      cache.delByPrefix(`campaign:${campaignId}:${entityType}:list:`),
      cache.delByPrefix(cacheKey.entityDetailPrefix(campaignId, entityType, entityId)),
    ])
  }

  function parseJSON(text) {
    try { return JSON.parse(text) } catch {}
    const match = text.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch {} }
    throw new Error('Falha ao parsear resposta da IA.')
  }

  function compactAI(value, max = 900) {
    const text = typeof value === 'string'
      ? value
      : value && typeof value === 'object'
      ? JSON.stringify(value)
      : ''
    const clean = text.replace(/\s+/g, ' ').trim()
    return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean
  }

  async function getCampaignContext(campaignId) {
    const [camp, npcs, locs, chars, groups] = await Promise.all([
      db.query('SELECT title,description,scenario_type FROM campaigns WHERE id=$1', [campaignId]),
      db.query('SELECT name,role,race FROM npcs WHERE campaign_id=$1 LIMIT 20', [campaignId]),
      db.query('SELECT name,type FROM locations WHERE campaign_id=$1 LIMIT 20', [campaignId]),
      db.query('SELECT name,race,class FROM characters WHERE campaign_id=$1', [campaignId]),
      db.query('SELECT name,type FROM groups WHERE campaign_id=$1 LIMIT 20', [campaignId]),
    ])
    const c = camp.rows[0]
    return `Campanha: "${c.title}" (${c.scenario_type ?? 'fantasia'})
Descrição: ${c.description ?? 'não definida'}
Personagens: ${chars.rows.map(r => `${r.name} (${r.race} ${r.class})`).join(', ') || 'nenhum'}
NPCs: ${npcs.rows.map(r => `${r.name} (${r.role})`).join(', ') || 'nenhum'}
Locais: ${locs.rows.map(r => `${r.name} (${r.type})`).join(', ') || 'nenhum'}
Grupos: ${groups.rows.map(r => `${r.name} (${r.type})`).join(', ') || 'nenhum'}`
  }

  const SYSTEM = `Você é um assistente especialista em D&D 5e e narrativa de RPG de mesa.
REGRAS OBRIGATORIAS:
- Responda SEMPRE em portugues brasileiro natural, com acentos, cedilha e concordancia correta
- Quando pedido JSON, retorne APENAS o JSON, sem texto antes, sem blocos de codigo
- O JSON deve ser valido e parseable com JSON.parse()
- Seja criativo e coerente com o mundo da campanha
- Para conteudo de criaturas, itens e magias, siga as convencoes oficiais de D&D 5e (SRD): nomenclaturas, escalas e coerencia mecanica
- Não invente mecânicas absurdas ou contraditórias (ex.: CR 1 com dano de boss lendário)
- Nunca use frases vagas como "sofre efeitos adicionais", "efeitos especiais" ou "algo acontece" sem descrever exatamente dano, condição, duração, teste de resistência e efeito
- Se faltar dado exato, prefira completar com um valor plausível e claramente padrão de 5e`

  function aiErrorMessage(err) {
    const message = err?.message ?? 'Erro desconhecido.'
    if (/Groq não configurado|Groq nao configurado/i.test(message)) {
      return 'IA não configurada no backend. Defina GROQ_API_KEY no Fly.'
    }
    if (/api key|unauthorized|authentication/i.test(message)) {
      return 'Falha ao autenticar na Groq. Verifique GROQ_API_KEY no Fly.'
    }
    if (/rate limit|tokens per day|429/i.test(message)) {
      const retry = message.match(/try again in ([^".]+)/i)?.[1]
      return retry
        ? `Limite diário da IA atingido. Tente novamente em ${retry}.`
        : 'Limite diário da IA atingido. Tente novamente mais tarde.'
    }
    if (/model/i.test(message)) {
      return `Falha ao gerar com IA: modelo da Groq inválido ou indisponível (${message}).`
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
Inclua os campos data quando tiver uma boa ideia. Seja conciso: máximo 2 frases por campo.`, 950)
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
          parentContext = `\nLocal pai/mãe: "${parent.name}" (${parent.type ?? 'sem tipo'}). Descrição: ${parent.description ?? 'sem descrição'}. O novo local deve funcionar como sub-local coerente desse lugar.`
        }
      }
      const text = await complete(SYSTEM, `${ctx}${parentContext}\n\nCrie um local para a campanha.${hint ? ` Direção: "${hint}".` : ''}
Retorne JSON:
{"name":"...","type":"Cidade|Vila|Taverna|Castelo|Dungeon|Floresta|Ruína|Planície|Porto|Outro","description":"...","hook":"...","secret":"...","data":{"atmosphere":"...","climate":"...","history":"...","culture":"...","rulers":"...","dangers":"...","plot_hook":"...","dm_notes":"..."}}
Inclua os campos data quando tiver uma boa ideia. Seja conciso: máximo 2 frases por campo.`, 1050)
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
    if (!rows.length) return reply.status(404).send({ error: 'Sessão não encontrada.' })
    const ctx = await getCampaignContext(req.params.campaignId)
    const s = rows[0]
    const notes = canViewDm(req) ? s.dm_notes : ''
    const text = await complete(SYSTEM,
      `${ctx}\n\nSessão: "${s.title}"\nNotas: ${notes ?? '(sem notas)'}\nEncontros: ${s.encounters?.map(e => e.title).filter(Boolean).join(', ') || 'nenhum'}\n\nEscreva um resumo narrativo em 3-5 parágrafos, terceira pessoa. Retorne apenas o texto.`,
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
      `${ctx}\n\nNota:\nTítulo: "${title}"\nConteúdo: "${content}"\n\nExpanda em lore rico, máx. 400 palavras. Retorne apenas o texto.`,
      700
    )
    return reply.send({ expanded: text })
  })

  fastify.post('/campaigns/:campaignId/ai/entity-draft', { preHandler: requireEditor }, async (req, reply) => {
    try {
      const { entity_type, name, hint, data: draftData } = req.body
      if (!entity_type) return reply.status(400).send({ error: 'entity_type é obrigatório.' })

      const ctx = await getCampaignContext(req.params.campaignId)
      const direction = hint ? ` Direção: "${hint}".` : ''
      const subject = String(name ?? '').trim() || 'sem nome definido'
      const draftDataStr = draftData && typeof draftData === 'object'
        ? JSON.stringify(draftData).slice(0, 1200)
        : ''
      const existingInstruction = draftDataStr
        ? `\nDados já inseridos pelo usuário: ${draftDataStr}\nPreserve esses dados. Use-os como fonte principal e não substitua valores preenchidos; complete apenas o que estiver vazio ou claramente faltando.`
        : ''
      const DND_5E_RULES = `
REGRAS TÉCNICAS 5e:
- Criaturas: use CR plausível para ameaça, valores coerentes de CA/PV/deslocamento e atributos STR/DEX/CON/INT/WIS/CHA de 1 a 30.
- Criaturas: a ficha deve ter traços e ações jogáveis. Cada ação de ataque precisa dizer tipo de ataque, bônus para acertar, alcance, alvo e dano.
- Itens: respeite raridade e tipo. Evite poderes quebrados para raridades baixas.
- Magias: respeite nível (0-9), escola, componentes e duração em formato comum de 5e.
- Magias: o efeito deve especificar alvo/área, teste de resistência ou ataque, dano com tipo, condição aplicada se houver, duração e o que acontece em sucesso/falha.
- Estrutura: sempre incluir um campo "data" quando houver detalhes mecânicos.
- Não deixe campos vazios no JSON final. Se não houver dado canônico, preencha com uma opção plausível e neutra.
- Priorize termos de regra do SRD 5e.
- Escreva todos os textos mecânicos em português brasileiro com acentos. Evite português literal/truncado.
`
      const PRIVACY_RULES = `
REGRAS DE PRIVACIDADE E CONEXOES:
- Voce pode usar entidades existentes da campanha para enriquecer o rascunho.
- Informacoes que jogadores podem ver podem ficar em description, backstory, content, properties, history, culture, appearance e campos equivalentes.
- Segredos, revelacoes futuras, traicoes, maldicoes ocultas, notas de bastidor e ganchos de mestre devem ficar apenas em secrets, data.dm_notes, data.plot_hook ou data.curse.
- Se mencionar uma entidade existente em campo publico, mencione apenas o que seria seguro para jogadores saberem.
- Se a conexao com uma entidade existente for secreta, mantenha o detalhe em campo privado para que o sistema possa sugerir a conexao sem vazar a revelacao.
`
      const PROMPTS = {
        characters: `Crie um rascunho para o personagem de jogador chamado "${subject}".${direction}${existingInstruction}
REGRAS ESPECÍFICAS PARA PERSONAGEM:
- Use estritamente D&D 5e oficial/SRD em português; não invente sistemas, raças, classes, magias, características ou mecânicas fora de 5e.
- Se nível, classe, raça ou antecedente já foram inseridos, respeite exatamente esses valores.
- Ajuste PV, bônus de proficiência, características, equipamento e conjuração ao nível informado.
- Não substitua antecedente, classe, raça, nível, nome ou qualquer campo já preenchido.
Retorne JSON:
{"name":"...","race":"...","class":"...","level":1,"description":"...","backstory":"...","data":{"background":"...","personality_traits":"...","ideals":"...","bonds":"...","flaws":"...","str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10,"armor_class":10,"hit_points":"...","speed":"9 m","proficiency_bonus":"+2","saving_throws":"...","skills":"...","proficiencies":"...","equipment":"...","features":"...","spellcasting":"...","player_notes":"...","goals":"..."}}
Se o nome estiver como "sem nome definido", invente um nome coerente. Preencha todos os campos com valores úteis e concisos.`,
        npcs: `Crie um rascunho para o NPC chamado "${subject}".${direction}${existingInstruction}
Retorne JSON com estes campos (preencha todos):
{"role":"...","race":"...","description":"...","personality":"...","data":{"age":"...","appearance":"...","voice":"...","motivation":"...","fear":"...","mannerism":"..."}}
Tambem pode incluir em data: {"dm_notes":"...","plot_hook":"...","hook":"..."} quando fizer sentido.
IMPORTANTE: seja conciso. Máximo 2 frases por campo. Não invente fatos que contradigam o contexto.`,
        locations: `Crie um rascunho para o local chamado "${subject}".${direction}${existingInstruction}
Retorne JSON:
{"name":"...","type":"Cidade|Vila|Taverna|Castelo|Dungeon|Floresta|Ruina|Planicie|Porto|Outro","description":"...","data":{"atmosphere":"...","climate":"...","history":"...","culture":"...","rulers":"...","dangers":"...","plot_hook":"...","dm_notes":"..."}}
IMPORTANTE: preencha todos os campos e seja conciso. Maximo 2 frases por campo.`,
        creatures: `Crie um rascunho para a criatura chamada "${subject}".${direction}${existingInstruction}
${DND_5E_RULES}
Exemplo de formato valido:
{"type":"Monstruosidade","cr":"5","description":"Predador de ruínas antigas.","data":{"statBlock":true,"ac":"15 (armadura natural)","hpText":"95 (10d10+40)","speedText":"9 m, escalada 6 m","str":18,"dex":14,"con":18,"int":8,"wis":12,"cha":10,"senses":"visão no escuro 18 m, Percepção passiva 11","languages":"compreende Comum, mas não fala","resist":"frio","immune":"","vulnerable":"","conditionImmune":"","traits":[{"name":"Faro Aguçado","text":"Vantagem em testes de Sabedoria (Percepção) que dependam de olfato."}],"actions":[{"name":"Multiataque","text":"A criatura realiza dois ataques de garra."}],"bonus":[],"reactions":[],"legendary":[]}}
Retorne JSON:
{"type":"Aberracao|Besta|Celestial|Construto|Dragao|Elemental|Fada|Fiend|Gigante|Humanoide|Morto-Vivo|Monstruosidade|Planta|Slime|Outro","cr":"...","description":"...","data":{"behavior":"...","habitat":"...","tactics":"...","weaknesses":"...","loot":"...","dm_notes":"...","statBlock":true,"ac":"...","hpText":"...","speedText":"...","str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10,"senses":"...","languages":"...","resist":"...","immune":"...","vulnerable":"...","conditionImmune":"...","traits":[{"name":"...","text":"..."}],"actions":[{"name":"...","text":"..."}],"bonus":[{"name":"...","text":"..."}],"reactions":[{"name":"...","text":"..."}],"legendary":[{"name":"...","text":"..."}]}}
IMPORTANTE: preencha todos os campos; use listas vazias [] quando não houver entradas. Máximo 2 frases por campo. Toda ação deve ser resolvível na mesa sem interpretação extra.`,
        items: `Crie um rascunho para o item chamado "${subject}".${direction}${existingInstruction}
${DND_5E_RULES}
Exemplo de formato valido:
{"type":"Arma","rarity":"Raro","description":"Lamina curta com runas de trovão.","properties":"finesse, leve","data":{"itemBlock":true,"weight":1.5,"valueText":"2.000 po","damage":"1d6 perfurante + 1d4 trovao","propertiesText":"finesse, leve","entries":"Quando acerta um ataque, o alvo sofre +1d4 de dano de trovão.","requiresAttunement":false,"appearance":"Aco azulado com runas brilhantes.","history":"Forjada por um anão dos picos.","curse":"","dm_notes":""}}
Retorne JSON:
{"type":"Arma|Armadura|Artefato|Consumivel|Ferramenta|Tesouro|Outro","rarity":"Comum|Incomum|Raro|Muito Raro|Lendario|Artefato","description":"...","properties":"...","data":{"appearance":"...","history":"...","curse":"...","dm_notes":"...","itemBlock":true,"weight":0,"valueText":"...","damage":"...","propertiesText":"...","entries":"...","requiresAttunement":false}}
IMPORTANTE: preencha todos os campos. Máximo 2 frases por campo. Não escreva efeito vago: todo dano, condição, alvo, área, duração e teste devem estar definidos.`,
        spells: `Crie um rascunho para a magia chamada "${subject}".${direction}${existingInstruction}
${DND_5E_RULES}
Exemplo de formato valido:
{"level":3,"school":"Evocacao","casting_time":"1 acao","range":"18 m","components":"V,S,M (um fio de cobre)","duration":"Instantanea","description":"Um raio atinge um alvo visivel.","data":{"spellBlock":true,"castingTime":"1 acao","range":"18 m","componentsText":"V,S,M (um fio de cobre)","duration":"Instantanea","damageInflict":"trovao","savingThrow":"Constituicao","entries":"O alvo faz um teste de resistencia de Constituicao.","higherLevel":[{"name":"Em niveis superiores","text":"O dano aumenta em 1d8 por nivel acima do 3º."}]}}
Retorne JSON:
{"level":0,"school":"Abjuracao|Conjuracao|Adivinhacao|Encantamento|Evocacao|Ilusao|Necromancia|Transmutacao","casting_time":"...","range":"...","components":"...","duration":"...","description":"...","data":{"spellBlock":true,"castingTime":"...","range":"...","componentsText":"...","duration":"...","damageInflict":"...","savingThrow":"...","entries":"...","higherLevel":[{"name":"Em niveis superiores","text":"..."}]}}
IMPORTANTE: preencha todos os campos. Máximo 2 frases por campo. Não escreva efeito vago: todo dano, condição, alvo, área, duração e teste devem estar definidos.`,
        notes: `Crie um rascunho para uma nota de campanha chamada "${subject}".${direction}${existingInstruction}
Retorne JSON:
{"title":"...","content":"...","is_secret":false}
Se o titulo estiver como "sem nome definido", invente um titulo coerente. O conteudo deve ter 2 a 5 paragrafos curtos e uteis para mesa.`,
        groups: `Crie um rascunho para um grupo, faccao ou organizacao chamado "${subject}".${direction}${existingInstruction}
Retorne JSON:
{"name":"...","type":"...","description":"...","headquarters":"...","motto":"...","secrets":"...","data":{"dm_notes":"...","plot_hook":"..."}}
Se o nome estiver como "sem nome definido", invente um nome coerente. Seja conciso e preencha todos os campos quando fizer sentido.`,
      }

      const prompt = PROMPTS[entity_type]
      if (!prompt) return reply.status(400).send({ error: `Tipo não suportado: ${entity_type}` })

      const text = await complete(SYSTEM, `${ctx}\n\n${PRIVACY_RULES}\n${prompt}`, 900)
      return reply.send(parseJSON(text))
    } catch (err) {
      req.log.error({ err }, 'Falha ao gerar rascunho de entidade')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  fastify.post('/campaigns/:campaignId/ai/suggest-links', { preHandler: requireEditor }, async (req, reply) => {
    try {
      const { entity_type, entity_id, name, description, data: entityData } = req.body

      const [chars, npcs, locs, items, groups] = await Promise.all([
        db.query('SELECT id,name,race,class,LEFT(description,120) AS description FROM characters WHERE campaign_id=$1 LIMIT 30', [req.params.campaignId]),
        db.query('SELECT id,name,role,race,LEFT(description,120) AS description FROM npcs WHERE campaign_id=$1 LIMIT 30', [req.params.campaignId]),
        db.query('SELECT id,name,type,LEFT(description,120) AS description FROM locations WHERE campaign_id=$1 LIMIT 30', [req.params.campaignId]),
        db.query('SELECT id,name,type,rarity,LEFT(description,120) AS description FROM items WHERE campaign_id=$1 LIMIT 20', [req.params.campaignId]),
        db.query('SELECT id,name,type,LEFT(description,120) AS description FROM groups WHERE campaign_id=$1 LIMIT 30', [req.params.campaignId]),
      ])

      const allEntities = [
        ...chars.rows.map(r => ({ ...r, type: 'characters' })),
        ...npcs.rows.map(r => ({ ...r, type: 'npcs' })),
        ...locs.rows.map(r => ({ ...r, type: 'locations' })),
        ...items.rows.map(r => ({ ...r, type: 'items' })),
        ...groups.rows.map(r => ({ ...r, type: 'groups' })),
      ].filter(e => !(e.type === entity_type && e.id === entity_id))

      if (!allEntities.length) return reply.send({ suggestions: [] })

  const entityList = allEntities.map(e => {
    const meta = [e.role, e.race, e.class, e.type, e.rarity].filter(Boolean).join(', ')
    return `[${e.type}/${e.id}] ${e.name}${meta ? ` (${meta})` : ''}${e.description ? `: ${e.description}` : ''}`
  }).join('\n')
  const sourceContext = [
    description ? `Descricao: ${compactAI(description, 900)}` : 'Descricao: (sem descricao)',
    entityData ? `Dados adicionais: ${compactAI(entityData, 1600)}` : '',
  ].filter(Boolean).join('\n')
  const text = await complete(SYSTEM,
    `Nova entidade criada: ${entity_type} chamado(a) "${name}".
${sourceContext}
Entidades existentes na campanha:
${entityList}
Identifique ate 5 conexoes que fazem sentido narrativo entre a nova entidade e as existentes.
Use os nomes citados no rascunho, descricao e dados adicionais como forte evidencia de conexao.
Nao sugira a mesma entidade mais de uma vez. Se houver mais de uma relacao com a mesma entidade, escolha a relacao mais importante e resuma as demais na relation_label.
Se a evidencia vier de segredo, notas de DM, maldicao, gancho oculto ou outro dado privado, use relation_type "segredo" e escreva uma relation_label segura para jogadores, sem revelar o segredo.
Retorne JSON:
{"suggestions":[{"target_id":"uuid-sem-prefixo","target_type":"characters|npcs|locations|items|groups","relation_type":"alianca|rivalidade|familia|lealdade|segredo|divida|amor|amizade|parceria|posse|membro|localizacao|protecao|subordinacao|mentor|neutro|outro","relation_label":"descricao curta da relacao","confidence":0.0-1.0}]}
Use exatamente um dos ids listados. Nao invente ids, nao use nomes como id e nao inclua prefixos como "npcs/" dentro de target_id.
Use "outro" apenas quando nenhum tipo existente representar a relacao. Use "rivalidade" para inimizade, odio ou hostilidade.
Só inclua sugestões com confidence >= 0.6. Se não houver, retorne {"suggestions":[]}.`,
1200
)
      let parsed
      try {
        parsed = parseJSON(text)
      } catch (parseErr) {
        req.log.warn({ err: parseErr, text }, 'Resposta inválida da IA ao sugerir links')
        return reply.send({ suggestions: [] })
      }
      const suggestionsByTarget = new Map()
      for (const suggestion of parsed.suggestions ?? []) {
        const { targetType, targetId } = normalizeSuggestedTarget(suggestion)
        const target = allEntities.find(e => e.id === targetId && e.type === targetType)
        if (!target) continue
        const normalized = {
          target_id: target.id,
          target_type: target.type,
          target_name: target.name,
          relation_type: normalizeRelationType(suggestion.relation_type, suggestion.relation_label),
          relation_label: compactAI(suggestion.relation_label, 100) || undefined,
          confidence: Number(suggestion.confidence ?? 0),
        }
        if (normalized.confidence < 0.6) continue
        const key = `${target.type}:${target.id}`
        const previous = suggestionsByTarget.get(key)
        if (!previous || normalized.confidence > previous.confidence) {
          suggestionsByTarget.set(key, normalized)
        }
      }
      const suggestions = [...suggestionsByTarget.values()]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
      return reply.send({ suggestions })
    } catch (err) {
      req.log.error({ err }, 'Falha ao sugerir links')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  fastify.post('/campaigns/:campaignId/ai/suggest-propagations', { preHandler: requireEditor }, async (req, reply) => {
    try {
      const { entity_type, entity_id, name, description, data: entityData } = req.body

      if (!entity_type || !entity_id || !name) {
        return reply.status(400).send({ error: 'entity_type, entity_id e name são obrigatórios.' })
      }

  const emptyId = '00000000-0000-0000-0000-000000000000'
  const [npcs, locations, items, characters, notes] = await Promise.all([
    db.query(
      `SELECT id, name, role, race, is_alive, LEFT(description, 80) AS description FROM npcs
       WHERE campaign_id=$1 AND id != $2
       ORDER BY updated_at DESC LIMIT 30`,
      [req.params.campaignId, entity_type === 'npcs' ? entity_id : emptyId]
    ),
    db.query(
      `SELECT id, name, type, LEFT(description, 80) AS description FROM locations
       WHERE campaign_id=$1 AND id != $2
       ORDER BY updated_at DESC LIMIT 20`,
      [req.params.campaignId, entity_type === 'locations' ? entity_id : emptyId]
    ),
    db.query(
      `SELECT id, name, type, LEFT(description, 80) AS description FROM items
       WHERE campaign_id=$1 AND id != $2
       ORDER BY updated_at DESC LIMIT 20`,
      [req.params.campaignId, entity_type === 'items' ? entity_id : emptyId]
    ),
    db.query(
      `SELECT id, name, race, class, LEFT(description, 80) AS description FROM characters
       WHERE campaign_id=$1 AND id != $2
       ORDER BY name ASC`,
      [req.params.campaignId, entity_type === 'characters' ? entity_id : emptyId]
    ),
    db.query(
      `SELECT id, title, LEFT(content, 80) AS content FROM notes
       WHERE campaign_id=$1 AND id != $2
       ORDER BY updated_at DESC LIMIT 15`,
      [req.params.campaignId, entity_type === 'notes' ? entity_id : emptyId]
    ),
  ])

      const ctx = `
NPCs: ${npcs.rows.map(r => `[id:${r.id}] ${r.name} (${r.role ?? 'sem papel'}, ${r.race ?? ''}, ${r.is_alive === false ? 'morto' : 'vivo'})${r.description ? ': ' + r.description.slice(0, 150) : ''}`).join('\n') || 'nenhum'}
Locais: ${locations.rows.map(r => `[id:${r.id}] ${r.name} (${r.type ?? 'sem tipo'})${r.description ? ': ' + r.description.slice(0, 120) : ''}`).join('\n') || 'nenhum'}
Itens: ${items.rows.map(r => `[id:${r.id}] ${r.name} (${r.type ?? ''})${r.description ? ': ' + r.description.slice(0, 100) : ''}`).join('\n') || 'nenhum'}
Personagens: ${characters.rows.map(r => `[id:${r.id}] ${r.name} (${r.race ?? ''} ${r.class ?? ''})`).join('\n') || 'nenhum'}
Notas: ${notes.rows.map(r => `[id:${r.id}] ${r.title}${r.content ? ': ' + r.content.slice(0, 100) : ''}`).join('\n') || 'nenhuma'}
      `.trim()

  const entityDesc = description ? description.slice(0, 400) : ''
  const entityDataStr = entityData && typeof entityData === 'object' ? JSON.stringify(entityData).slice(0, 300) : ''
  const targetLookup = new Map([
    ...npcs.rows.map(r => [`npcs:${r.id}`, { type: 'npcs', id: r.id, name: r.name }]),
    ...locations.rows.map(r => [`locations:${r.id}`, { type: 'locations', id: r.id, name: r.name }]),
    ...items.rows.map(r => [`items:${r.id}`, { type: 'items', id: r.id, name: r.name }]),
    ...characters.rows.map(r => [`characters:${r.id}`, { type: 'characters', id: r.id, name: r.name }]),
  ])

  const text = await complete(
    `Você é um assistente especialista em narrativa de RPG que analisa entidades e sugere propagações de estado coerentes no mundo da campanha.
REGRAS OBRIGATÓRIAS:

Responda SOMENTE com JSON válido, sem texto antes ou depois, sem blocos de código
Sugira apenas propagações que fazem sentido narrativo real e direto
Nunca invente conexões forçadas
Para is_alive use apenas true ou false (boolean)
Máximo 4 sugestões por chamada
Só sugira propagações para entidades cujo id aparece na lista de contexto
Responda com um único objeto JSON no formato {"propagations":[]}`,
    `Entidade recém criada/editada:
Tipo: ${entity_type}
ID: ${entity_id}
Nome: "${name}"
Descrição: "${entityDesc}"
${entityDataStr ? `Dados adicionais: ${entityDataStr}` : ''}

Entidades existentes na campanha:
${ctx}

Com base no nome, descrição e dados da entidade recém criada, identifique propagações de estado que deveriam acontecer em outras entidades já existentes.
Retorne JSON:
{
  "propagations": [
    {
      "target_type": "npcs|locations|items|characters",
      "target_id": "uuid-da-entidade-existente",
      "target_name": "nome da entidade afetada",
      "field": "nome do campo a atualizar (ex: is_alive, data.rulers, data.curse, description)",
      "value": "novo valor (string, boolean ou objeto)",
      "reason": "explicação em 1 frase de por que essa propagação faz sentido"
    }
  ]
}
Se não houver propagações óbvias e diretas, retorne {"propagations":[]}.`,
    1200
  )

      let parsed
      try {
        parsed = parseJSON(text)
      } catch (parseErr) {
        req.log.warn({ err: parseErr, text }, 'Resposta inválida da IA ao sugerir propagações')
        return reply.send({ propagations: [] })
      }
      const propagations = (Array.isArray(parsed?.propagations) ? parsed.propagations : [])
        .map(propagation => normalizePropagationSuggestion(propagation, targetLookup))
        .filter(Boolean)
        .slice(0, 4)

      return reply.send({ propagations })
    } catch (err) {
      req.log.error({ err }, 'Falha ao sugerir propagações')
      return reply.status(500).send({ error: aiErrorMessage(err) })
    }
  })

  fastify.post('/campaigns/:campaignId/ai/apply-propagation', { preHandler: requireEditor }, async (req, reply) => {
    const { target_type, target_id, field, value } = req.body
    const { campaignId } = req.params

    const ALLOWED = {
      npcs: ['is_alive', 'role', 'description', 'data'],
      locations: ['description', 'data'],
      items: ['description', 'data'],
      characters: ['description', 'is_active', 'data'],
    }

    const TABLE_MAP = {
      npcs: 'npcs',
      locations: 'locations',
      items: 'items',
      characters: 'characters',
    }

    const table = TABLE_MAP[target_type]
    const allowedFields = ALLOWED[target_type]
    if (!table || !allowedFields) {
      return reply.status(400).send({ error: 'target_type inválido.' })
    }

    const ROOT_FIELDS = new Set(['is_alive', 'is_active', 'role', 'description'])

    if (typeof field !== 'string' || !field.trim()) {
      return reply.status(400).send({ error: 'Campo inválido para propagação.' })
    }
    if (value === undefined) {
      return reply.status(400).send({ error: 'Valor obrigatório para propagação.' })
    }

    if (field.startsWith('data.')) {
      if (!allowedFields.includes('data')) {
        return reply.status(400).send({ error: `Campo "${field}" não permitido para propagação.` })
      }
      const dataPath = field.slice(5).split('.').filter(Boolean)
      if (!dataPath.length || dataPath.some(part => !/^[\w-]+$/.test(part))) {
        return reply.status(400).send({ error: 'Subcampo data inválido para propagação.' })
      }
      const { rows } = await db.query(
        `UPDATE ${table}
         SET data = jsonb_set(COALESCE(data,'{}'::jsonb), $1::text[], $2::jsonb, true), updated_at=NOW()
         WHERE id=$3 AND campaign_id=$4
         RETURNING id`,
        [dataPath, JSON.stringify(value), target_id, campaignId]
      )
      if (!rows.length) return reply.status(404).send({ error: 'Entidade não encontrada.' })
    } else if (ROOT_FIELDS.has(field) && allowedFields.includes(field)) {
      const { rows } = await db.query(
        `UPDATE ${table} SET ${field}=$1, updated_at=NOW() WHERE id=$2 AND campaign_id=$3 RETURNING id`,
        [value, target_id, campaignId]
      )
      if (!rows.length) return reply.status(404).send({ error: 'Entidade não encontrada.' })
    } else {
      return reply.status(400).send({ error: `Campo "${field}" não permitido para propagação.` })
    }

    await invalidateEntityCaches(campaignId, target_type, target_id)
    return reply.send({ ok: true, target_type, target_id, field, value })
  })

  function oracleMode(req) {
    const requested = req.body?.mode ?? req.query?.mode
    const wantsDm = requested === 'dm'
    const canDm = canViewDm(req)
    return wantsDm && canDm ? 'dm' : 'player'
  }

  function normalizeSuggestedTarget(suggestion) {
    const rawType = String(suggestion.target_type ?? '').trim().toLowerCase()
    let targetType = LINK_TYPE_ALIASES[rawType] ?? rawType
    let targetId = String(suggestion.target_id ?? '').trim()
    const typedId = targetId.match(/^([a-z_]+)\/(.+)$/i)
    if (typedId) {
      targetType = LINK_TYPE_ALIASES[typedId[1].toLowerCase()] ?? typedId[1].toLowerCase()
      targetId = typedId[2].trim()
    }
    return { targetType, targetId }
  }

  function normalizeRelationType(rawType, relationLabel = '') {
    const raw = String(rawType ?? '').trim().toLowerCase()
    const relationText = `${raw} ${relationLabel ?? ''}`.toLowerCase()
    if (raw === 'odio' || raw === 'ódio') return 'rivalidade'
    if (LINK_RELATION_TYPES.includes(raw) && raw !== 'outro') return raw
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
    return LINK_RELATION_TYPES.includes(raw) ? raw : 'outro'
  }

  function normalizePropagationSuggestion(propagation, targetLookup) {
    if (!propagation || typeof propagation !== 'object') return null
    const targetType = LINK_TYPE_ALIASES[String(propagation.target_type ?? '').trim().toLowerCase()]
      ?? String(propagation.target_type ?? '').trim().toLowerCase()
    const targetId = String(propagation.target_id ?? '').trim()
    const target = targetLookup.get(`${targetType}:${targetId}`)
    if (!target) return null

    const field = String(propagation.field ?? '').trim()
    const allowedFields = {
      npcs: ['is_alive', 'role', 'description', 'data'],
      locations: ['description', 'data'],
      items: ['description', 'data'],
      characters: ['description', 'is_active', 'data'],
    }[targetType]
    if (!allowedFields) return null

    const rootField = field.split('.')[0]
    if (!allowedFields.includes(rootField)) return null
    if (field.startsWith('data.') && !/^data\.[\w-]+(?:\.[\w-]+)*$/.test(field)) return null
    if (!field.startsWith('data.') && field.includes('.')) return null

    let value = propagation.value
    if (field === 'is_alive' || field === 'is_active') {
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['true', 'vivo', 'ativa', 'ativo', 'sim'].includes(normalized)) value = true
        if (['false', 'morto', 'morta', 'inativa', 'inativo', 'nao', 'não'].includes(normalized)) value = false
      }
      if (typeof value !== 'boolean') return null
    }
    if (value === undefined) return null

    return {
      target_type: target.type,
      target_id: target.id,
      target_name: String(propagation.target_name ?? target.name),
      field,
      value,
      reason: String(propagation.reason ?? '').trim() || 'Propagação sugerida pela IA.',
    }
  }

  function oracleSystemPrompt(context, mode) {
    return `Você é o Oracle do Lorekeeper: um assistente narrativo persistente que conhece a campanha abaixo.
Responda SEMPRE em portugues brasileiro.
Use o contexto da campanha como fonte principal. Se uma informação não estiver no contexto, diga isso claramente e ofereça uma inferência útil.
Mantenha continuidade com o historico da conversa.
Modo atual: ${mode === 'dm' ? 'DM. Você pode mencionar segredos, notas privadas e bastidores.' : 'Jogador. Não revele segredos, notas privadas, conteúdo de DM ou informações marcadas como não públicas.'}
Sempre que citar uma entidade, evento, sessão, arco, local, nota, item, magia, criatura ou personagem listado em <citations>, escreva o nome exato com @ no início, por exemplo @Nome Citável. Não coloque @ em conceitos que não estejam em <citations>.
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
