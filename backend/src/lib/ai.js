import '../env.js'
import Groq from 'groq-sdk'

// ─── Configuração dos dois agentes Groq ──────────────────────────────────────

const PRIMARY_MODEL   = process.env.GROQ_MODEL   ?? 'openai/gpt-oss-120b'
const SECONDARY_MODEL = process.env.GROQ_MODEL_2 ?? 'llama-3.3-70b-versatile'

let _groqPrimary
let _groqSecondary

function getGroqPrimary() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada.')
  }
  if (!_groqPrimary) {
    _groqPrimary = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return _groqPrimary
}

function getGroqSecondary() {
  if (!_groqSecondary) {
    const key = process.env.GROQ_API_KEY_2 ?? process.env.GROQ_API_KEY
    if (!key) throw new Error('Nenhuma chave Groq configurada.')
    _groqSecondary = new Groq({ apiKey: key })
  }
  return _groqSecondary
}

// ─── Detecção de erros recuperáveis ──────────────────────────────────────────

function isRecoverableError(err) {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status
  if (status === 429) return true
  if (status === 500) return true
  if (status === 503) return true
  const msg = String(err?.message ?? '').toLowerCase()
  if (msg.includes('timeout'))            return true
  if (msg.includes('rate_limit'))         return true
  if (msg.includes('rate limit'))         return true
  if (msg.includes('too many requests'))  return true
  if (msg.includes('econnrefused'))       return true
  if (msg.includes('econnreset'))         return true
  if (msg.includes('fetch failed'))       return true
  return false
}

// ─── Chamada bruta Groq ──────────────────────────────────────────────────────

async function callGroq(client, model, systemPrompt, messages, maxTokens) {
  const msg = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })
  return msg.choices[0].message.content
}

function validateContent(content, path) {
  if (typeof content === 'string' || Array.isArray(content)) return
  throw new TypeError(`${path} deve ser string ou array de partes de mensagem.`)
}

function validateMessages(systemPrompt, messages, maxTokens) {
  validateContent(systemPrompt, 'systemPrompt')
  if (!Array.isArray(messages)) {
    throw new TypeError('messages deve ser um array.')
  }
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    throw new TypeError('maxTokens deve ser um inteiro positivo.')
  }
  for (const [index, message] of messages.entries()) {
    if (!message || typeof message !== 'object') {
      throw new TypeError(`messages.${index} deve ser um objeto.`)
    }
    if (!['assistant', 'user'].includes(message.role)) {
      throw new TypeError(`messages.${index}.role invalido: ${message.role}`)
    }
    validateContent(message.content, `messages.${index}.content`)
  }
}

// ─── Wrapper com fallback ────────────────────────────────────────────────────

async function completeWithFallback(systemPrompt, messages, maxTokens) {
  validateMessages(systemPrompt, messages, maxTokens)

  try {
    return await callGroq(getGroqPrimary(), PRIMARY_MODEL, systemPrompt, messages, maxTokens)
  } catch (primaryErr) {
    if (!isRecoverableError(primaryErr)) throw primaryErr
    console.warn(`[ai] Chave primária falhou (${primaryErr?.status ?? primaryErr?.message}). Tentando chave secundária...`)
  }

  try {
    const result = await callGroq(getGroqSecondary(), SECONDARY_MODEL, systemPrompt, messages, maxTokens)
    console.info('[ai] Chave secundária respondeu com sucesso.')
    return result
  } catch (secondaryErr) {
    console.error('[ai] Ambas as chaves falharam.', { secondary: secondaryErr?.message })
    throw secondaryErr
  }
}

// ─── API pública ─────────────────────────────────────────────────────────────

export async function complete(systemPrompt, userPrompt, maxTokens = 1000) {
  return completeWithFallback(
    systemPrompt,
    [{ role: 'user', content: userPrompt }],
    maxTokens
  )
}

export async function completeMessages(systemPrompt, messages, maxTokens = 1200) {
  return completeWithFallback(systemPrompt, messages, maxTokens)
}

// ─── Utilitários internos ─────────────────────────────────────────────────────

