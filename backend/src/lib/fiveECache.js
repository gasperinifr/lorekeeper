const BASE = process.env.FIVEETOOLS_DATA_BASE
  ?? 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/master/data'
const IMAGE_BASE = process.env.FIVEETOOLS_IMAGE_BASE
  ?? 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main'
const cache = new Map()
const TTL   = 24 * 60 * 60 * 1000

async function fetchJson(path) {
  const now = Date.now()
  if (cache.has(path) && cache.get(path).expiresAt > now) return cache.get(path).data
  const res  = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`5etools fetch falhou: ${path} (${res.status})`)
  const data = await res.json()
  cache.set(path, { data, expiresAt: now + TTL })
  return data
}

async function getBestiarySources() {
  const index = await fetchJson('bestiary/index.json')
  return Object.values(index).map(file => `bestiary/${file}`)
}

async function getSpellSources() {
  const index = await fetchJson('spells/index.json')
  return Object.values(index).map(file => `spells/${file}`)
}

function collectFulfilled(results, key) {
  const data = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value[key] ?? [])
  if (!data.length && results.some(r => r.status === 'rejected')) {
    throw new Error('Nenhuma fonte 5etools respondeu com dados.')
  }
  return data
}

export async function getCreatures() {
  const sources = await getBestiarySources()
  const results = await Promise.allSettled(sources.map(fetchJson))
  return collectFulfilled(results, 'monster')
}

export async function getSpells() {
  const sources = await getSpellSources()
  const results = await Promise.allSettled(sources.map(fetchJson))
  return collectFulfilled(results, 'spell')
}

export async function getItems() {
  const data = await fetchJson('items.json')
  return data.item ?? []
}

function renderTag(tag, body) {
  const parts = body.split('|')
  const value = parts.at(-1) || parts[0] || ''
  const first = parts[0] || ''

  if (tag === 'atk') {
    const attackMap = {
      mw: 'Melee Weapon Attack:',
      rw: 'Ranged Weapon Attack:',
      ms: 'Melee Spell Attack:',
      rs: 'Ranged Spell Attack:',
      'mw,rw': 'Melee or Ranged Weapon Attack:',
      'ms,rs': 'Melee or Ranged Spell Attack:',
    }
    return attackMap[first] ?? value
  }
  if (tag === 'hit') return `+${first}`
  if (tag === 'h') return 'Hit: '
  if (tag === 'dc') return `DC ${first}`
  if (tag === 'recharge') return first ? `Recharge ${first}-6` : 'Recharge'
  if (['scaledamage', 'scaledice'].includes(tag)) return parts[2] || first
  if (['damage', 'dice', 'condition', 'spell', 'item', 'creature'].includes(tag)) return first
  return value
}

function clean5eText(text) {
  return text.replace(/\{@(\w+)(?:\s+([^}]+))?\}/g, (_, tag, body = '') => renderTag(tag, body))
}

function renderEntry(entry) {
  if (typeof entry === 'string') return entry
  if (!entry) return ''
  if (Array.isArray(entry)) return entry.map(renderEntry).filter(Boolean).join('\n')
  if (entry.type === 'list') return (entry.items ?? []).map(item => `- ${renderEntry(item)}`).join('\n')
  if (entry.type === 'entries') {
    const name = entry.name ? `${entry.name}. ` : ''
    return `${name}${(entry.entries ?? []).map(renderEntry).filter(Boolean).join(' ')}`
  }
  if (entry.type === 'item' || entry.type === 'itemSub') {
    const name = entry.name ? `${entry.name}. ` : ''
    return `${name}${renderEntry(entry.entries ?? entry.entry)}`
  }
  if (entry.entries) return renderEntry(entry.entries)
  if (entry.items) return renderEntry(entry.items)
  return ''
}

function renderNamedEntries(entries = []) {
  return entries.map(entry => ({
    name: entry.name ?? '',
    text: clean5eText(renderEntry(entry.entries ?? entry.entry ?? entry)),
  })).filter(entry => entry.name || entry.text)
}

function renderType(type) {
  if (!type) return ''
  if (typeof type === 'string') return type
  return [type.swarmSize ? `swarm of ${type.swarmSize}` : null, type.type, type.tags?.join(', ')]
    .filter(Boolean)
    .join(' ')
}

function renderCr(cr) {
  if (!cr) return ''
  if (typeof cr === 'object') return cr.cr ?? ''
  return String(cr)
}

