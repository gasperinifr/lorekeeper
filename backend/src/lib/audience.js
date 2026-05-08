export const LINKABLE_TABLES = {
  characters: { table: 'characters' },
  npcs: { table: 'npcs' },
  locations: { table: 'locations' },
  items: { table: 'items' },
  spells: { table: 'spells' },
  creatures: { table: 'creatures' },
  notes: { table: 'notes' },
  arcs: { table: 'arcs', legacyVisibility: true },
  sessions: { table: 'sessions', legacyVisibility: true },
  encounters: { table: 'encounters', legacyVisibility: true },
  events: { table: 'events', legacyVisibility: true },
}

const PRIVATE_DATA_KEYS = new Set([
  'dm_notes',
  'plot_hook',
  'secret',
  'secrets',
  'curse',
])

export function isAdmin(req) {
  return req.campaignRole === 'admin'
}

export function isGm(req) {
  return req.campaignPlayRole === 'gm'
}

export function isEditor(req) {
  return req.campaignRole === 'editor'
}

export function canViewDm(req) {
  return isAdmin(req) || isGm(req)
}

export function sanitizePrivateData(data, req) {
  if (canViewDm(req) || !data || typeof data !== 'object' || Array.isArray(data)) return data
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !PRIVATE_DATA_KEYS.has(key))
  )
}

export function protectPrivateWrite(body, req, existing = {}) {
  if (canViewDm(req)) return body
  const next = { ...body }
  delete next.secrets
  if (next.data && typeof next.data === 'object' && !Array.isArray(next.data)) {
    const safeData = sanitizePrivateData(next.data, req)
    const existingData = existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
      ? Object.fromEntries(Object.entries(existing.data).filter(([key]) => PRIVATE_DATA_KEYS.has(key)))
      : {}
    next.data = { ...safeData, ...existingData }
  }
  return next
}

export function sanitizeEntityRow(row, req, table = '') {
  if (!row) return row
  const next = { ...row }
  if (!canViewDm(req)) {
    delete next.secrets
    if (table === 'sessions') delete next.dm_notes
  }
  if (next.data !== undefined) next.data = sanitizePrivateData(next.data, req)
  return next
}

export function sanitizeEntityRows(rows, req, table = '') {
  return rows.map(row => sanitizeEntityRow(row, req, table))
}

export function buildAudienceFilter(tableOrCfg, req, startIdx = 1, alias = '', includeSharedTarget = true) {
  const cfg = typeof tableOrCfg === 'string' ? LINKABLE_TABLES[tableOrCfg] : tableOrCfg
  if (!cfg || isAdmin(req)) return { sql: '', vals: [], nextIdx: startIdx }
  if (cfg.legacyVisibility && isEditor(req)) return { sql: '', vals: [], nextIdx: startIdx }

  const p = alias ? `${alias}.` : ''
  const vals = []
  let i = startIdx
  const rules = [`${p}visibility='public'`]

  if (!cfg.legacyVisibility) {
    if (isEditor(req)) rules.push(`${p}visibility='private'`)
    if (isGm(req)) rules.push(`${p}visibility IN ('gm','user')`)
    rules.push(`${p}created_by=$${i++}`)
    vals.push(req.user.id)
    if (includeSharedTarget) {
      rules.push(`${p}shared_with_user_id=$${i++}`)
      vals.push(req.user.id)
    }
  }

  let sql = `AND (${rules.join(' OR ')})`
  if (cfg.table === 'notes' && !canViewDm(req)) {
    sql += ` AND ${p}is_secret=false`
  }

  return { sql, vals, nextIdx: i }
}

export async function canReadLinkable(db, req, type, id, campaignId = req.params.campaignId) {
  const cfg = LINKABLE_TABLES[type]
  if (!cfg) return false
  if (type === 'sessions' && !isAdmin(req) && !isEditor(req)) {
    const { rows } = await db.query(
      `SELECT s.id FROM sessions s
       JOIN arcs a ON a.id=s.arc_id
       WHERE s.id=$1 AND s.campaign_id=$2 AND s.visibility='public' AND a.visibility='public'`,
      [id, campaignId]
    )
    return rows.length > 0
  }
  if (type === 'encounters' && !isAdmin(req) && !isEditor(req)) {
    const { rows } = await db.query(
      `SELECT e.id FROM encounters e
       JOIN sessions s ON s.id=e.session_id
       JOIN arcs a ON a.id=s.arc_id
       WHERE e.id=$1 AND e.campaign_id=$2
         AND e.visibility='public' AND s.visibility='public' AND a.visibility='public'`,
      [id, campaignId]
    )
    return rows.length > 0
  }
  const access = buildAudienceFilter(cfg, req, 3)
  const { rows } = await db.query(
    `SELECT id FROM ${cfg.table} WHERE id=$1 AND campaign_id=$2 ${access.sql}`,
    [id, campaignId, ...access.vals]
  )
  return rows.length > 0
}

export async function filterVisibleLinks(db, req, links, campaignId = req.params.campaignId) {
  const visible = []
  for (const link of links) {
    const [sourceVisible, targetVisible] = await Promise.all([
      canReadLinkable(db, req, link.source_type, link.source_id, campaignId),
      canReadLinkable(db, req, link.target_type, link.target_id, campaignId),
    ])
    if (sourceVisible && targetVisible) visible.push(link)
  }
  return visible
}

export async function filterVisibleEventEntityLinks(db, req, links, campaignId = req.params.campaignId) {
  const visible = []
  for (const link of links) {
    if (await canReadLinkable(db, req, link.entity_type, link.entity_id, campaignId)) visible.push(link)
  }
  return visible
}
