export interface User {
  id: string
  username: string
  email: string
  avatar_url?: string
  created_at: string
}

export interface Campaign {
  id: string
  owner_id: string
  title: string
  description?: string
  scenario_type?: string
  status: 'active' | 'paused' | 'completed'
  visibility: 'private' | 'unlisted' | 'public'
  cover_image_url?: string
  started_at?: string
  estimated_end_at?: string
  member_count?: number
  role?: 'admin' | 'editor' | 'viewer'
  play_role?: 'gm' | 'player'
  members?: CampaignMember[]
  created_at: string
  updated_at: string
}

export interface CampaignMember {
  id: string
  username: string
  role: 'admin' | 'editor' | 'viewer'
  play_role: 'gm' | 'player'
}

export interface Arc {
  id: string
  campaign_id: string
  title: string
  summary?: string
  status: 'upcoming' | 'active' | 'completed'
  visibility?: 'public' | 'private' | 'gm' | 'user'
  shared_with_user_id?: string | null
  sort_order: number
  started_at?: string | null
  ended_at?: string | null
  created_at?: string
  updated_at?: string
  session_count?: number
  sessions?: Session[]
}

export interface Session {
  id: string
  arc_id: string
  campaign_id: string
  title: string
  session_number?: number
  summary?: string
  dm_notes?: string
  played_at?: string
  duration_min?: number
  status: 'planned' | 'completed'
  visibility?: 'public' | 'private' | 'gm' | 'user'
  shared_with_user_id?: string | null
  encounter_count?: number
}

export interface EntityLink {
  id: string
  source_type: LinkableType
  source_id: string
  target_type: LinkableType
  target_id: string
  relation_label?: string
}

export interface ChatMention {
  type: LinkableType
  id: string
  label: string
  path: string
}

export interface ChatMessage {
  id: string
  campaign_id: string
  user_id?: string
  username?: string
  avatar_url?: string
  content?: string
  image_url?: string
  mentions?: ChatMention[]
  created_at: string
}

export type OracleMode = 'dm' | 'player'

export interface OracleMessage {
  id: string
  campaign_id: string
  user_id?: string | null
  username?: string
  role: 'user' | 'assistant'
  content: string
  mode: OracleMode
  created_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
}

// Tipo base para entidades do mundo
export interface WorldEntity {
  id: string
  campaign_id: string
  name?: string
  title?: string
  created_at: string
  updated_at: string
  links?: EntityLink[]
  tags?: Tag[]
  data?: Record<string, unknown>
  visibility?: 'public' | 'private'
}

export type EntityType = 'characters' | 'npcs' | 'locations' | 'items' | 'spells' | 'creatures' | 'notes'
export type LinkableType = EntityType | 'arcs' | 'sessions' | 'encounters' | 'events'

export type EventType =
  | 'batalha' | 'revelacao' | 'morte' | 'alianca' | 'descoberta'
  | 'traicao' | 'destruicao' | 'evento_magico' | 'politico' | 'outro'

export type EventImpact = 'menor' | 'significativo' | 'divisor'

export interface EventEntityLink {
  id: string
  event_id: string
  campaign_id: string
  entity_type: LinkableType
  entity_id: string
  role?: string
  created_at: string
}

export interface EntityEventLink extends EventEntityLink {
  event_title: string
  event_type: EventType
  event_impact: EventImpact
  event_date_in_world?: string | null
  event_visibility?: 'public' | 'private'
}

export interface CampaignEvent {
  id: string
  campaign_id: string
  session_id?: string | null
  arc_id?: string | null
  created_by?: string | null
  title: string
  type: EventType
  impact: EventImpact
  date_in_world?: string | null
  description?: string | null
  visibility: 'public' | 'private'
  data?: Record<string, unknown>
  session_title?: string
  arc_title?: string
  created_by_username?: string
  entity_links: EventEntityLink[]
  created_at: string
  updated_at: string
}

export interface PropagationConsequence {
  entity_type: string
  entity_id: string
  field: string
  value: unknown
  label?: string
}
