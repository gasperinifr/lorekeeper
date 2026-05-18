import { createClient } from 'redis'

export const TTL = {
  USER_PROFILE: 120,
  CAMPAIGN_ACCESS: 60,
  CAMPAIGN_DETAIL: 90,
  CAMPAIGN_LIST: 60,
  TAGS: 180,
  ARCS_SESSIONS: 120,
  ENTITY_LIST: 60,
  ENTITY_DETAIL: 90,
}

class CacheClient {
  constructor() {
    this._client = null
    this._ready = false
    this._initPromise = null
  }

  async _init() {
    const url = process.env.REDIS_URL || process.env.VALKEY_URL
    if (!url) return

    try {
      this._client = createClient({ url })
      this._client.on('error', (err) => {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[cache] Redis error (cache ignorado):', err.message)
        }
        this._ready = false
      })
      this._client.on('ready', () => {
        this._ready = true
        console.log('[cache] Redis/Valkey conectado')
      })
      this._client.on('end', () => {
        this._ready = false
      })

      await this._client.connect()
    } catch (err) {
      console.warn('[cache] Nao foi possivel conectar ao Redis. Cache desabilitado:', err.message)
      this._client = null
      this._ready = false
    }
  }

  async connect() {
    if (!this._initPromise) this._initPromise = this._init()
    return this._initPromise
  }

  async disconnect() {
    if (!this._client) return
    try {
      await this._client.quit()
    } catch {}
    this._client = null
    this._ready = false
    this._initPromise = null
  }

  get isReady() {
    return this._ready && this._client !== null
  }

  async get(key) {
    if (!this.isReady) return null
    try {
      const raw = await this._client.get(key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  async set(key, value, ttlSeconds) {
    if (!this.isReady) return
    try {
      await this._client.set(key, JSON.stringify(value), { EX: ttlSeconds })
    } catch {}
  }

  async del(...keys) {
    if (!this.isReady || !keys.length) return
    try {
      await this._client.del(keys)
    } catch {}
  }

  async delByPrefix(prefix) {
    if (!this.isReady) return
    try {
      let cursor = 0
      do {
        const reply = await this._client.scan(cursor, {
          MATCH: `${prefix}*`,
          COUNT: 100,
        })
        cursor = Number(reply.cursor)
        if (reply.keys.length) await this._client.del(reply.keys)
      } while (cursor !== 0)
    } catch {}
  }

  async getOrSet(key, ttl, fn) {
    const cached = await this.get(key)
    if (cached !== null) return cached

    const value = await fn()
    if (value !== undefined && value !== null) {
      await this.set(key, value, ttl)
    }
    return value
  }
}

export const cache = new CacheClient()

export const cacheKey = {
  userProfile: (userId) => `user:${userId}:profile`,
  campaignAccess: (campaignId, userId) => `campaign:${campaignId}:access:${userId}`,
  campaignDetail: (campaignId, userId) => `campaign:${campaignId}:detail:${userId}`,
  campaignList: (userId) => `user:${userId}:campaigns`,
  tags: (campaignId) => `campaign:${campaignId}:tags`,
  arcs: (campaignId, role) => `campaign:${campaignId}:arcs:${role}`,
  sessions: (campaignId, role) => `campaign:${campaignId}:sessions:${role}`,
  entityList: (campaignId, type, role, userId) => `campaign:${campaignId}:${type}:list:${role}:${userId}`,
  entityDetail: (campaignId, type, id, scope) => `campaign:${campaignId}:${type}:detail:${id}:${scope}`,
  entityDetailPrefix: (campaignId, type, id) => `campaign:${campaignId}:${type}:detail:${id}:`,
  campaignPrefix: (campaignId) => `campaign:${campaignId}:`,
  userPrefix: (userId) => `user:${userId}:`,
}
