import type { RelationType } from '@/types'

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  alianca: 'aliança',
  rivalidade: 'rivalidade',
  familia: 'família',
  lealdade: 'lealdade',
  segredo: 'segredo',
  divida: 'dívida',
  amor: 'amor',
  amizade: 'amizade',
  parceria: 'parceria',
  posse: 'possui',
  membro: 'membro',
  localizacao: 'localização',
  protecao: 'proteção',
  subordinacao: 'subordinação',
  mentor: 'mentor',
  neutro: 'neutro',
  outro: 'outro',
  odio: 'rivalidade',
}

export const RELATION_TYPE_OPTIONS: RelationType[] = [
  'alianca',
  'amizade',
  'parceria',
  'rivalidade',
  'familia',
  'lealdade',
  'segredo',
  'divida',
  'amor',
  'mentor',
  'posse',
  'membro',
  'localizacao',
  'protecao',
  'subordinacao',
  'neutro',
  'outro',
]

export const RELATION_TYPE_COLORS: Record<RelationType, string> = {
  alianca: 'text-emerald-400',
  rivalidade: 'text-rose-400',
  familia: 'text-sky-400',
  lealdade: 'text-violet-400',
  segredo: 'text-amber-400',
  divida: 'text-orange-400',
  amor: 'text-pink-400',
  amizade: 'text-lime-300',
  parceria: 'text-teal-300',
  posse: 'text-yellow-300',
  membro: 'text-indigo-300',
  localizacao: 'text-cyan-300',
  protecao: 'text-emerald-300',
  subordinacao: 'text-purple-300',
  mentor: 'text-cyan-400',
  neutro: 'text-parchment/50',
  outro: 'text-white',
  odio: 'text-rose-400',
}

export const RELATION_TYPE_HEX: Record<RelationType, string> = {
  alianca: '#34d399',
  rivalidade: '#fb7185',
  familia: '#38bdf8',
  lealdade: '#a78bfa',
  segredo: '#fbbf24',
  divida: '#fb923c',
  amor: '#f472b6',
  amizade: '#bef264',
  parceria: '#5eead4',
  posse: '#fde047',
  membro: '#a5b4fc',
  localizacao: '#67e8f9',
  protecao: '#6ee7b7',
  subordinacao: '#d8b4fe',
  mentor: '#22d3ee',
  neutro: '#c9c0aa',
  outro: '#ffffff',
  odio: '#fb7185',
}

export function relationDisplayLabel(relationType?: RelationType | null, relationLabel?: string | null) {
  const type = relationTypeForDisplay(relationType, relationLabel)
  if (type === 'outro' && relationLabel?.trim()) return relationLabel.trim().split(/\s+-\s+|:\s+/)[0]
  return RELATION_TYPE_LABELS[type] ?? RELATION_TYPE_LABELS.outro
}

export function relationDetailText(relationType?: RelationType | null, relationLabel?: string | null) {
  if (!relationLabel?.trim()) return null
  const type = relationTypeForDisplay(relationType, relationLabel)
  if (type !== 'outro') return relationLabel.trim()
  const [, detail] = relationLabel.trim().split(/\s+-\s+|:\s+/, 2)
  return detail?.trim() || null
}

export function relationTypeForDisplay(relationType?: RelationType | null, relationLabel?: string | null): RelationType {
  const type = relationType ?? 'outro'
  if (type !== 'outro') return type
  const text = relationLabel?.toLowerCase() ?? ''
  if (/possu|dono|portador|pertence/.test(text)) return 'posse'
  if (/membro|integrante|filiad|grupo|fac[cç][aã]o/.test(text)) return 'membro'
  if (/localiz|fica em|vive em|mora em|acontece em|aparece em/.test(text)) return 'localizacao'
  if (/parce|socied|colabora/.test(text)) return 'parceria'
  if (/amiz|amig/.test(text)) return 'amizade'
  if (/rival|inimig|conflit|[óo]dio|hostil/.test(text)) return 'rivalidade'
  return type
}
