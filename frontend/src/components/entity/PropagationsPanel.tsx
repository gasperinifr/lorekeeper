import { useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import { Check, MapPin, Package, Skull, Sparkles, User, X } from 'lucide-react'
import { useApplyPropagation, useSuggestPropagations, type PropagationSuggestion } from '@/hooks/usePropagations'
import type { EntityType } from '@/types'

interface PropagationsPanelProps {
  campaignId: string
  entityType: EntityType
  entityId: string
  entityName: string
  entityDescription?: string
  entityData?: Record<string, unknown>
}

const TYPE_LABELS: Partial<Record<EntityType, string>> = {
  npcs: 'NPC',
  locations: 'Local',
  items: 'Item',
  characters: 'Personagem',
}

const TYPE_ICONS: Partial<Record<EntityType, ElementType>> = {
  npcs: User,
  locations: MapPin,
  items: Package,
  characters: Skull,
}

function suggestionKey(suggestion: PropagationSuggestion) {
  return `${suggestion.target_type}:${suggestion.target_id}:${suggestion.field}`
}

function formatValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return JSON.stringify(value)
}

function fieldLabel(field: string, value: unknown) {
  if (field === 'is_alive' && value === false) return 'marcar como falecido (is_alive)'
  if (field === 'is_alive' && value === true) return 'marcar como vivo (is_alive)'
  if (field === 'is_active') return 'atualizar status ativo (is_active)'
  return `atualizar ${field}`
}

export function PropagationsPanel({
  campaignId,
  entityType,
  entityId,
  entityName,
  entityDescription,
  entityData,
}: PropagationsPanelProps) {
  const suggestPropagations = useSuggestPropagations(campaignId)
  const applyPropagation = useApplyPropagation(campaignId)
  const requestedRef = useRef(false)
  const [suggestions, setSuggestions] = useState<PropagationSuggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [applied, setApplied] = useState<Set<string>>(() => new Set())
  const [recentlyApplied, setRecentlyApplied] = useState<Set<string>>(() => new Set())
  const [closed, setClosed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (requestedRef.current || !campaignId || !entityType || !entityId || !entityName) return
    requestedRef.current = true
    suggestPropagations.mutate(
      {
        entity_type: entityType,
        entity_id: entityId,
        name: entityName,
        description: entityDescription,
        data: entityData,
      },
      {
        onSuccess: result => {
          setSuggestions(result.propagations ?? [])
          setLoaded(true)
        },
        onError: () => setLoaded(true),
      }
    )
  }, [campaignId, entityData, entityDescription, entityId, entityName, entityType, suggestPropagations])

  const visibleSuggestions = useMemo(
    () => suggestions.filter(suggestion => {
      const key = suggestionKey(suggestion)
      return !dismissed.has(key) && (!applied.has(key) || recentlyApplied.has(key))
    }),
    [applied, dismissed, recentlyApplied, suggestions]
  )

  const ignoreSuggestion = (suggestion: PropagationSuggestion) => {
    const key = suggestionKey(suggestion)
    setDismissed(current => new Set(current).add(key))
  }

  const applySuggestion = async (suggestion: PropagationSuggestion) => {
    const key = suggestionKey(suggestion)
    await applyPropagation.mutateAsync({
      target_type: suggestion.target_type,
      target_id: suggestion.target_id,
      field: suggestion.field,
      value: suggestion.value,
    })
    setApplied(current => new Set(current).add(key))
    setRecentlyApplied(current => new Set(current).add(key))
    window.setTimeout(() => {
      setRecentlyApplied(current => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }, 1500)
  }

  if (closed || !loaded || visibleSuggestions.length === 0) return null

  return (
    <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 mb-4 transition-all">
      <div className="text-xs font-medium text-gold/70 uppercase tracking-widest flex items-center justify-between mb-3">
        <span className="flex items-center gap-2">
          <Sparkles size={13} />
          Propagações sugeridas pela IA
        </span>
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="text-parchment/40 hover:text-parchment/70 transition-colors normal-case tracking-normal flex items-center gap-1"
        >
          <X size={13} />
          fechar
        </button>
      </div>

      <div>
        {visibleSuggestions.map(suggestion => {
          const key = suggestionKey(suggestion)
          const Icon = TYPE_ICONS[suggestion.target_type] ?? Sparkles
          const isApplied = applied.has(key)
          const value = formatValue(suggestion.value)
          return (
            <div
              key={key}
              className="rounded border border-stone-300 bg-stone-100 p-3 mb-2 transition-all"
            >
              <div className="flex items-start gap-2">
                <Icon size={14} className="text-gold mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-parchment font-medium truncate">
                    {suggestion.target_name}
                    <span className="text-xs text-parchment/40 font-normal ml-2">
                      {TYPE_LABELS[suggestion.target_type] ?? suggestion.target_type}
                    </span>
                  </p>
                  <p className="text-xs text-parchment/60 mt-1">
                    Sugestão: {fieldLabel(suggestion.field, suggestion.value)}
                  </p>
                  {value && (
                    <p className="text-xs text-parchment/70 mt-1 leading-relaxed break-words">
                      "{value}"
                    </p>
                  )}
                  <p className="text-xs text-parchment/60 mt-1 leading-relaxed">
                    {suggestion.reason}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => ignoreSuggestion(suggestion)}
                  className="text-xs text-parchment/40 hover:text-parchment/70 px-2 py-1 rounded transition-colors"
                  disabled={isApplied || applyPropagation.isPending}
                >
                  Ignorar
                </button>
                <button
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="text-xs bg-gold/20 text-gold hover:bg-gold/30 px-3 py-1 rounded transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
                  disabled={isApplied || applyPropagation.isPending}
                >
                  {isApplied ? <Check size={13} /> : null}
                  {isApplied ? 'Aplicado' : applyPropagation.isPending ? 'Aplicando...' : 'Aplicar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
