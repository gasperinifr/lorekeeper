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
  optionLabels: { public: 'Pública', private: 'Privada' },
}

const DND_CLASSES = [
  'Bárbaro', 'Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro',
  'Guerreiro', 'Ladino', 'Mago', 'Monge', 'Paladino', 'Patrulheiro',
]

const DND_ABILITIES: FieldDef[] = [
  { key: 'data.str', label: 'Força', type: 'number', placeholder: '10' },
  { key: 'data.dex', label: 'Destreza', type: 'number', placeholder: '10' },
  { key: 'data.con', label: 'Constituição', type: 'number', placeholder: '10' },
  { key: 'data.int', label: 'Inteligência', type: 'number', placeholder: '10' },
  { key: 'data.wis', label: 'Sabedoria', type: 'number', placeholder: '10' },
  { key: 'data.cha', label: 'Carisma', type: 'number', placeholder: '10' },
]

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
      { key: 'data.player_name', label: 'Nome do jogador', type: 'text', placeholder: 'Nome de quem joga este personagem' },
      { key: 'race', label: 'Raça / linhagem', type: 'text', placeholder: 'Humano, elfo, anão...' },
      { key: 'class', label: 'Classe', type: 'select', options: DND_CLASSES },
      { key: 'level', label: 'Nível', type: 'number', placeholder: '1' },
      { key: 'portrait_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descrição', type: 'textarea', rows: 3 },
      { key: 'is_alive', label: 'Vivo', type: 'toggle' },
      { key: 'is_active', label: 'Ativo', type: 'toggle' },
    ],
    sections: [
      {
        key: 'background', label: 'História & Traços',
        defaultCollapsed: false,
        fields: [
          { key: 'data.background', label: 'Antecedente', type: 'text', placeholder: 'Acólito, criminoso, erudito...' },
          { key: 'backstory', label: 'História', type: 'textarea', rows: 5 },
          { key: 'data.personality_traits', label: 'Traços de personalidade', type: 'textarea', rows: 2 },
          { key: 'data.ideals', label: 'Ideais', type: 'text' },
          { key: 'data.bonds', label: 'Vínculos', type: 'text' },
          { key: 'data.flaws', label: 'Fraquezas', type: 'text' },
        ],
      },
      {
        key: 'sheet', label: 'Ficha 5e',
        defaultCollapsed: false,
        fields: [
          ...DND_ABILITIES,
          { key: 'data.armor_class', label: 'Classe de Armadura', type: 'number', placeholder: '10' },
          { key: 'data.hit_points', label: 'Pontos de Vida', type: 'text', placeholder: 'Ex: 12/12' },
          { key: 'data.speed', label: 'Deslocamento', type: 'text', placeholder: '9 m / 30 ft.' },
          { key: 'data.proficiency_bonus', label: 'Bônus de proficiência', type: 'text', placeholder: '+2' },
          { key: 'data.saving_throws', label: 'Salvaguardas', type: 'text', placeholder: 'FOR +4, CON +4' },
          { key: 'data.skills', label: 'Perícias', type: 'textarea', rows: 2 },
          { key: 'data.proficiencies', label: 'Proficiências', type: 'textarea', rows: 2 },
          { key: 'data.equipment', label: 'Equipamento', type: 'textarea', rows: 3 },
          { key: 'data.features', label: 'Características de classe/raça', type: 'textarea', rows: 4 },
          { key: 'data.spellcasting', label: 'Conjuração', type: 'textarea', rows: 3 },
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
    displaySub: e => [e.data?.player_name ? `Jogador: ${e.data.player_name}` : null, e.race, e.class, e.level ? `Nível ${e.level}` : null, e.is_alive === false ? 'Morto' : null].filter(Boolean).join(' - '),
  },

  npcs: {
    label: 'NPC', labelPlural: 'NPCs',
    icon: Skull, accentClass: 'text-violet-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'role', label: 'Papel', type: 'text', placeholder: 'Mercador, vilão, aliado...' },
      { key: 'race', label: 'Raça', type: 'text' },
      { key: 'portrait_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'is_alive', label: 'Vivo', type: 'toggle' },
    ],
    sections: [
      {
        key: 'identity', label: 'Identidade & Aparência',
        defaultCollapsed: false,
        fields: [
          { key: 'description', label: 'Descrição', type: 'textarea', rows: 3 },
          { key: 'data.age', label: 'Idade', type: 'text', placeholder: 'Ex: ~50 anos, "ancião"' },
          { key: 'data.appearance', label: 'Aparência', type: 'textarea', rows: 2, placeholder: 'Traços físicos marcantes, vestimenta...' },
          { key: 'data.voice', label: 'Voz & Fala', type: 'text', placeholder: 'Tom, sotaque, maneirismos de fala...' },
        ],
      },
      {
        key: 'psychology', label: 'Psicologia',
        defaultCollapsed: false,
        fields: [
          { key: 'personality', label: 'Personalidade', type: 'textarea', rows: 2 },
          { key: 'data.motivation', label: 'Motivação', type: 'textarea', rows: 2, placeholder: 'O que esse NPC quer, no fundo?' },
          { key: 'data.fear', label: 'Medo / Fraqueza', type: 'text', placeholder: 'O que ele teme ou o que o paralisa?' },
          { key: 'data.mannerism', label: 'Maneirismo', type: 'text', placeholder: 'Um hábito, tique ou comportamento marcante' },
        ],
      },
      {
        key: 'secrets', label: 'Segredos & DM',
        defaultCollapsed: true,
        fields: [
          { key: 'secrets', label: 'Segredos (DM)', type: 'textarea', rows: 3, hint: 'Visível apenas ao mestre.' },
          { key: 'data.dm_notes', label: 'Notas do DM', type: 'textarea', rows: 2 },
          { key: 'data.plot_hook', label: 'Gancho narrativo', type: 'textarea', rows: 2, placeholder: 'Como esse NPC pode mover a historia?' },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => [e.role, e.race, e.is_alive === false ? 'Morto' : null].filter(Boolean).join(' - '),
    secretField: 'secrets',
  },

  locations: {
    label: 'Local', labelPlural: 'Locais',
    icon: Map, accentClass: 'text-emerald-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'select',
        options: ['Cidade', 'Vila', 'Taverna', 'Castelo', 'Dungeon', 'Floresta', 'Ruína', 'Planície', 'Porto', 'Outro'] },
      { key: 'image_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
    ],
    sections: [
      {
        key: 'description', label: 'Descrição & Atmosfera',
        defaultCollapsed: false,
        fields: [
          { key: 'description', label: 'Descrição', type: 'textarea', rows: 3 },
          { key: 'data.atmosphere', label: 'Atmosfera', type: 'textarea', rows: 2, placeholder: 'Cheiros, sons, iluminação, sensação geral...' },
          { key: 'data.climate', label: 'Clima', type: 'text', placeholder: 'Ex: árido, temperado, perpetuamente nebuloso...' },
        ],
      },
      {
        key: 'lore', label: 'Lore & Contexto',
        defaultCollapsed: true,
        fields: [
          { key: 'data.history', label: 'História', type: 'textarea', rows: 3, placeholder: 'Origem, eventos passados marcantes...' },
          { key: 'data.culture', label: 'Cultura local', type: 'textarea', rows: 2, placeholder: 'Costumes, crenças, linguagem local...' },
          { key: 'data.rulers', label: 'Governantes / Facções', type: 'textarea', rows: 2 },
        ],
      },
      {
        key: 'gameplay', label: 'Gameplay',
        defaultCollapsed: true,
        fields: [
          { key: 'data.dangers', label: 'Perigos', type: 'textarea', rows: 2, placeholder: 'Criaturas, armadilhas, facções hostis...' },
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
        options: ['Arma', 'Armadura', 'Artefato', 'Consumível', 'Ferramenta', 'Tesouro', 'Outro'] },
      { key: 'rarity', label: 'Raridade', type: 'select',
        options: ['Comum', 'Incomum', 'Raro', 'Muito Raro', 'Lendário', 'Artefato'] },
      { key: 'image_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
    ],
    sections: [
      {
        key: 'description', label: 'Descrição & Propriedades',
        defaultCollapsed: false,
        fields: [
          { key: 'description', label: 'Descrição', type: 'textarea', rows: 3 },
          { key: 'properties', label: 'Propriedades', type: 'textarea', rows: 3 },
          { key: 'data.weight', label: 'Peso', type: 'number', placeholder: 'lb.' },
          { key: 'data.valueText', label: 'Valor', type: 'text', placeholder: '25 po' },
          { key: 'data.damage', label: 'Dano', type: 'text', placeholder: '1d8 cortante' },
          { key: 'data.propertiesText', label: 'Propriedades 5e', type: 'text', placeholder: 'versátil, leve, finesse...' },
          { key: 'data.appearance', label: 'Aparência física', type: 'textarea', rows: 2, placeholder: 'Material, forma, inscrições...' },
        ],
      },
      {
        key: 'lore', label: 'Lore & História',
        defaultCollapsed: true,
        fields: [
          { key: 'data.history', label: 'História do item', type: 'textarea', rows: 3, placeholder: 'Quem o criou, quem já o portou...' },
          { key: 'data.curse', label: 'Maldição / efeito oculto', type: 'textarea', rows: 2 },
          { key: 'data.dm_notes', label: 'Notas do DM', type: 'textarea', rows: 2 },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => [e.rarity, e.type].filter(Boolean).join(' - '),
  },

  spells: {
    label: 'Magia', labelPlural: 'Magias',
    icon: BookOpen, accentClass: 'text-cyan-300',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'level', label: 'Nível', type: 'number', placeholder: '0' },
      { key: 'school', label: 'Escola', type: 'select',
        options: ['Abjuração', 'Conjuração', 'Adivinhação', 'Encantamento', 'Evocação', 'Ilusão', 'Necromancia', 'Transmutação'] },
      { key: 'casting_time', label: 'Conjuração', type: 'text' },
      { key: 'range', label: 'Alcance', type: 'text' },
      { key: 'components', label: 'Componentes', type: 'text' },
      { key: 'duration', label: 'Duração', type: 'text' },
      { key: 'image_url', label: 'URL da imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descrição', type: 'textarea', rows: 5 },
    ],
    displayName: e => e.name,
    displaySub: e => [e.level === 0 ? 'Truque' : e.level !== undefined && e.level !== null ? `Nível ${e.level}` : null, e.school].filter(Boolean).join(' - '),
  },

  creatures: {
    label: 'Criatura', labelPlural: 'Criaturas',
    icon: Bug, accentClass: 'text-rose-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'select',
        options: ['Aberração','Besta','Celestial','Construto','Dragão','Elemental','Fada','Ínfero','Gigante','Humanoide','Morto-Vivo','Monstruosidade','Planta','Limo','Outro'] },
      { key: 'cr', label: 'CR', type: 'text', placeholder: '1/4, 1, 5, 20...' },
      { key: 'image_url', label: 'URL da imagem', type: 'text' },
      VISIBILITY_FIELD,
    ],
    sections: [
      {
        key: 'description', label: 'Descrição & Comportamento',
        defaultCollapsed: false,
        fields: [
          { key: 'description', label: 'Descrição', type: 'textarea', rows: 3 },
          { key: 'data.behavior', label: 'Comportamento', type: 'textarea', rows: 2, placeholder: 'Solitária, em matilha, territorial...' },
          { key: 'data.habitat', label: 'Habitat', type: 'text', placeholder: 'Onde vive, onde é encontrada' },
        ],
      },
      {
        key: 'combat', label: 'Combate & Táticas',
        defaultCollapsed: true,
        fields: [
          { key: 'data.tactics', label: 'Táticas de combate', type: 'textarea', rows: 3 },
          { key: 'data.weaknesses', label: 'Fraquezas', type: 'text' },
          { key: 'data.loot', label: 'Loot / Recompensas', type: 'textarea', rows: 2 },
          { key: 'data.dm_notes', label: 'Notas do DM', type: 'textarea', rows: 2 },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => [e.type, e.cr ? `CR ${e.cr}` : null].filter(Boolean).join(' - '),
  },

  notes: {
    label: 'Nota', labelPlural: 'Notas',
    icon: Scroll, accentClass: 'text-parchment/60',
    fields: [
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'image_url', label: 'Imagem', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'content', label: 'Conteúdo', type: 'textarea', rows: 12, placeholder: 'Suporta Markdown...' },
      { key: 'is_secret', label: 'Secreto (só DM)', type: 'toggle' },
    ],
    displayName: e => e.title,
    displaySub: e => e.is_secret ? 'Secreto' : '',
  },

  groups: {
    label: 'Grupo', labelPlural: 'Grupos',
    icon: Users, accentClass: 'text-amber-400',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'type', label: 'Tipo', type: 'text', placeholder: 'Guilda, culto, regimento, familia...' },
      { key: 'image_url', label: 'Imagem / Icone', type: 'text' },
      VISIBILITY_FIELD,
      { key: 'description', label: 'Descrição', type: 'textarea', rows: 4 },
      { key: 'headquarters', label: 'Sede / Local de atuacao', type: 'text' },
      { key: 'motto', label: 'Lema', type: 'textarea', rows: 2 },
      { key: 'is_active', label: 'Ativo', type: 'toggle' },
    ],
    sections: [
      {
        key: 'secrets',
        label: 'Segredos & DM',
        defaultCollapsed: true,
        fields: [
          { key: 'secrets', label: 'Segredos (DM)', type: 'textarea', rows: 3, hint: 'Visivel apenas ao mestre.' },
        ],
      },
    ],
    displayName: e => e.name,
    displaySub: e => [e.type, e.headquarters].filter(Boolean).join(' - '),
    secretField: 'secrets',
  },
}

export const ENTITY_TYPES = Object.keys(ENTITY_CONFIG) as EntityType[]
