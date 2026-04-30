import { useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, GitBranch, Search } from 'lucide-react'
import { api } from '@/api/client'
import { ENTITY_CONFIG } from '@/config/entityConfig'
import type { EntityType } from '@/types'
import { clsx } from 'clsx'

type SearchResultType = EntityType | 'arcs' | 'sessions'

interface Result {
  id: string
  title: string
  type: SearchResultType
  arc_id?: string
}

const SEARCH_CONFIG = {
  ...ENTITY_CONFIG,
  arcs: {
    labelPlural: 'Arcos',
    icon: GitBranch,
    accentClass: 'text-gold',
  },
  sessions: {
    labelPlural: 'Sessoes',
    icon: Calendar,
    accentClass: 'text-sky-400',
  },
} satisfies Record<SearchResultType, {
  labelPlural: string
  icon: React.ElementType
  accentClass: string
}>

function resultPath(campaignId: string, result: Result) {
  if (result.type === 'arcs') return `/campaigns/${campaignId}/arcs/${result.id}`
  if (result.type === 'sessions' && result.arc_id) {
    return `/campaigns/${campaignId}/arcs/${result.arc_id}/sessions/${result.id}`
  }
  return `/campaigns/${campaignId}/${result.type}/${result.id}`
}

function useDebounce(fn: (q: string) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout>
  return (q: string) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(q), ms)
  }
}

export function SearchPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const data = await api.get<Result[]>(`/campaigns/${campaignId}/search?q=${encodeURIComponent(q)}`)
      setResults(data)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  const debounced = useCallback(useDebounce(doSearch, 300), [doSearch])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    debounced(e.target.value)
  }

  const grouped = results.reduce<Record<SearchResultType, Result[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {} as Record<SearchResultType, Result[]>)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl text-parchment mb-6">Buscar na campanha</h1>

      <div className="relative mb-8">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-parchment/30" />
        <input
          value={query}
          onChange={onChange}
          autoFocus
          placeholder="Buscar personagens, locais, itens, magias, criaturas, notas..."
          className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-3 pl-10 text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20"
        />
      </div>

      {loading && <p className="text-parchment/30 text-sm">Buscando...</p>}

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="text-parchment/30 text-sm">Nenhum resultado para "{query}".</p>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(grouped).map(([type, items]) => {
          const cfg = SEARCH_CONFIG[type as SearchResultType]
          if (!cfg) return null
          return (
            <div key={type}>
              <p className={clsx('text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5', cfg.accentClass)}>
                <cfg.icon size={11} /> {cfg.labelPlural}
              </p>
              <div className="flex flex-col gap-1">
                {items.map(r => (
                  <Link
                    key={r.id}
                    to={resultPath(campaignId!, r)}
                    className="flex items-center gap-3 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg px-4 py-2.5 transition-colors"
                  >
                    <cfg.icon size={14} className={cfg.accentClass} />
                    <span className="text-sm text-parchment">{r.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