function renderAc(ac = []) {
  return ac.map(part => {
    if (typeof part === 'number') return String(part)
    const from = part.from?.length ? ` (${part.from.join(', ')})` : ''
    return `${part.ac}${from}`
  }).join(', ')
}

function renderHp(hp) {
  if (!hp) return ''
  return [hp.average, hp.formula ? `(${hp.formula})` : null].filter(Boolean).join(' ')
}

function renderSpeed(speed = {}) {
  return Object.entries(speed).map(([key, value]) => {
    if (key === 'canHover') return null
    const amount = typeof value === 'object' ? value.number : value
    const condition = typeof value === 'object' && value.condition ? ` ${value.condition}` : ''
    return `${key} ${amount} ft.${condition}`
  }).filter(Boolean).join(', ')
}

function renderArray(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.map(v => typeof v === 'string' ? clean5eText(v) : clean5eText(renderEntry(v))).join(', ')
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k} ${v}`).join(', ')
  return String(value)
}

function renderAlignment(alignment = []) {
  const map = { L:'Lawful', N:'Neutral', C:'Chaotic', G:'Good', E:'Evil', A:'Any', U:'Unaligned' }
  return alignment.map(part => typeof part === 'string' ? (map[part] ?? part) : renderEntry(part)).join(' ')
}

function imageUrlForCreature(m) {
  if (!m.source || !m.name) return ''
  return `${IMAGE_BASE}/bestiary/${encodeURIComponent(m.source)}/${encodeURIComponent(m.name)}.webp`
}

function imageUrlForSpell(s) {
  if (!s.hasFluffImages || !s.source || !s.name) return ''
  return `${IMAGE_BASE}/spells/${encodeURIComponent(s.source)}/${encodeURIComponent(s.name)}.webp`
}

function renderSpellLevel(level) {
  if (level === 0) return 'Truque'
  if (level === 1) return '1º nível'
  return `${level}º nível`
}

function renderCastingTime(time = []) {
  return time.map(t => {
    const number = t.number ?? 1
    const unit = t.unit ?? ''
    const condition = t.condition ? `, ${clean5eText(t.condition)}` : ''
    return `${number} ${unit}${condition}`
  }).join(', ')
}

function renderRange(range) {
  if (!range) return ''
  if (!range.distance) return range.type ?? ''
  const amount = range.distance.amount
  const type = range.distance.type
  if (amount !== undefined) return `${amount} ${type}`
  return type ?? range.type ?? ''
}

function renderComponents(components = {}) {
  const parts = []
  if (components.v) parts.push('V')
  if (components.s) parts.push('S')
  if (components.m) {
    const material = typeof components.m === 'string'
      ? components.m
      : components.m.text ?? ''
    parts.push(material ? `M (${clean5eText(material)})` : 'M')
  }
  return parts.join(', ')
}

function renderDuration(duration = []) {
  return duration.map(d => {
    const concentration = d.concentration ? 'Concentração, ' : ''
    if (d.type === 'instant') return 'Instantânea'
    if (d.type === 'permanent') return 'Permanente'
    if (d.duration) return `${concentration}${d.duration.amount ?? ''} ${d.duration.type}`.trim()
    return `${concentration}${d.type ?? ''}`.trim()
  }).filter(Boolean).join(', ')
}

function renderValue(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'number') return `${value} cp`
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${v} ${k}`).join(', ')
  return String(value)
}

