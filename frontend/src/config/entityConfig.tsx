import { Users, Skull, Map, Sword, Bug, Scroll, BookOpen } from 'lucide-react'
import type { EntityType } from '@/types'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'toggle' | 'tags-input' | 'slider'
  required?: boolean
  options?: string[]
  optionLabels?: Record<string, string>
  placeholder?: string
  rows?: number
  hint?: string
  sliderMin?: number
  sliderMax?: number
  sliderLabels?: [string, string]
}

export interface SectionDef {
  key: string
  label: string
  fields: FieldDef[]
  defaultCollapsed?: boolean
}

const VISIBILITY_FIELD: FieldDef = {
  key: 'visibility',
  label: 'Visibilidade',
  type: 'select',
  options: ['public', 'private', 'gm', 'user'],
  optionLabels: { public: 'Publica', private: 'Privada' },
}

export interface EntityConfig {
  label: string
  labelPlural: string
  icon: React.ElementType
  accentClass: string
  fields: FieldDef[]
  sections?: SectionDef[]
  displayName: (e: any) => string
  displaySub: (e: any) => string
  secretField?: string
}

export const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  characters: {
    label: 'Personagem', labelPlural: 'Personagens',
    icon: Users, accentClass: 'text-sky-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'race', label: 'Raca', type: 'text' },
      { key: 'class', label: 'Classe', type: 'text' },
      { key: 'level', label: 'Nivel', type: 'number', placeholder: '1' },
      { key: 'portrait_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descricao', type: 'textarea', rows: 3 },
      { key: 'is_active', label: 'Ativo', type: 'toggle' },
    ],
    sections: [
      {
        key: 'background', label: 'Historia & Tracos',
        defaultCollapsed: false,
        fields: [
          { key: 'backstory', label: 'Historia', type: 'textarea', rows: 5 },
          { key: 'data.personality_traits', label: 'Tracos de personalidade', type: 'textarea', rows: 2 },
          { key: 'data.ideals', label: 'Ideais', type: 'text' },
          { key: 'data.bonds', label: 'Vinculos', type: 'text' },
          { key: 'data.flaws', label: 'Fraquezas', type: 'text' },
        ],
      },
      {
        key: 'notes', label: 'Notas do Jogador',
        defaultCollapsed: true,
        fields: [
          { key: 'data.player_notes', label: 'Notas pessoais', type: 'textarea', rows: 4 },
          { key: 'data.goals', label: 'Objetivos atuais', type: 'textarea', rows: 2 },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => [e.race, e.class, e.level ? `Nivel ${e.level}` : null].filter(Boolean).join(' · '),
  },

  npcs: {
    label: 'NPC', labelPlural: 'NPCs',
    icon: Skull, accentClass: 'text-violet-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'role', label: 'Papel', type: 'text', placeholder: 'Mercador, Vilao, Aliado...' },
      { key: 'race', label: 'Raca', type: 'text' },
      { key: 'portrait_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'is_alive', label: 'Vivo', type: 'toggle' },
    ],
    sections: [
      {
        key: 'identity', label: 'Identidade & Aparencia',
        defaultCollapsed: false,
        fields: [
          { key: 'description', label: 'Descricao', type: 'textarea', rows: 3 },
          { key: 'data.age', label: 'Idade', type: 'text', placeholder: 'Ex: ~50 anos, "anciao"' },
          { key: 'data.appearance', label: 'Aparencia', type: 'textarea', rows: 2, placeholder: 'Tracos fisicos marcantes, vestimenta...' },
          { key: 'data.voice', label: 'Voz & Fala', type: 'text', placeholder: 'Tom, sotaque, maneirismos de fala...' },
        ],
      },
      {
        key: 'psychology', label: 'Psicologia',
        defaultCollapsed: false,
        fields: [
          { key: 'personality', label: 'Personalidade', type: 'textarea', rows: 2 },
          { key: 'data.motivation', label: 'Motivacao', type: 'textarea', rows: 2, placeholder: 'O que esse NPC quer, no fundo?' },
          { key: 'data.fear', label: 'Medo / Fraqueza', type: 'text', placeholder: 'O que ele teme ou o que o paralisa?' },
          { key: 'data.mannerism', label: 'Maneirismo', type: 'text', placeholder: 'Um habito, tique ou comportamento marcante' },
        ],
      },
      {
        key: 'secrets', label: 'Segredos & DM',
        defaultCollapsed: true,
        fields: [
          { key: 'secrets', label: 'Segredos (DM)', type: 'textarea', rows: 3, hint: 'Visivel apenas ao mestre.' },
          { key: 'data.dm_notes', label: 'Notas do DM', type: 'textarea', rows: 2 },
          { key: 'data.plot_hook', label: 'Gancho narrativo', type: 'textarea', rows: 2, placeholder: 'Como esse NPC pode mover a historia?' },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => [e.role, e.race, e.is_alive === false ? 'Morto' : null].filter(Boolean).join(' · '),
    secretField: 'secrets',
  },

  locations: {
    label: 'Local', labelPlural: 'Locais',
    icon: Map, accentClass: 'text-emerald-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'select',
        options: ['Cidade', 'Vila', 'Taverna', 'Castelo', 'Dungeon', 'Floresta', 'Ruina', 'Planicie', 'Porto', 'Outro'] },
      { key: 'image_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
    ],
    sections: [
      {
        key: 'description', label: 'Descricao & Atmosfera',
        defaultCollapsed: false,
        fields: [
          { key: 'description', label: 'Descricao', type: 'textarea', rows: 3 },
          { key: 'data.atmosphere', label: 'Atmosfera', type: 'textarea', rows: 2, placeholder: 'Cheiros, sons, iluminacao, sensacao geral...' },
          { key: 'data.climate', label: 'Clima', type: 'text', placeholder: 'Ex: arido, temperado, perpetuamente nebuloso...' },
        ],
      },
      {
        key: 'lore', label: 'Lore & Contexto',
        defaultCollapsed: true,
        fields: [
          { key: 'data.history', label: 'Historia', type: 'textarea', rows: 3, placeholder: 'Origem, eventos passados marcantes...' },
          { key: 'data.culture', label: 'Cultura local', type: 'textarea', rows: 2, placeholder: 'Costumes, crencas, linguagem local...' },
          { key: 'data.rulers', label: 'Governantes / Faccoes', type: 'textarea', rows: 2 },
        ],
      },
      {
        key: 'gameplay', label: 'Gameplay',
        defaultCollapsed: true,
        fields: [
          { key: 'data.dangers', label: 'Perigos', type: 'textarea', rows: 2, placeholder: 'Criaturas, armadilhas, faccoes hostis...' },
          { key: 'data.plot_hook', label: 'Gancho narrativo', type: 'textarea', rows: 2 },
          { key: 'data.dm_notes', label: 'Notas do DM', type: 'textarea', rows: 2 },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => e.type ?? '',
  },

  items: {
    label: 'Item', labelPlural: 'Itens',
    icon: Sword, accentClass: 'text-amber-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'select',
        options: ['Arma', 'Armadura', 'Artefato', 'Consumivel', 'Ferramenta', 'Tesouro', 'Outro'] },
      { key: 'rarity', label: 'Raridade', type: 'select',
        options: ['Comum', 'Incomum', 'Raro', 'Muito Raro', 'Lendario', 'Artefato'] },
      { key: 'image_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
    ],
    sections: [
      {
        key: 'description', label: 'Descricao & Propriedades',
        defaultCollapsed: false,
        fields: [
          { key: 'description', label: 'Descricao', type: 'textarea', rows: 3 },
          { key: 'properties', label: 'Propriedades', type: 'textarea', rows: 3 },
          { key: 'data.appearance', label: 'Aparencia fisica', type: 'textarea', rows: 2, placeholder: 'Material, forma, inscricoes...' },
        ],
      },
      {
        key: 'lore', label: 'Lore & Historia',
        defaultCollapsed: true,
        fields: [
          { key: 'data.history', label: 'Historia do item', type: 'textarea', rows: 3, placeholder: 'Quem o criou, quem ja o portou...' },
          { key: 'data.curse', label: 'Maldicao / efeito oculto', type: 'textarea', rows: 2 },
          { key: 'data.dm_notes', label: 'Notas do DM', type: 'textarea', rows: 2 },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => [e.rarity, e.type].filter(Boolean).join(' · '),
  },

  spells: {
    label: 'Magia', labelPlural: 'Magias',
    icon: BookOpen, accentClass: 'text-cyan-300',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'level', label: 'Nivel', type: 'number', placeholder: '0' },
      { key: 'school', label: 'Escola', type: 'select',
        options: ['Abjuracao', 'Conjuracao', 'Adivinhacao', 'Encantamento', 'Evocacao', 'Ilusao', 'Necromancia', 'Transmutacao'] },
      { key: 'casting_time', label: 'Conjuracao', type: 'text' },
      { key: 'range', label: 'Alcance', type: 'text' },
      { key: 'components', label: 'Componentes', type: 'text' },
      { key: 'duration', label: 'Duracao', type: 'text' },
      { key: 'image_url', label: 'URL da imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descricao', type: 'textarea', rows: 5 },
    ],
    displayName: e => e.name,
    displaySub: e => [e.level === 0 ? 'Truque' : e.level !== undefined && e.level !== null ? `Nivel ${e.level}` : null, e.school].filter(Boolean).join(' · '),
  },

  creatures: {
    label: 'Criatura', labelPlural: 'Criaturas',
    icon: Bug, accentClass: 'text-rose-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'select',
        options: ['Aberracao','Besta','Celestial','Construto','Dragao','Elemental','Fada','Fiend','Gigante','Humanoide','Morto-Vivo','Monstruosidade','Planta','Slime','Outro'] },
      { key: 'cr', label: 'CR', type: 'text', placeholder: '1/4, 1, 5, 20...' },
      { key: 'image_url', label: 'URL da imagem', type: 'text' },
      VISIBILITY_FIELD,
    ],
    sections: [
      {
        key: 'description', label: 'Descricao & Comportamento',
        defaultCollapsed: false,
        fields: [
          { key: 'description', label: 'Descricao', type: 'textarea', rows: 3 },
          { key: 'data.behavior', label: 'Comportamento', type: 'textarea', rows: 2, placeholder: 'Solitaria, em matilha, territorial...' },
          { key: 'data.habitat', label: 'Habitat', type: 'text', placeholder: 'Onde vive, onde e encontrada' },
          {
            key: 'data.threat_level',
            label: 'Nivel de ameaca percebido',
            type: 'slider',
            sliderMin: 1, sliderMax: 5,
            sliderLabels: ['Inofensiva', 'Devastadora'],
          },
        ],
      },
      {
        key: 'combat', label: 'Combate & Taticas',
        defaultCollapsed: true,
        fields: [
          { key: 'data.tactics', label: 'Taticas de combate', type: 'textarea', rows: 3 },
          { key: 'data.weaknesses', label: 'Fraquezas', type: 'text' },
          { key: 'data.loot', label: 'Loot / Recompensas', type: 'textarea', rows: 2 },
          { key: 'data.dm_notes', label: 'Notas do DM', type: 'textarea', rows: 2 },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => [e.type, e.cr ? `CR ${e.cr}` : null].filter(Boolean).join(' · '),
  },

  notes: {
    label: 'Nota', labelPlural: 'Notas',
    icon: Scroll, accentClass: 'text-parchment/60',
    fields: [
      { key: 'title', label: 'Titulo', type: 'text', required: true },
      { key: 'image_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'content', label: 'Conteudo', type: 'textarea', rows: 12, placeholder: 'Suporta Markdown...' },
      { key: 'is_secret', label: 'Secreto (so DM)', type: 'toggle' },
    ],
    displayName: e => e.title,
    displaySub: e => e.is_secret ? 'Secreto' : '',
  },
}

export const ENTITY_TYPES = Object.keys(ENTITY_CONFIG) as EntityType[]
