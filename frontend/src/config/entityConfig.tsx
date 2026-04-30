import { Users, Skull, Map, Package, Sword, Scroll, BookOpen } from 'lucide-react'
import type { EntityType } from '@/types'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'toggle'
  required?: boolean
  options?: string[]    // para select
  optionLabels?: Record<string, string>
  placeholder?: string
  rows?: number         // para textarea
  hint?: string
}

const VISIBILITY_FIELD: FieldDef = {
  key: 'visibility',
  label: 'Visibilidade',
  type: 'select',
  options: ['public', 'private', 'gm', 'user'],
  optionLabels: { public: 'Pública', private: 'Privada' },
}

export interface EntityConfig {
  label: string
  labelPlural: string
  icon: React.ElementType
  accentClass: string   // tailwind text color
  fields: FieldDef[]
  displayName: (e: any) => string
  displaySub:  (e: any) => string
  secretField?: string  // campo que é privado ao mestre
}

export const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  characters: {
    label: 'Personagem', labelPlural: 'Personagens',
    icon: Users, accentClass: 'text-sky-400',
    fields: [
      { key: 'name',        label: 'Nome',     type: 'text',     required: true },
      { key: 'race',        label: 'Raça',     type: 'text' },
      { key: 'class',       label: 'Classe',   type: 'text' },
      { key: 'level',       label: 'Nível',    type: 'number',   placeholder: '1' },
      { key: 'portrait_url', label: 'Imagem',  type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descrição',type: 'textarea', rows: 3 },
      { key: 'backstory',   label: 'História', type: 'textarea', rows: 5 },
      { key: 'is_active',   label: 'Ativo',    type: 'toggle' },
    ],
    displayName: e => e.name,
    displaySub:  e => [e.race, e.class, e.level ? `Nível ${e.level}` : null].filter(Boolean).join(' · '),
  },

  npcs: {
    label: 'NPC', labelPlural: 'NPCs',
    icon: Skull, accentClass: 'text-violet-400',
    fields: [
      { key: 'name',        label: 'Nome',          type: 'text',     required: true },
      { key: 'role',        label: 'Papel',          type: 'text',     placeholder: 'Mercador, Vilão, Aliado...' },
      { key: 'race',        label: 'Raça',           type: 'text' },
      { key: 'portrait_url', label: 'Imagem',        type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descrição',      type: 'textarea', rows: 3 },
      { key: 'personality', label: 'Personalidade',  type: 'textarea', rows: 3 },
      { key: 'secrets',     label: 'Segredos (DM)',  type: 'textarea', rows: 3, hint: 'Visível apenas ao mestre.' },
      { key: 'is_alive',    label: 'Vivo',           type: 'toggle' },
    ],
    displayName: e => e.name,
    displaySub:  e => [e.role, e.race, e.is_alive === false ? '† Morto' : null].filter(Boolean).join(' · '),
    secretField: 'secrets',
  },

  locations: {
    label: 'Local', labelPlural: 'Locais',
    icon: Map, accentClass: 'text-emerald-400',
    fields: [
      { key: 'name',        label: 'Nome',  type: 'text',     required: true },
      { key: 'type',        label: 'Tipo',  type: 'select',
        options: ['Cidade', 'Vila', 'Taverna', 'Castelo', 'Dungeon', 'Floresta', 'Ruína', 'Planície', 'Porto', 'Outro'] },
      { key: 'image_url',   label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descrição', type: 'textarea', rows: 4 },
    ],
    displayName: e => e.name,
    displaySub:  e => e.type ?? '',
  },

  items: {
    label: 'Item', labelPlural: 'Itens',
    icon: Package, accentClass: 'text-amber-400',
    fields: [
      { key: 'name',        label: 'Nome',       type: 'text',     required: true },
      { key: 'type',        label: 'Tipo',        type: 'select',
        options: ['Arma', 'Armadura', 'Artefato', 'Consumível', 'Ferramenta', 'Tesouro', 'Outro'] },
      { key: 'rarity',      label: 'Raridade',   type: 'select',
        options: ['Comum', 'Incomum', 'Raro', 'Muito Raro', 'Lendário', 'Artefato'] },
      { key: 'image_url',   label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descrição',  type: 'textarea', rows: 3 },
      { key: 'properties',  label: 'Propriedades', type: 'textarea', rows: 3 },
    ],
    displayName: e => e.name,
    displaySub:  e => [e.rarity, e.type].filter(Boolean).join(' · '),
  },

  spells: {
    label: 'Magia', labelPlural: 'Magias',
    icon: BookOpen, accentClass: 'text-cyan-300',
    fields: [
      { key: 'name',         label: 'Nome',       type: 'text',   required: true },
      { key: 'level',        label: 'Nível',      type: 'number', placeholder: '0' },
      { key: 'school',       label: 'Escola',     type: 'select',
        options: ['Abjuração', 'Conjuração', 'Adivinhação', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação'] },
      { key: 'casting_time', label: 'Conjuração', type: 'text' },
      { key: 'range',        label: 'Alcance',    type: 'text' },
      { key: 'components',   label: 'Componentes',type: 'text' },
      { key: 'duration',     label: 'Duração',    type: 'text' },
      { key: 'image_url',    label: 'URL da imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description',  label: 'Descrição',  type: 'textarea', rows: 5 },
    ],
    displayName: e => e.name,
    displaySub:  e => [e.level === 0 ? 'Truque' : e.level !== undefined && e.level !== null ? `Nível ${e.level}` : null, e.school].filter(Boolean).join(' · '),
  },

  creatures: {
    label: 'Criatura', labelPlural: 'Criaturas',
    icon: Sword, accentClass: 'text-rose-400',
    fields: [
      { key: 'name',        label: 'Nome',   type: 'text',     required: true },
      { key: 'type',        label: 'Tipo',   type: 'select',
        options: ['Aberração', 'Besta', 'Celestial', 'Construto', 'Dragão', 'Elemental', 'Fada', 'Fiend', 'Gigante', 'Humanoide', 'Morto-Vivo', 'Monstruosidade', 'Planta', 'Slime', 'Outro'] },
      { key: 'cr',          label: 'CR',     type: 'text',     placeholder: '1/4, 1, 5, 20...' },
      { key: 'image_url',   label: 'URL da imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descrição', type: 'textarea', rows: 4 },
    ],
    displayName: e => e.name,
    displaySub:  e => [e.type, e.cr ? `CR ${e.cr}` : null].filter(Boolean).join(' · '),
  },

  notes: {
    label: 'Nota', labelPlural: 'Notas',
    icon: Scroll, accentClass: 'text-parchment/60',
    fields: [
      { key: 'title',   label: 'Título',   type: 'text',     required: true },
      { key: 'image_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'content', label: 'Conteúdo', type: 'textarea', rows: 12, placeholder: 'Suporta Markdown...' },
      { key: 'is_secret', label: 'Secreto (só DM)', type: 'toggle' },
    ],
    displayName: e => e.title,
    displaySub:  e => e.is_secret ? '🔒 Secreto' : '',
  },
}

export const ENTITY_TYPES = Object.keys(ENTITY_CONFIG) as EntityType[]
