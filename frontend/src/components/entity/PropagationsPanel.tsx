import { useMemo, useRef, useState, type ElementType } from 'react'
import { Check, MapPin, Package, Skull, Sparkles, User, X } from 'lucide-react'
import { useApplyPropagation, useSuggestPropagations, type PropagationSuggestion } from '@/hooks/usePropagations'
import { Button } from '@/components/ui/Button'
import type { EntityType } from '@/types'
import { clsx } from 'clsx'

interface PropagationsPanelProps {
  campaignId: string
  entityType: EntityType
  entityId: string
  entityName: string
  entityDescription?: string
  entityData?: Record<string, unknown>
  popover?: boolean
  className?: string
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
  popover = false,
  className,
}: PropagationsPanelProps) {
  const suggestPropagations = useSuggestPropagations(campaignId)
  const applyPropagation = useApplyPropagation(campaignId)
  const requestedRef = useRef(false)
  const [suggestions, setSuggestions] = useState<PropagationSuggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [applied, setApplied] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const loadSuggestions = () => {
    setOpen(true)
    if (requestedRef.current || !campaignId || !entityType || !entityId || !entityName) return
    requestedRef.current = true
    setError('')
    setLoaded(false)
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
        onError: (err: any) => {
          setError(err.message ?? 'Não foi possível buscar propagações agora.')
          requestedRef.current = false
          setLoaded(true)
        },
      }
    )
  }

  const toggleSuggestions = () => {
    if (open) {
      setOpen(false)
      return
    }
    loadSuggestions()
  }

  const visibleSuggestions = useMemo(
    () => suggestions.filter(suggestion => {
      const key = suggestionKey(suggestion)
      return !dismissed.has(key) && !applied.has(key)
    }),
    [applied, dismissed, suggestions]
  )

  const ignoreSuggestion = (suggestion: PropagationSuggestion) => {
    const key = suggestionKey(suggestion)
    setDismissed(current => new Set(current).add(key))
  }

  const applySuggestion = async (suggestion: PropagationSuggestion) => {
    const key = suggestionKey(suggestion)
    setError('')
    try {
      await applyPropagation.mutateAsync({
        target_type: suggestion.target_type,
        target_id: suggestion.target_id,
        field: suggestion.field,
        value: suggestion.value,
      })
      setApplied(current => new Set(current).add(key))
    } catch (err: any) {
      setError(err.message ?? 'Não foi possível aplicar a propagação.')
    }
  }

  const isEmpty = loaded && visibleSuggestions.length === 0

  return (
    <div className={clsx('relative', popover ? 'shrink-0' : 'mb-4', className)}>
      <Button
        type="button"
        size="sm"
        onClick={toggleSuggestions}
        loading={suggestPropagations.isPending && !open}
        className="shrink-0"
      >
        {open ? <X size={13} /> : <Sparkles size={13} />}
        {open ? 'Fechar' : 'Propagações sugeridas pela IA'}
      </Button>

      {!open ? null : (
    <div className={clsx(
      'rounded-lg border border-gold/20 bg-stone-100 p-4 transition-all',
      popover
        ? 'absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(34rem,calc(100vw-2rem))] shadow-2xl'
        : 'mt-3'
    )}>
      <div className="text-xs font-medium text-gold/70 uppercase tracking-widest flex items-center justify-between mb-3">
        <span className="flex items-center gap-2">
          <Sparkles size={13} />
          Propagações sugeridas pela IA
        </span>
      </div>

      {!loaded && (
        <p className="text-xs text-parchment/45">Buscando propagações...</p>
      )}

      {error && (
        <p className="text-xs text-crimson-light bg-crimson/10 border border-crimson/20 rounded px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {isEmpty && !error && (
        <p className="text-xs text-parchment/45">Nenhuma propagação direta encontrada para esta entidade.</p>
      )}

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
      )}
    </div>
  )
}
