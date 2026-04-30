import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

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