import bcrypt from 'bcrypt'

export async function authRoutes(fastify) {
  const { db } = fastify

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

  fastify.get('/me', { preHandler: async (req, reply) => {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ error: 'Não autenticado.' }) }
  }}, async (req, reply) => {
    const { rows } = await db.query(
      'SELECT id,username,email,avatar_url,created_at FROM users WHERE id=$1', [req.user.id]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Usuário não encontrado.' })
    return reply.send(rows[0])
  })
}