export function normalizeCreature(m) {
  const traits = renderNamedEntries(m.trait)
  const actions = renderNamedEntries(m.action)
  const bonus = renderNamedEntries(m.bonus)
  const reactions = renderNamedEntries(m.reaction)
  const legendary = renderNamedEntries(m.legendary)
  const description = [
    traits.length ? `Traits\n${traits.map(t => `${t.name}. ${t.text}`).join('\n\n')}` : '',
    actions.length ? `Actions\n${actions.map(a => `${a.name}. ${a.text}`).join('\n\n')}` : '',
    bonus.length ? `Bonus Actions\n${bonus.map(b => `${b.name}. ${b.text}`).join('\n\n')}` : '',
    reactions.length ? `Reactions\n${reactions.map(r => `${r.name}. ${r.text}`).join('\n\n')}` : '',
    legendary.length ? `Legendary Actions\n${legendary.map(l => `${l.name}. ${l.text}`).join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n')
  const image_url = imageUrlForCreature(m)

  return {
    name:        m.name,
    type:        renderType(m.type),
    cr:          renderCr(m.cr) || '—',
    description,
    image_url,
    source:      '5etools',
    source_key:  `${m.source}-${m.name}`,
    data: {
      statBlock: true,
      source: m.source,
      page: m.page,
      size: m.size,
      alignment: renderAlignment(m.alignment),
      ac: renderAc(m.ac),
      hp: m.hp?.average ?? null,
      hpText: renderHp(m.hp),
      speedText: renderSpeed(m.speed),
      speed: m.speed,
      str: m.str, dex: m.dex, con: m.con,
      int: m.int, wis: m.wis, cha: m.cha,
      save: m.save ?? {},
      skill: m.skill ?? {},
      vulnerable: renderArray(m.vulnerable),
      resist: renderArray(m.resist),
      immune: renderArray(m.immune),
      conditionImmune: renderArray(m.conditionImmune),
      senses: renderArray(m.senses),
      passive: m.passive,
      languages: renderArray(m.languages),
      traits,
      actions,
      bonus,
      reactions,
      legendary,
      raw: m,
    }
  }
}

export function normalizeSpell(s) {
  const schoolMap = { A:'Abjuração',C:'Conjuração',D:'Adivinhação',E:'Encantamento',
                      V:'Evocação',EV:'Evocação',I:'Ilusão',N:'Necromancia',T:'Transmutação' }
  const entries = clean5eText(renderEntry(s.entries))
  const higherLevel = renderNamedEntries(s.entriesHigherLevel)
  const description = [
    entries,
    ...higherLevel.map(e => `${e.name}. ${e.text}`),
  ].filter(Boolean).join('\n\n')
  const castingTime = renderCastingTime(s.time)
  const range = renderRange(s.range)
  const componentsText = renderComponents(s.components)
  const duration = renderDuration(s.duration)
  const school = schoolMap[s.school] ?? s.school

  return {
    name:        s.name,
    level:       s.level,
    school,
    casting_time: castingTime,
    range,
    components: componentsText,
    duration,
    description,
    image_url:   imageUrlForSpell(s),
    source:      '5etools',
    source_key:  `${s.source}-${s.name}`,
    data: {
      spellBlock: true,
      source:      s.source,
      page:        s.page,
      levelText:   renderSpellLevel(s.level),
      school,
      castingTime,
      range,
      components:  s.components,
      componentsText,
      duration,
      classes:     s.classes?.fromClassList?.map(c => c.name) ?? [],
      ritual:      s.meta?.ritual ?? false,
      concentration: s.duration?.some(d => d.concentration) ?? false,
      entries,
      higherLevel,
      damageInflict: renderArray(s.damageInflict),
      savingThrow: renderArray(s.savingThrow),
      raw: s,
    }
  }
}

export function normalizeItem(i) {
  const rarityMap = { none:'Comum',common:'Comum',uncommon:'Incomum',rare:'Raro',
                      'very rare':'Muito Raro',legendary:'Lendário',artifact:'Artefato',
                      'unknown (magic)':'Mágico, raridade desconhecida' }
  const typeMap = {
    A: 'Munição',
    AF: 'Foco arcano',
    AT: 'Ferramenta de artesão',
    G: 'Equipamento',
    GS: 'Kit de jogo',
    HA: 'Armadura pesada',
    INS: 'Instrumento',
    LA: 'Armadura leve',
    M: 'Arma',
    MA: 'Armadura média',
    P: 'Poção',
    R: 'Anel',
    RD: 'Bastão',
    RG: 'Anel',
    SC: 'Pergaminho',
    S: 'Escudo',
    ST: 'Cajado',
    T: 'Ferramenta',
    WD: 'Varinha',
    '$': 'Tesouro',
  }
  const description = clean5eText(renderEntry(i.entries))
  const type = typeMap[i.type] ?? i.type ?? 'Outro'
  const rarity = rarityMap[i.rarity] ?? i.rarity ?? 'Comum'

  return {
    name:        i.name,
    type,
    rarity,
    description,
    image_url:   '',
    source:      '5etools',
    source_key:  `${i.source}-${i.name}`,
    data: {
      itemBlock: true,
      source: i.source,
      page: i.page,
      type,
      rarity,
      requiresAttunement: !!i.reqAttune,
      attunementText: typeof i.reqAttune === 'string' ? clean5eText(i.reqAttune) : '',
      weight: i.weight,
      value: i.value,
      valueText: renderValue(i.value),
      properties: i.property ?? [],
      propertiesText: renderArray(i.property),
      weaponCategory: i.weaponCategory,
      damage: i.dmg1,
      damageType: i.dmgType,
      entries: description,
      raw: i,
    }
  }
}
