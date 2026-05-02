import pg from 'pg'
import dotenv from 'dotenv'
import { resolve } from 'node:path'

const { Pool } = pg

// Accept env files from both backend/.env and repo-root/.env.
// This avoids startup issues when running commands from different folders.
dotenv.config({ path: resolve(process.cwd(), '.env') })
dotenv.config({ path: resolve(process.cwd(), '..', '.env') })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL nao encontrada. Defina em backend/.env ou na raiz do projeto (.env).')
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