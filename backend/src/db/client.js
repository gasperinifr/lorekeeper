import '../env.js'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrada. Defina em backend/.env ou na raiz do projeto (.env).')
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

db.on('error', (err) => {
  console.error('Erro no PostgreSQL:', err)
  process.exit(-1)
})
