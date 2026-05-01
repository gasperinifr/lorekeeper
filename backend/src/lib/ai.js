import Groq from 'groq-sdk'

const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
let groq

function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq nao configurado: defina GROQ_API_KEY.')
  }

  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return groq
}

export async function complete(systemPrompt, userPrompt, maxTokens = 1000) {
  const msg = await getGroq().chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  return msg.choices[0].message.content
}

export async function completeMessages(systemPrompt, messages, maxTokens = 1200) {
  const msg = await getGroq().chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })
  return msg.choices[0].message.content
}

function compact(text, max = 420) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function line(label, value) {
  const text = compact(value)
  return text ? `${label}: ${text}` : null
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
    creatures,
    notes,
  ] = await Promise.all([
    db.query('SELECT title,description,scenario_type,status FROM campaigns WHERE id=$1', [campaignId]),
    db.query(
      `SELECT title,summary,status FROM arcs
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY sort_order ASC, created_at DESC
       LIMIT 12`,
      [campaignId]
    ),
    db.query(
      `SELECT s.title,s.session_number,s.summary,s.dm_notes,s.played_at,s.status,a.title AS arc_title
       FROM sessions s
       LEFT JOIN arcs a ON a.id=s.arc_id
       WHERE s.campaign_id=$1 ${visibilityFilter(safeMode, 's')}
       ORDER BY COALESCE(s.played_at, s.created_at) DESC
       LIMIT 10`,
      [campaignId]
    ),
    db.query(
      `SELECT name,role,race,description,personality,secrets,is_alive FROM npcs
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY updated_at DESC
       LIMIT 35`,
      [campaignId]
    ),
    db.query(
      `SELECT name,race,class,level,description,backstory,is_active FROM characters
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY name ASC
       LIMIT 30`,
      [campaignId]
    ),
    db.query(
      `SELECT name,type,description FROM locations
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY name ASC
       LIMIT 35`,
      [campaignId]
    ),
    db.query(
      `SELECT name,type,rarity,description,properties FROM items
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY updated_at DESC
       LIMIT 25`,
      [campaignId]
    ),
    db.query(
      `SELECT name,type,cr,description FROM creatures
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)}
       ORDER BY name ASC
       LIMIT 25`,
      [campaignId]
    ),
    db.query(
      `SELECT title,content,is_secret FROM notes
       WHERE campaign_id=$1 ${visibilityFilter(safeMode)} ${publicOnly ? 'AND is_secret=false' : ''}
       ORDER BY updated_at DESC
       LIMIT 18`,
      [campaignId]
    ),
  ])

  const c = campaign.rows[0] ?? {}
  const blocks = [
    '<world>',
    `Campanha: ${c.title ?? 'Campanha sem titulo'}`,
    `Genero/cenario: ${c.scenario_type ?? 'fantasia'}`,
    `Status: ${c.status ?? 'active'}`,
    `Modo de informacao: ${safeMode === 'dm' ? 'DM, pode usar segredos e notas privadas' : 'Jogador, use apenas informacoes publicas'}`,
    line('Premissa', c.description),
    renderList('Locais', locations.rows, r => `- ${r.name}${r.type ? ` (${r.type})` : ''}${r.description ? `: ${compact(r.description, 260)}` : ''}`),
    renderList('Itens notaveis', items.rows, r => {
      const parts = [r.type, r.rarity].filter(Boolean).join(', ')
      return `- ${r.name}${parts ? ` (${parts})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}${r.properties && safeMode === 'dm' ? ` Propriedades: ${compact(r.properties, 180)}` : ''}`
    }),
    renderList('Criaturas', creatures.rows, r => `- ${r.name}${r.type || r.cr ? ` (${[r.type, r.cr && `CR ${r.cr}`].filter(Boolean).join(', ')})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}`),
    '</world>',
    '<narrative>',
    renderList('Arcos', arcs.rows, r => `- ${r.title} [${r.status ?? 'sem status'}]${r.summary ? `: ${compact(r.summary, 280)}` : ''}`),
    renderList('Sessoes recentes', sessions.rows, r => {
      const number = r.session_number ? `#${r.session_number} ` : ''
      const arc = r.arc_title ? ` (${r.arc_title})` : ''
      const summary = compact(r.summary, 260)
      const dmNotes = safeMode === 'dm' ? compact(r.dm_notes, 220) : ''
      return `- ${number}${r.title}${arc}${summary ? `: ${summary}` : ''}${dmNotes ? ` Notas DM: ${dmNotes}` : ''}`
    }),
    renderList('Notas', notes.rows, r => `- ${r.title}${r.is_secret ? ' [secreta]' : ''}: ${compact(r.content, 260)}`),
    '</narrative>',
    '<cast>',
    renderList('Personagens', characters.rows, r => {
      const profile = [r.race, r.class, r.level && `nivel ${r.level}`].filter(Boolean).join(' ')
      return `- ${r.name}${profile ? ` (${profile})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}${safeMode === 'dm' && r.backstory ? ` Backstory: ${compact(r.backstory, 220)}` : ''}`
    }),
    renderList('NPCs', npcs.rows, r => {
      const profile = [r.race, r.role, r.is_alive === false ? 'morto' : null].filter(Boolean).join(', ')
      return `- ${r.name}${profile ? ` (${profile})` : ''}${r.description ? `: ${compact(r.description, 220)}` : ''}${r.personality ? ` Personalidade: ${compact(r.personality, 160)}` : ''}${safeMode === 'dm' && r.secrets ? ` Segredos: ${compact(r.secrets, 220)}` : ''}`
    }),
    '</cast>',
  ].filter(Boolean)

  const context = blocks.join('\n')
  return context.length > 12000 ? `${context.slice(0, 11950)}\n[contexto compactado]` : context
}