function compact(text, max = 420) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function line(label, value) {
  const text = compact(value)
  return text ? `${label}: ${text}` : null
}

const PRIVATE_DATA_KEYS = new Set(['dm_notes', 'plot_hook', 'secret', 'secrets', 'curse'])

function renderData(data, max = 420, publicOnly = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ''
  const entries = Object.entries(data).filter(([key, value]) => {
    if (publicOnly && PRIVATE_DATA_KEYS.has(key)) return false
    if (value === null || value === undefined || value === '') return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object') return Object.keys(value).length > 0
    return true
  })
  if (!entries.length) return ''
  return compact(JSON.stringify(Object.fromEntries(entries)), max)
}

function renderList(title, rows, render, empty = 'nenhum') {
  const body = rows.map(render).filter(Boolean).join('\n')
  return `${title}\n${body || `- ${empty}`}`
}

function visibilityFilter(mode, alias = '') {
  if (mode === 'dm') return ''
  const p = alias ? `${alias}.` : ''
  return `AND ${p}visibility='public'`
}

function citationLine(label, type) {
  const value = compact(label, 120)
  return value ? `- @${value} | ${type}` : null
}

// ─── Contexto completo da campanha ───────────────────────────────────────────

export async function getCampaignContextFull(db, campaignId, mode = 'dm') {
  const safeMode = mode === 'player' ? 'player' : 'dm'
  const publicOnly = safeMode === 'player'

  const [
    campaign,
    arcs,
    sessions,
    npcs,
    characters,
    locations,
    items,
    spells,
    creatures,
    notes,
    events,
    groups,
    citationRows,
  ] = await Promise.all([
    db.query('SELECT title,description,scenario_type,status FROM campaigns WHERE id=$1', [campaignId]),
    db.query(
      `SELECT id,title,summary,status FROM arcs
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY sort_order ASC, created_at DESC
       LIMIT 12`,
      [campaignId]
    ),
    db.query(
      `SELECT s.id,s.title,s.session_number,s.summary,s.dm_notes,s.played_at,s.status,a.title AS arc_title
       FROM sessions s
       LEFT JOIN arcs a ON a.id=s.arc_id
       WHERE s.campaign_id=$1 ${visibilityFilter(safeMode, 's')} ${publicOnly ? "AND COALESCE(a.visibility='public', true)" : ''}
       ORDER BY COALESCE(s.played_at, s.created_at) DESC
       LIMIT 10`,
      [campaignId]
    ),
    db.query(
      `SELECT id,name,role,race,description,personality,secrets,is_alive,data FROM npcs
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY updated_at DESC`,
      [campaignId]
    ),
    db.query(
      `SELECT id,name,race,class,level,description,backstory,is_alive,is_active,data FROM characters
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY name ASC`,
      [campaignId]
    ),
    db.query(
      `SELECT id,name,type,description,data FROM locations
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY name ASC`,
      [campaignId]
    ),
    db.query(
      `SELECT id,name,type,rarity,description,properties,data FROM items
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY updated_at DESC`,
      [campaignId]
    ),
    db.query(
      `SELECT id,name,level,school,casting_time,range,components,duration,description,data FROM spells
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY level ASC, name ASC`,
      [campaignId]
    ),
    db.query(
      `SELECT id,name,type,cr,description,data FROM creatures
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY name ASC`,
      [campaignId]
    ),
    db.query(
      `SELECT id,title,content,is_secret FROM notes
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)} ${publicOnly ? 'AND is_secret=false' : ''}
       ORDER BY updated_at DESC`,
      [campaignId]
    ),
    db.query(
      `SELECT e.id, e.title, e.type, e.impact, e.date_in_world, e.description,
              s.title AS session_title
       FROM events e
       LEFT JOIN sessions s ON s.id = e.session_id ${publicOnly ? "AND s.visibility='public'" : ''}
       WHERE e.campaign_id=$1 ${publicOnly ? "AND e.visibility='public'" : ''}
       ORDER BY
         CASE e.impact WHEN 'divisor' THEN 1 WHEN 'significativo' THEN 2 ELSE 3 END,
         e.created_at DESC
       LIMIT 20`,
      [campaignId]
    ),
    db.query(
      `SELECT g.id, g.name, g.type, g.description, g.headquarters, g.motto,
              CASE WHEN $2 THEN g.secrets ELSE NULL END AS secrets,
              COUNT(gm.id) AS member_count
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id
       WHERE g.campaign_id=$1 ${visibilityFilter(safeMode, 'g')}
       GROUP BY g.id
       ORDER BY g.name ASC`,
      [campaignId, !publicOnly]
    ),
    db.query(
      `SELECT 'Personagem' AS kind, name AS label FROM characters WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       UNION ALL SELECT 'NPC' AS kind, name AS label FROM npcs WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       UNION ALL SELECT 'Local' AS kind, name AS label FROM locations WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       UNION ALL SELECT 'Item' AS kind, name AS label FROM items WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       UNION ALL SELECT 'Magia' AS kind, name AS label FROM spells WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       UNION ALL SELECT 'Criatura' AS kind, name AS label FROM creatures WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       UNION ALL SELECT 'Nota' AS kind, title AS label FROM notes WHERE campaign_id=$1 ${visibilityFilter(safeMode)} ${publicOnly ? 'AND is_secret=false' : ''}
       UNION ALL SELECT 'Arco' AS kind, title AS label FROM arcs WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       UNION ALL SELECT 'Sessão' AS kind, title AS label FROM sessions WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       UNION ALL SELECT 'Evento' AS kind, title AS label FROM events WHERE campaign_id=$1 ${publicOnly ? "AND visibility='public'" : ''}
       UNION ALL SELECT 'Grupo' AS kind, name AS label FROM groups WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY kind, label`,
      [campaignId]
    ),
  ])

  const c = campaign.rows[0] ?? {}
  const nameMaps = {
    characters: new Map(characters.rows.map(r => [r.id, r.name])),
    npcs:       new Map(npcs.rows.map(r => [r.id, r.name])),
    locations:  new Map(locations.rows.map(r => [r.id, r.name])),
    items:      new Map(items.rows.map(r => [r.id, r.name])),
    spells:     new Map(spells.rows.map(r => [r.id, r.name])),
    creatures:  new Map(creatures.rows.map(r => [r.id, r.name])),
    notes:      new Map(notes.rows.map(r => [r.id, r.title])),
    arcs:       new Map(arcs.rows.map(r => [r.id, r.title])),
    sessions:   new Map(sessions.rows.map(r => [r.id, r.title])),
    groups:     new Map(groups.rows.map(r => [r.id, r.name])),
  }

  const { rows: entityLinks } = await db.query(
    `SELECT source_type, source_id, target_type, target_id, relation_label
     FROM entity_links
     WHERE campaign_id=$1
     ORDER BY created_at DESC
     LIMIT 80`,
    [campaignId]
  )
  const relationLines = entityLinks
    .map(link => {
      const sourceName = nameMaps[link.source_type]?.get(link.source_id)
      const targetName = nameMaps[link.target_type]?.get(link.target_id)
      if (!sourceName || !targetName) return null
      const relation = link.relation_label ? ` --${link.relation_label}-> ` : ' -> '
      return `- ${sourceName}${relation}${targetName}`
    })
    .filter(Boolean)

  const eventIds = events.rows.map(r => r.id)
  const eventLinks = eventIds.length
    ? await db.query(
      `SELECT l.event_id, l.entity_type, l.role,
              COALESCE(ch.name, npc.name, loc.name, item.name, spell.name, creature.name, note.title, arc.title, session.title, grp.name) AS entity_name
       FROM event_entity_links l
       LEFT JOIN characters ch       ON l.entity_type='characters' AND ch.id=l.entity_id
       LEFT JOIN npcs npc             ON l.entity_type='npcs'       AND npc.id=l.entity_id
       LEFT JOIN locations loc        ON l.entity_type='locations'  AND loc.id=l.entity_id
       LEFT JOIN items item           ON l.entity_type='items'      AND item.id=l.entity_id
       LEFT JOIN spells spell         ON l.entity_type='spells'     AND spell.id=l.entity_id
       LEFT JOIN creatures creature   ON l.entity_type='creatures'  AND creature.id=l.entity_id
       LEFT JOIN notes note           ON l.entity_type='notes'      AND note.id=l.entity_id
       LEFT JOIN arcs arc             ON l.entity_type='arcs'       AND arc.id=l.entity_id
       LEFT JOIN sessions session     ON l.entity_type='sessions'   AND session.id=l.entity_id
       LEFT JOIN groups grp           ON l.entity_type='groups'     AND grp.id=l.entity_id
       WHERE l.event_id = ANY($1)
         AND (
           $2::boolean = false OR
           CASE l.entity_type
             WHEN 'characters' THEN COALESCE(ch.visibility='public', false)
             WHEN 'npcs'       THEN COALESCE(npc.visibility='public', false)
             WHEN 'locations'  THEN COALESCE(loc.visibility='public', false)
             WHEN 'items'      THEN COALESCE(item.visibility='public', false)
             WHEN 'spells'     THEN COALESCE(spell.visibility='public', false)
             WHEN 'creatures'  THEN COALESCE(creature.visibility='public', false)
             WHEN 'notes'      THEN COALESCE(note.visibility='public' AND note.is_secret=false, false)
             WHEN 'arcs'       THEN COALESCE(arc.visibility='public', false)
             WHEN 'sessions'   THEN COALESCE(session.visibility='public', false)
             WHEN 'groups'     THEN COALESCE(grp.visibility='public', false)
             ELSE false
           END
         )
       ORDER BY l.created_at ASC`,
      [eventIds, publicOnly]
    )
    : { rows: [] }

  const linksByEvent = new Map()
  for (const link of eventLinks.rows) {
    if (!link.entity_name) continue
    const current = linksByEvent.get(link.event_id) ?? []
    current.push(`${link.entity_name}${link.role ? ` (${link.role})` : ''}`)
    linksByEvent.set(link.event_id, current)
  }

  const blocks = [
    '<world>',
    `Campanha: ${c.title ?? 'Campanha sem título'}`,
    `Gênero/cenário: ${c.scenario_type ?? 'fantasia'}`,
    `Status: ${c.status ?? 'active'}`,
    `Modo de informação: ${safeMode === 'dm' ? 'DM, pode usar segredos e notas privadas' : 'Jogador, use apenas informações públicas'}`,
    line('Premissa', c.description),
    renderList('Locais', locations.rows, r => {
      const data = renderData(r.data, 420, publicOnly)
      return `- ${r.name}${r.type ? ` (${r.type})` : ''}${r.description ? `: ${compact(r.description, 260)}` : ''}${data ? ` Dados: ${data}` : ''}`
    }),
    renderList('Itens notaveis', items.rows, r => {
      const parts = [r.type, r.rarity].filter(Boolean).join(', ')
      const data = renderData(r.data, 420, publicOnly)
      return `- ${r.name}${parts ? ` (${parts})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}${r.properties ? ` Propriedades: ${compact(r.properties, 180)}` : ''}${data ? ` Dados: ${data}` : ''}`
    }),
    renderList('Criaturas', creatures.rows, r => {
      const data = renderData(r.data, 420, publicOnly)
      return `- ${r.name}${r.type || r.cr ? ` (${[r.type, r.cr && `CR ${r.cr}`].filter(Boolean).join(', ')})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}${data ? ` Dados: ${data}` : ''}`
    }),
    renderList('Magias', spells.rows, r => {
      const data = renderData(r.data, 420, publicOnly)
      const meta = [r.level !== null && `nivel ${r.level}`, r.school, r.casting_time, r.range, r.duration, r.components].filter(Boolean).join(', ')
      return `- ${r.name}${meta ? ` (${meta})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}${data ? ` Dados: ${data}` : ''}`
    }),
    '</world>',
    '<narrative>',
    renderList('Arcos', arcs.rows, r => `- ${r.title} [${r.status ?? 'sem status'}]${r.summary ? `: ${compact(r.summary, 280)}` : ''}`),
    renderList('Sessões recentes', sessions.rows, r => {
      const number = r.session_number ? `#${r.session_number} ` : ''
      const arc = r.arc_title ? ` (${r.arc_title})` : ''
      const summary = compact(r.summary, 260)
      const dmNotes = safeMode === 'dm' ? compact(r.dm_notes, 220) : ''
      return `- ${number}${r.title}${arc}${summary ? `: ${summary}` : ''}${dmNotes ? ` Notas DM: ${dmNotes}` : ''}`
    }),
    renderList('Notas', notes.rows, r => `- ${r.title}${r.is_secret ? ' [secreta]' : ''}: ${compact(r.content, 260)}`),
    renderList('Conexoes registradas', relationLines, r => r),
    '</narrative>',
    renderList(
      '<citations>\nCitações clicáveis disponíveis. Ao mencionar qualquer item desta lista na resposta, escreva o nome exatamente com @ no início.',
      citationRows.rows,
      r => citationLine(r.label, r.kind)
    ),
    '</citations>',
    renderList(
      '<chronicle>\nCrônica de eventos (do mais importante ao mais recente)',
      events.rows,
      r => {
        const session = r.session_title ? ` [sessão: ${r.session_title}]` : ''
        const date    = r.date_in_world ? ` | ${r.date_in_world}` : ''
        const impact  = { divisor: 'DIVISOR', significativo: 'Significativo', menor: 'Menor' }[r.impact] ?? r.impact
        const linked  = linksByEvent.get(r.id)?.length ? ` Ligado a: ${linksByEvent.get(r.id).join(', ')}.` : ''
        return `- ${impact} | ${r.type.toUpperCase()} | ${r.title}${session}${date}${r.description ? `: ${compact(r.description, 200)}` : ''}${linked}`
      }
    ),
    '</chronicle>',
    renderList(
      '<groups>\nGrupos e organizacoes do mundo',
      groups.rows,
      r => {
        const members = Number(r.member_count) > 0 ? ` | ${r.member_count} membro(s)` : ''
        const hq      = r.headquarters ? ` | Sede: ${compact(r.headquarters, 80)}` : ''
        const motto   = r.motto ? ` | Lema: "${compact(r.motto, 80)}"` : ''
        const secrets = r.secrets ? ` | Segredos: ${compact(r.secrets, 160)}` : ''
        return `- ${r.name}${r.type ? ` (${r.type})` : ''}${members}${hq}${motto}${r.description ? `: ${compact(r.description, 200)}` : ''}${secrets}`
      }
    ),
    '</groups>',
    '<cast>',
    renderList('Personagens', characters.rows, r => {
      const profile = [r.race, r.class, r.level && `nivel ${r.level}`, r.is_alive === false ? 'morto' : null].filter(Boolean).join(' ')
      const data = renderData(r.data, 420, publicOnly)
      return `- ${r.name}${profile ? ` (${profile})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}${r.backstory ? ` Backstory: ${compact(r.backstory, 220)}` : ''}${data ? ` Dados: ${data}` : ''}`
    }),
    renderList('NPCs', npcs.rows, r => {
      const profile = [r.race, r.role, r.is_alive === false ? 'morto' : null].filter(Boolean).join(', ')
      const hook = typeof r.data?.hook === 'string' ? compact(r.data.hook, 220) : ''
      const data = renderData(r.data, 420, publicOnly)
      return `- ${r.name}${profile ? ` (${profile})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}${r.personality ? ` Personalidade: ${compact(r.personality, 160)}` : ''}${hook ? ` Como encontrar: ${hook}` : ''}${safeMode === 'dm' && r.secrets ? ` Segredos: ${compact(r.secrets, 220)}` : ''}${data ? ` Dados: ${data}` : ''}`
    }),
    '</cast>',
  ].filter(Boolean)

  const context = blocks.join('\n')
  return context.length > 30000 ? `${context.slice(0, 29950)}\n[contexto compactado]` : context
}
