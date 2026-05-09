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

  await db.query('ALTER TABLE characters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)')
  await db.query('ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT true')
  await db.query("ALTER TABLE characters ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'")
  await db.query("ALTER TABLE npcs ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'")
  await db.query("ALTER TABLE locations ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'")
  await db.query("ALTER TABLE items ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'")
  await db.query("ALTER TABLE spells ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'")
  await db.query("ALTER TABLE creatures ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'")
  await db.query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cover_image_url TEXT')
  await db.query('ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS hub_banner_url TEXT')
  await db.query("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS hub_banner_fit VARCHAR(20) DEFAULT 'cover'")
  await db.query("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS hub_banner_position VARCHAR(50) DEFAULT 'center'")

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

  await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      session_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
      arc_id          UUID REFERENCES arcs(id) ON DELETE SET NULL,
      created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      title           VARCHAR(255) NOT NULL,
      type            VARCHAR(80)  NOT NULL DEFAULT 'outro',
      impact          VARCHAR(30)  NOT NULL DEFAULT 'significativo',
      date_in_world   VARCHAR(120),
      description     TEXT,
      visibility      VARCHAR(20)  DEFAULT 'public',
      data            JSONB        DEFAULT '{}',
      created_at      TIMESTAMPTZ  DEFAULT NOW(),
      updated_at      TIMESTAMPTZ  DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS event_entity_links (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      entity_type VARCHAR(50) NOT NULL,
      entity_id   UUID NOT NULL,
      role        VARCHAR(100),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(event_id, entity_type, entity_id)
    )
  `)

  await db.query('CREATE INDEX IF NOT EXISTS idx_events_campaign    ON events(campaign_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_events_session     ON events(session_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_events_arc         ON events(arc_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_events_type_impact ON events(campaign_id, type, impact)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_eel_event          ON event_entity_links(event_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_eel_entity         ON event_entity_links(campaign_id, entity_type, entity_id)')

  await db.query("ALTER TABLE entity_links ADD COLUMN IF NOT EXISTS relation_type VARCHAR(50) DEFAULT 'outro'")

  await db.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
      shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      name         VARCHAR(255) NOT NULL,
      type         VARCHAR(100),
      description  TEXT,
      headquarters TEXT,
      motto        TEXT,
      secrets      TEXT,
      image_url    TEXT,
      is_active    BOOLEAN DEFAULT true,
      visibility   VARCHAR(20) DEFAULT 'public',
      data         JSONB DEFAULT '{}',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS group_members (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      npc_id       UUID REFERENCES npcs(id) ON DELETE CASCADE,
      character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
      role         VARCHAR(100),
      is_secret    BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await db.query('ALTER TABLE groups ADD COLUMN IF NOT EXISTS shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL')
  await db.query("ALTER TABLE groups ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'")
  await db.query('CREATE INDEX IF NOT EXISTS idx_groups_campaign     ON groups(campaign_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_groups_shared_user  ON groups(campaign_id, shared_with_user_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_groups_created_by   ON groups(campaign_id, created_by)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_group_members_npc   ON group_members(campaign_id, npc_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_group_members_char  ON group_members(campaign_id, character_id)')
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique_npc ON group_members(group_id, npc_id) WHERE npc_id IS NOT NULL')
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_unique_char ON group_members(group_id, character_id) WHERE character_id IS NOT NULL')

  await db.query(`
    CREATE TABLE IF NOT EXISTS diary_messages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
      channel     VARCHAR(20) NOT NULL DEFAULT 'group',
      player_id   UUID REFERENCES users(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      image_url   TEXT,
      mentions    JSONB DEFAULT '[]',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query('ALTER TABLE diary_messages ADD COLUMN IF NOT EXISTS image_url TEXT')
  await db.query("ALTER TABLE diary_messages ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]'")
  await db.query('CREATE INDEX IF NOT EXISTS idx_diary_campaign       ON diary_messages(campaign_id, channel, created_at)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_diary_private_player ON diary_messages(campaign_id, player_id, created_at)')
}
