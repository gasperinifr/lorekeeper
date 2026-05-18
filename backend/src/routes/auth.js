import bcrypt from 'bcryptjs'
import { cache, cacheKey, TTL } from '../lib/cache.js'

export async function authRoutes(fastify) {
  const { db } = fastify

  const authenticate = async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: 'Não autenticado.' }) }
  }

  fastify.post('/register', async (req, reply) => {
    const { username, email, password } = req.body
    if (!username || !email || !password) return reply.status(400).send({ error: 'Campos obrigatórios ausentes.' })

    const existing = await db.query('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username])
    if (existing.rows.length) return reply.status(409).send({ error: 'Email ou username já em uso.' })

    const hash = await bcrypt.hash(password, 12)
    const { rows } = await db.query(
      `INSERT INTO users (username,email,password_hash) VALUES ($1,$2,$3) RETURNING id,username,email,created_at`,
      [username, email, hash]
    )
    const token = fastify.jwt.sign({ id: rows[0].id, username: rows[0].username })
    return reply.status(201).send({ user: rows[0], token })
  })

  fastify.post('/login', async (req, reply) => {
    const { email, password } = req.body
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email])
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' })
    }
    const token = fastify.jwt.sign({ id: rows[0].id, username: rows[0].username })
    return reply.send({ user: { id: rows[0].id, username: rows[0].username, email: rows[0].email }, token })
  })

  fastify.get('/me', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.user.id
    const key = cacheKey.userProfile(userId)

    const user = await cache.getOrSet(key, TTL.USER_PROFILE, async () => {
      const { rows } = await db.query(
        'SELECT id,username,email,avatar_url,created_at FROM users WHERE id=$1', [userId]
      )
      return rows[0] ?? null
    })

    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' })
    return reply.send(user)
  })

  fastify.patch('/me', { preHandler: authenticate }, async (req, reply) => {
    const username = String(req.body?.username ?? '').trim()
    if (username.length < 3 || username.length > 50) {
      return reply.status(400).send({ error: 'O nome de usuário deve ter entre 3 e 50 caracteres.' })
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(username)=LOWER($1) AND id<>$2',
      [username, req.user.id]
    )
    if (existing.rows.length) return reply.status(409).send({ error: 'Nome de usuário já em uso.' })

    const { rows } = await db.query(
      'UPDATE users SET username=$1 WHERE id=$2 RETURNING id,username,email,avatar_url,created_at',
      [username, req.user.id]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Usuário não encontrado.' })

    await cache.del(cacheKey.userProfile(req.user.id))

    const token = fastify.jwt.sign({ id: rows[0].id, username: rows[0].username })
    return reply.send({ user: rows[0], token })
  })
}
