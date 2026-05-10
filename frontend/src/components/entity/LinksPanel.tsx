import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookMarked, Calendar, GitBranch, Link2, Plus, Sparkles, X } from 'lucide-react'
import { useCreateLink, useDeleteLink } from '@/hooks/useLinks'
import { useSuggestLinks, type LinkSuggestion } from '@/hooks/useSuggestLinks'
import { ENTITY_CONFIG, ENTITY_TYPES } from '@/config/entityConfig'
import { useEntityList } from '@/hooks/useEntities'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useAddEventLink, useEvents } from '@/hooks/useEvents'
import { TagBadge } from '@/components/ui/TagBadge'
import { Button } from '@/components/ui/Button'
import {
  RELATION_TYPE_COLORS,
  RELATION_TYPE_LABELS,
  RELATION_TYPE_OPTIONS,
  relationDetailText,
  relationDisplayLabel,
  relationTypeForDisplay,
} from '@/config/relations'
import { PropagationsPanel } from '@/components/entity/PropagationsPanel'
import type { Arc, EntityEventLink, EntityLink, EntityType, LinkableType, RelationType, Session, Tag } from '@/types'
import { clsx } from 'clsx'

interface Props {
  campaignId: string
  entityType: LinkableType
  entityId: string
  links: EntityLink[]
  eventLinks?: EntityEventLink[]
  tags: Tag[]
  canEdit: boolean
  entityName?: string
  entityDescription?: string
  entityData?: Record<string, unknown>
}

type LinkableOption = {
  type: LinkableType
  label: string
  labelPlural: string
  icon: React.ElementType
  accentClass: string
}

const EXTRA_LINKABLES: LinkableOption[] = [
  { type: 'arcs', label: 'Arco', labelPlural: 'Arcos', icon: GitBranch, accentClass: 'text-gold' },
  { type: 'sessions', label: 'Sessão', labelPlural: 'Sessões', icon: Calendar, accentClass: 'text-sky-300' },
  { type: 'events', label: 'Evento', labelPlural: 'Eventos', icon: BookMarked, accentClass: 'text-crimson-light' },
]

const RELATION_SUGGESTIONS = [
  'aparece em',
  'acontece em',
  'conhece',
  'possui',
  'membro de',
  'localizado em',
  'pertence a',
  'parceria com',
  'protege',
  'ameaca',
  'investiga',
  'revela',
]

function getLinkableOption(type: LinkableType): LinkableOption | undefined {
  if (type in ENTITY_CONFIG) {
    const cfg = ENTITY_CONFIG[type as EntityType]
    return { type, label: cfg.label, labelPlural: cfg.labelPlural, icon: cfg.icon, accentClass: cfg.accentClass }
  }
  return EXTRA_LINKABLES.find(option => option.type === type)
}

function isEntityType(type: LinkableType): type is EntityType {
  return type in ENTITY_CONFIG
}

