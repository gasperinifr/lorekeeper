export async function ensureSchema(db) {
  await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

  await db.query(`
    CREATE TABLE IF NOT EXISTS campaign_invites (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
      invited_email VARCHAR(255),
      role          VARCHAR(50) NOT NULL DEFAULT 'viewer',
      play_role     VARCHAR(50) NOT NULL DEFAULT 'player',
      code          VARCHAR(32) UNIQUE NOT NULL,
      expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
      used_at       TIMESTAMPTZ,
      used_by       UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS spells (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name         VARCHAR(255) NOT NULL,
      level        INTEGER DEFAULT 0,
      school       VARCHAR(100),
      casting_time VARCHAR(120),
      range        VARCHAR(120),
      components   TEXT,
      duration     VARCHAR(120),
      description  TEXT,
      image_url    TEXT,
      source       VARCHAR(50) DEFAULT 'custom',
      source_key   VARCHAR(255),
      data         JSONB DEFAULT '{}',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await db.query('CREATE INDEX IF NOT EXISTS idx_invites_campaign ON campaign_invites(campaign_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_invites_code ON campaign_invites(code)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_spells_campaign ON spells(campaign_id)')
  await db.query("ALTER TABLE campaign_members ADD COLUMN IF NOT EXISTS play_role VARCHAR(50) NOT NULL DEFAULT 'player'")
  await db.query("ALTER TABLE campaign_invites ADD COLUMN IF NOT EXISTS play_role VARCHAR(50) NOT NULL DEFAULT 'player'")

  const visibilityTables = [
    'characters',
    'npcs',
    'locations',
    'items',
    'spells',
    'creatures',
    'notes',
    'arcs',
    'sessions',
    'encounters',
  ]
  for (const table of visibilityTables) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public'`)
    await db.query(`UPDATE ${table} SET visibility='public' WHERE visibility IS NULL`)
  }

  const audienceTables = ['characters', 'npcs', 'locations', 'items', 'spells', 'creatures', 'notes']
  for (const table of audienceTables) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_${table}_shared_user ON ${table}(campaign_id, shared_with_user_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_${table}_created_by ON ${table}(campaign_id, created_by)`)
  }

  await db.query('ALTER TABLE notes ADD COLUMN IF NOT EXISTS image_url TEXT')

  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      content     TEXT,
      image_url   TEXT,
      mentions    JSONB DEFAULT '[]',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query('CREATE INDEX IF NOT EXISTS idx_chat_campaign ON chat_messages(campaign_id, created_at)')

  await db.query(`
    CREATE TABLE IF NOT EXISTS oracle_messages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      role        VARCHAR(10) NOT NULL,
      content     TEXT NOT NULL,
      mode        VARCHAR(10) DEFAULT 'dm',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query('CREATE INDEX IF NOT EXISTS idx_oracle_campaign ON oracle_messages(campaign_id, created_at)')
}
