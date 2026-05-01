CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50)  UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  scenario_type    VARCHAR(100),
  status           VARCHAR(50)  DEFAULT 'active',
  visibility       VARCHAR(50)  DEFAULT 'private',
  cover_image_url  TEXT,
  started_at       DATE,
  estimated_end_at DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  role        VARCHAR(50) NOT NULL DEFAULT 'viewer',
  play_role   VARCHAR(50) NOT NULL DEFAULT 'player',
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, user_id)
);

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
);

CREATE TABLE IF NOT EXISTS characters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id),
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  race         VARCHAR(100),
  class        VARCHAR(100),
  level        INTEGER DEFAULT 1,
  description  TEXT,
  backstory    TEXT,
  portrait_url TEXT,
  is_active    BOOLEAN DEFAULT true,
  visibility   VARCHAR(20) DEFAULT 'public',
  data         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS npcs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  role         VARCHAR(100),
  race         VARCHAR(100),
  description  TEXT,
  personality  TEXT,
  secrets      TEXT,
  portrait_url TEXT,
  is_alive     BOOLEAN DEFAULT true,
  visibility   VARCHAR(20) DEFAULT 'public',
  data         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES locations(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(100),
  description TEXT,
  image_url   TEXT,
  visibility  VARCHAR(20) DEFAULT 'public',
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(100),
  rarity      VARCHAR(50),
  description TEXT,
  properties  TEXT,
  image_url   TEXT,
  visibility  VARCHAR(20) DEFAULT 'public',
  source      VARCHAR(50) DEFAULT 'custom',
  source_key  VARCHAR(255),
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spells (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  level        INTEGER DEFAULT 0,
  school       VARCHAR(100),
  casting_time VARCHAR(120),
  range        VARCHAR(120),
  components   TEXT,
  duration     VARCHAR(120),
  description  TEXT,
  image_url    TEXT,
  visibility   VARCHAR(20) DEFAULT 'public',
  source       VARCHAR(50) DEFAULT 'custom',
  source_key   VARCHAR(255),
  data         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creatures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(100),
  cr          VARCHAR(10),
  description TEXT,
  image_url   TEXT,
  visibility  VARCHAR(20) DEFAULT 'public',
  source      VARCHAR(50) DEFAULT 'custom',
  source_key  VARCHAR(255),
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_with_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title       VARCHAR(255) NOT NULL,
  content     TEXT,
  image_url   TEXT,
  is_secret   BOOLEAN DEFAULT false,
  visibility  VARCHAR(20) DEFAULT 'public',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arcs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  summary     TEXT,
  status      VARCHAR(50) DEFAULT 'upcoming',
  visibility  VARCHAR(20) DEFAULT 'public',
  sort_order  INTEGER DEFAULT 0,
  started_at  DATE,
  ended_at    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arc_id         UUID NOT NULL REFERENCES arcs(id)      ON DELETE CASCADE,
  campaign_id    UUID NOT NULL REFERENCES campaigns(id)  ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  session_number INTEGER,
  summary        TEXT,
  dm_notes       TEXT,
  played_at      TIMESTAMPTZ,
  duration_min   INTEGER,
  status         VARCHAR(50) DEFAULT 'planned',
  visibility     VARCHAR(20) DEFAULT 'public',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encounters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty  VARCHAR(50),
  status      VARCHAR(50) DEFAULT 'planned',
  visibility  VARCHAR(20) DEFAULT 'public',
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  source_type    VARCHAR(50) NOT NULL,
  source_id      UUID NOT NULL,
  target_type    VARCHAR(50) NOT NULL,
  target_id      UUID NOT NULL,
  relation_label VARCHAR(100),
  relation_type  VARCHAR(50) DEFAULT 'outro',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_id, target_type, target_id)
);

ALTER TABLE entity_links ADD COLUMN IF NOT EXISTS relation_type VARCHAR(50) DEFAULT 'outro';

CREATE TABLE IF NOT EXISTS tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) DEFAULT '#6366f1',
  UNIQUE(campaign_id, name)
);

CREATE TABLE IF NOT EXISTS entity_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID NOT NULL,
  UNIQUE(tag_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  content     TEXT,
  image_url   TEXT,
  mentions    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oracle_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  role        VARCHAR(10) NOT NULL,
  content     TEXT NOT NULL,
  mode        VARCHAR(10) DEFAULT 'dm',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_owner     ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_members_campaign    ON campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_members_user        ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invites_campaign    ON campaign_invites(campaign_id);
CREATE INDEX IF NOT EXISTS idx_invites_code        ON campaign_invites(code);
CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_npcs_campaign       ON npcs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_locations_campaign  ON locations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent    ON locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_items_campaign      ON items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_spells_campaign     ON spells(campaign_id);
CREATE INDEX IF NOT EXISTS idx_creatures_campaign  ON creatures(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notes_campaign      ON notes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_arcs_campaign       ON arcs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sessions_arc        ON sessions(arc_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity  ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_chat_campaign       ON chat_messages(campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_campaign     ON oracle_messages(campaign_id, created_at);

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
);

CREATE TABLE IF NOT EXISTS event_entity_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID NOT NULL,
  role        VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_events_campaign    ON events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_session     ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_arc         ON events(arc_id);
CREATE INDEX IF NOT EXISTS idx_events_type_impact ON events(campaign_id, type, impact);
CREATE INDEX IF NOT EXISTS idx_eel_event          ON event_entity_links(event_id);
CREATE INDEX IF NOT EXISTS idx_eel_entity         ON event_entity_links(campaign_id, entity_type, entity_id);