export function LinksPanel({ campaignId, entityType, entityId, links, eventLinks = [], tags, canEdit, entityName = '', entityDescription = '', entityData }: Props) {
  const [adding, setAdding] = useState(false)
  const [suggestedLinks, setSuggestedLinks] = useState<LinkSuggestion[]>([])
  const [suggestionError, setSuggestionError] = useState('')
  const [formError, setFormError] = useState('')
  const initialLinkForm = {
    target_type: '' as LinkableType | '',
    target_id: '',
    relation_label: '',
    custom_relation: '',
    relation_type: 'neutro' as RelationType,
  }
  const [form, setForm] = useState(initialLinkForm)

  const createLink = useCreateLink(campaignId)
  const deleteLink = useDeleteLink(campaignId)
  const suggestLinks = useSuggestLinks(campaignId)
  const addEventLink = useAddEventLink(campaignId, form.target_type === 'events' ? form.target_id : '')

  const characters = useEntityList(campaignId, 'characters')
  const npcs = useEntityList(campaignId, 'npcs')
  const locations = useEntityList(campaignId, 'locations')
  const items = useEntityList(campaignId, 'items')
  const spells = useEntityList(campaignId, 'spells')
  const creatures = useEntityList(campaignId, 'creatures')
  const notes = useEntityList(campaignId, 'notes')
  const groups = useEntityList(campaignId, 'groups')
  const arcs = useArcs(campaignId)
  const sessions = useCampaignSessions(campaignId)
  const events = useEvents(campaignId)

  const lists: Partial<Record<LinkableType, any[]>> = {
    characters: characters.data ?? [],
    npcs: npcs.data ?? [],
    locations: locations.data ?? [],
    items: items.data ?? [],
    spells: spells.data ?? [],
    creatures: creatures.data ?? [],
    notes: notes.data ?? [],
    groups: groups.data ?? [],
    arcs: arcs.data ?? [],
    sessions: sessions.data ?? [],
    events: events.data ?? [],
  }

  const linkableOptions: LinkableOption[] = [
    ...ENTITY_TYPES.map(type => getLinkableOption(type)!),
    ...EXTRA_LINKABLES,
  ]

  const targetOptions = form.target_type
    ? (lists[form.target_type] ?? []).filter((item: any) => !(form.target_type === entityType && item.id === entityId))
    : []

  const submit = async () => {
    setFormError('')
    if (!form.target_type || !form.target_id) return
    if (form.target_type !== 'events' && form.relation_type === 'outro' && !form.custom_relation.trim()) {
      setFormError('Informe qual é a relação personalizada.')
      return
    }
    const relationLabel = form.relation_type === 'outro'
      ? [form.custom_relation.trim(), form.relation_label.trim()].filter(Boolean).join(' - ')
      : form.relation_label.trim()
    if (form.target_type === 'events') {
      await addEventLink.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        role: form.relation_label || undefined,
      })
      setAdding(false)
      setForm(initialLinkForm)
      return
    }
    await createLink.mutateAsync({
      source_type: entityType,
      source_id: entityId,
      target_type: form.target_type,
      target_id: form.target_id,
      relation_label: relationLabel || undefined,
      relation_type: form.relation_type,
    })
    setAdding(false)
    setForm(initialLinkForm)
    setSuggestedLinks([])
  }

  const loadSuggestedLinks = async () => {
    if (!isEntityType(entityType)) return
    setSuggestionError('')
    try {
      const suggestions = await suggestLinks.suggest({
        entity_type: entityType,
        entity_id: entityId,
        name: entityName,
        description: entityDescription,
        data: entityData,
      })
      setSuggestedLinks(suggestions)
    } catch (err: any) {
      setSuggestionError(err.message ?? 'Nao foi possivel buscar sugestoes.')
    }
  }

  const connectSuggestion = async (suggestion: LinkSuggestion) => {
    await createLink.mutateAsync({
      source_type: entityType,
      source_id: entityId,
      target_type: suggestion.target_type,
      target_id: suggestion.target_id,
      relation_label: suggestion.relation_label,
      relation_type: suggestion.relation_type,
    })
    setSuggestedLinks(current => current.filter(item => item !== suggestion))
  }

  const getLinkedTarget = (link: EntityLink) => {
    const isSource = link.source_id === entityId && link.source_type === entityType
    return {
      type: isSource ? link.target_type : link.source_type,
      id: isSource ? link.target_id : link.source_id,
    }
  }

  const displayName = (type: LinkableType, item: any) => {
    if (isEntityType(type)) return ENTITY_CONFIG[type].displayName(item)
    if (type === 'arcs') return (item as Arc).title
    if (type === 'events') return item.title
    if (type === 'sessions') {
      const session = item as Session & { arc_title?: string }
      return [session.title, session.arc_title].filter(Boolean).join(' - ')
    }
    return item.title ?? item.name ?? item.id
  }

  const itemPath = (type: LinkableType, item: any, id: string) => {
    if (type === 'arcs') return `/campaigns/${campaignId}/arcs/${id}`
    if (type === 'events') return `/campaigns/${campaignId}/chronicle`
    if (type === 'sessions') return `/campaigns/${campaignId}/arcs/${item?.arc_id}/sessions/${id}`
    return `/campaigns/${campaignId}/${type}/${id}`
  }

  const findItem = (type: LinkableType, id: string) => (lists[type] ?? []).find((item: any) => item.id === id)
  const title = entityType === 'sessions' ? 'Contexto da sessão' : 'Conexões'

  return (
    <aside className="w-[28rem] xl:w-[32rem] 2xl:w-[34rem] shrink-0 flex flex-col gap-6">
      {tags.length > 0 && (
        <div>
          <p className="text-xs text-parchment/30 uppercase tracking-widest mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t => <TagBadge key={t.id} tag={t} />)}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs text-parchment/30 uppercase tracking-widest flex items-center gap-1.5 min-w-0">
            <Link2 size={11} /> {title}
          </p>
          {canEdit && (
            <div className="relative flex items-center justify-end gap-2 shrink-0 mr-5">
              {isEntityType(entityType) && (
                <PropagationsPanel
                  campaignId={campaignId}
                  entityType={entityType}
                  entityId={entityId}
                  entityName={entityName}
                  entityDescription={entityDescription}
                  entityData={entityData}
                  popover
                />
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => setAdding(a => !a)}
                className="shrink-0 w-36"
                title="Criar conexão"
              >
                <Plus size={13} /> {adding ? 'Fechar' : 'Criar conexão'}
              </Button>
            </div>
          )}
        </div>

        {adding && (
          <div className="bg-stone-200 border border-stone-300 rounded-lg p-3 mb-3 flex flex-col gap-2">
            {isEntityType(entityType) && (
              <Button
                type="button"
                size="sm"
                onClick={loadSuggestedLinks}
                loading={suggestLinks.isPending}
                className="w-full"
              >
                <Sparkles size={13} /> Conexões sugeridas
              </Button>
            )}

            {suggestedLinks.length > 0 && (
              <div className="flex flex-col gap-2">
                {suggestedLinks.map(suggestion => (
                  <div key={`${suggestion.target_type}-${suggestion.target_id}`} className="rounded border border-gold/20 bg-gold/5 p-2 flex flex-col gap-2">
                    <div>
                      <p className="text-xs text-parchment">
                        {suggestion.target_name ?? suggestion.target_id}
                        <span className={clsx('ml-2', RELATION_TYPE_COLORS[suggestion.relation_type])}>
                          {relationDisplayLabel(suggestion.relation_type, suggestion.relation_label)}
                        </span>
                      </p>
                      {suggestion.relation_label && suggestion.relation_type !== 'outro' && (
                        <p className="text-xs text-parchment/35 mt-0.5">{suggestion.relation_label}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => connectSuggestion(suggestion)}
                        loading={createLink.isPending}
                        className="flex-1"
                      >
                        Conectar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSuggestedLinks(current => current.filter(item => item !== suggestion))}
                      >
                        Ignorar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {suggestionError && <p className="text-xs text-crimson-light">{suggestionError}</p>}

            <select
              value={form.target_type}
              onChange={e => setForm(f => ({ ...f, target_type: e.target.value as LinkableType, target_id: '' }))}
              className="bg-stone-300 text-parchment text-xs rounded px-2 py-1.5 focus:outline-none"
            >
              <option value="">Conectar com...</option>
              {linkableOptions.map(option => (
                <option key={option.type} value={option.type}>{option.labelPlural}</option>
              ))}
            </select>

            {form.target_type && (
              <select
                value={form.target_id}
                onChange={e => setForm(f => ({ ...f, target_id: e.target.value }))}
                className="bg-stone-300 text-parchment text-xs rounded px-2 py-1.5 focus:outline-none"
              >
                <option value="">Selecionar...</option>
                {targetOptions.map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {displayName(form.target_type as LinkableType, item)}
                  </option>
                ))}
              </select>
            )}

            {form.target_type !== 'events' && (
              <select
                value={form.relation_type}
                onChange={e => setForm(f => ({ ...f, relation_type: e.target.value as RelationType, relation_label: '', custom_relation: '' }))}
                className="bg-stone-300 text-parchment text-xs rounded px-2 py-1.5 focus:outline-none"
              >
                {RELATION_TYPE_OPTIONS.map(relation => (
                  <option key={relation} value={relation}>{RELATION_TYPE_LABELS[relation]}</option>
                ))}
              </select>
            )}

            {form.target_type !== 'events' && form.relation_type === 'outro' && (
              <input
                value={form.custom_relation}
                onChange={e => setForm(f => ({ ...f, custom_relation: e.target.value }))}
                placeholder="Especificar relação..."
                className="bg-stone-300 text-parchment text-xs rounded px-2 py-1.5 placeholder-parchment/30 focus:outline-none"
              />
            )}

            <input
              list={form.relation_type === 'outro' ? undefined : 'relation-suggestions'}
              value={form.relation_label}
              onChange={e => setForm(f => ({ ...f, relation_label: e.target.value }))}
              placeholder={
                form.target_type === 'events'
                  ? 'Papel no evento...'
                  : 'Detalhamento da relação...'
              }
              className="bg-stone-300 text-parchment text-xs rounded px-2 py-1.5 placeholder-parchment/30 focus:outline-none"
            />
            <datalist id="relation-suggestions">
              {RELATION_SUGGESTIONS.map(relation => <option key={relation} value={relation} />)}
            </datalist>

            {formError && <p className="text-xs text-crimson-light">{formError}</p>}

            <div className="flex gap-2 mt-1">
              <Button size="sm" onClick={submit} loading={createLink.isPending} className="flex-1">Conectar</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {links.length === 0 && eventLinks.length === 0 && !adding && (
          <p className="text-xs text-parchment/25 italic">
            {entityType === 'sessions'
              ? 'Conecte locais, NPCs, personagens, notas e acontecimentos para montar o contexto vivo desta sessão.'
              : 'Nenhuma conexão ainda.'}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {links.map(link => {
            const { type, id } = getLinkedTarget(link)
            const meta = getLinkableOption(type)
            if (!meta) return null
            const Icon = meta.icon
            const item = findItem(type, id)
            const name = item ? displayName(type, item) : id
            const relationType = relationTypeForDisplay(link.relation_type, link.relation_label)
            const relationLabel = relationDisplayLabel(link.relation_type, link.relation_label)
            const detailText = relationDetailText(link.relation_type, link.relation_label)
            const fullDescription = [relationLabel, name, meta.label, detailText]
              .filter(Boolean)
              .join(' - ')
            return (
              <div key={link.id} className="relative flex items-center gap-2 group">
                <Link
                  to={itemPath(type, item, id)}
                  className="flex items-center gap-2 flex-1 bg-stone-200 hover:bg-stone-300 rounded px-2.5 py-2 transition-colors min-w-0"
                  title={fullDescription}
                >
                  <Icon size={13} className={clsx('shrink-0', meta.accentClass)} />
                  <div className="min-w-0">
                    <p className="text-xs text-parchment truncate flex items-center gap-1">
                      <span className={clsx('shrink-0 text-[10px] uppercase tracking-wide', RELATION_TYPE_COLORS[relationType])}>
                        {relationLabel}
                      </span>
                      {name}
                    </p>
                    <p className="text-xs text-parchment/30 truncate">
                      {[meta.label, detailText]
                        .filter(Boolean)
                        .join(' - ')}
                    </p>
                  </div>
                </Link>
                {fullDescription && (
                  <div className="pointer-events-none absolute left-0 right-6 top-[calc(100%+0.35rem)] z-30 hidden rounded border border-stone-300 bg-stone-100 px-3 py-2 text-xs leading-relaxed text-parchment/75 shadow-xl group-hover:block group-focus-within:block">
                    {fullDescription}
                  </div>
                )}
                {canEdit && (
                  <button
                    onClick={() => deleteLink.mutate(link.id)}
                    className="opacity-0 group-hover:opacity-100 text-parchment/30 hover:text-crimson transition-all"
                    title="Remover conexão"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )
          })}

          {eventLinks.map(link => (
            <div key={link.id} className="relative flex items-center gap-2 group">
              <Link
                to={`/campaigns/${campaignId}/chronicle`}
                className="flex items-center gap-2 flex-1 bg-stone-200 hover:bg-stone-300 rounded px-2.5 py-2 transition-colors min-w-0"
                title={[link.role, link.event_title, link.event_date_in_world].filter(Boolean).join(' - ')}
              >
                <BookMarked size={13} className="shrink-0 text-crimson-light" />
                <div className="min-w-0">
                  <p className="text-xs text-parchment truncate">
                    {link.role && (
                      <span className="text-parchment/40 mr-1">{link.role} -</span>
                    )}
                    {link.event_title}
                  </p>
                  <p className="text-xs text-parchment/30">
                    Evento{link.event_date_in_world ? ` - ${link.event_date_in_world}` : ''}
                  </p>
                </div>
              </Link>
              {[link.role, link.event_title, link.event_date_in_world].filter(Boolean).length > 0 && (
                <div className="pointer-events-none absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 hidden rounded border border-stone-300 bg-stone-100 px-3 py-2 text-xs leading-relaxed text-parchment/75 shadow-xl group-hover:block group-focus-within:block">
                  {[link.role, link.event_title, link.event_date_in_world].filter(Boolean).join(' - ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
