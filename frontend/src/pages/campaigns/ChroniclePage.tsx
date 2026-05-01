import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  BookMarked, ChevronDown, ChevronRight, Image, Link as LinkIcon,
  Pencil, Plus, Trash2, X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useCampaign } from '@/hooks/useCampaign'
import { useEntityList } from '@/hooks/useEntities'
import {
  useAddEventLink,
  useCreateEvent,
  useDeleteEvent,
  useEvents,
  useRemoveEventLink,
  useUpdateEvent,
} from '@/hooks/useEvents'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { ENTITY_CONFIG, ENTITY_TYPES } from '@/config/entityConfig'
import type { CampaignEvent, EntityType, EventImpact, EventType, LinkableType } from '@/types'

const EVENT_TYPES: EventType[] = [
  'batalha', 'revelacao', 'morte', 'alianca', 'descoberta',
  'traicao', 'destruicao', 'evento_magico', 'politico', 'outro',
]

const TYPE_LABEL: Record<EventType, string> = {
  batalha: 'Batalha',
  revelacao: 'Revelação',
  morte: 'Morte',
  alianca: 'Aliança',
  descoberta: 'Descoberta',
  traicao: 'Traição',
  destruicao: 'Destruição',
  evento_magico: 'Evento mágico',
  politico: 'Político',
  outro: 'Outro',
}

const IMPACT_LABEL: Record<EventImpact, string> = {
  divisor: 'Divisor',
  significativo: 'Significativo',
  menor: 'Menor',
}

const IMPACT_CLASS: Record<EventImpact, string> = {
  divisor: 'text-crimson-light border-crimson-light bg-crimson/10',
  significativo: 'text-gold border-gold bg-gold/10',
  menor: 'text-parchment/40 border-parchment/20 bg-stone-200',
}

const initialForm = {
  title: '',
  type: 'outro' as EventType,
  impact: 'significativo' as EventImpact,
  date_in_world: '',
  description: '',
  image_url: '',
  session_id: '',
  arc_id: '',
  visibility: 'public' as 'public' | 'private',
}

type EntityLookup = Partial<Record<LinkableType, any[]>>
type LocalEventLink = {
  id?: string
  entity_type: LinkableType
  entity_id: string
  role?: string
}

function getEntityMeta(type: LinkableType) {
  if (type in ENTITY_CONFIG) {
    const cfg = ENTITY_CONFIG[type as EntityType]
    return { label: cfg.label, labelPlural: cfg.labelPlural, displayName: cfg.displayName }
  }
  if (type === 'arcs') return { label: 'Arco', labelPlural: 'Arcos', displayName: (e: any) => e.title }
  if (type === 'sessions') return { label: 'Sessão', labelPlural: 'Sessões', displayName: (e: any) => e.title }
  return { label: 'Entidade', labelPlural: 'Entidades', displayName: (e: any) => e.title ?? e.name ?? e.id }
}

function displayName(type: LinkableType, item: any) {
  return getEntityMeta(type).displayName(item)
}

function entityPath(campaignId: string, type: LinkableType, item: any, id: string) {
  if (type === 'arcs') return `/campaigns/${campaignId}/arcs/${id}`
  if (type === 'sessions' && item?.arc_id) return `/campaigns/${campaignId}/arcs/${item.arc_id}/sessions/${id}`
  if (type in ENTITY_CONFIG) return `/campaigns/${campaignId}/${type}/${id}`
  return ''
}

function EventCard({ event, campaignId, lookup, canEdit, onEdit, onDelete }: {
  event: CampaignEvent
  campaignId: string
  lookup: EntityLookup
  canEdit: boolean
  onEdit: (event: CampaignEvent) => void
  onDelete: (eventId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const imageUrl = typeof event.data?.image_url === 'string' ? event.data.image_url : ''

  return (
    <div className="bg-stone-100 border border-stone-300 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 hover:bg-stone-200 transition-colors"
      >
        <div className="flex items-start gap-4">
          <span className={clsx('text-[11px] px-2 py-1 rounded border shrink-0', IMPACT_CLASS[event.impact])}>
            {IMPACT_LABEL[event.impact]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-parchment/30">{TYPE_LABEL[event.type]}</p>
            <h2 className="font-display text-lg text-parchment mt-0.5">{event.title}</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-parchment/35 mt-1">
              {event.arc_title && <span>{event.arc_title}</span>}
              {event.session_title && <span>{event.session_title}</span>}
              {event.date_in_world && <span>{event.date_in_world}</span>}
              {imageUrl && <span className="inline-flex items-center gap-1"><Image size={11} /> imagem</span>}
              <span className="inline-flex items-center gap-1">
                <LinkIcon size={11} /> {event.entity_links.length}
              </span>
            </div>
          </div>
          {open ? (
            <ChevronDown size={16} className="text-gold/70 mt-1 shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-parchment/25 mt-1 shrink-0" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-stone-300 pt-4">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={event.title}
              className="w-full max-h-72 object-cover rounded-lg border border-stone-300 bg-stone-200 mb-4"
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          )}

          {event.description ? (
            <p className="text-sm text-parchment/65 leading-relaxed whitespace-pre-wrap">{event.description}</p>
          ) : (
            <p className="text-sm text-parchment/25 italic">Sem descrição registrada.</p>
          )}

          <div className="mt-4">
            <h3 className="text-xs uppercase tracking-widest text-parchment/30 mb-2">Entidades linkadas</h3>
            {event.entity_links.length === 0 ? (
              <p className="text-sm text-parchment/25 italic">Nenhuma entidade linkada.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {event.entity_links.map(link => {
                  const meta = getEntityMeta(link.entity_type)
                  const item = (lookup[link.entity_type] ?? []).find(entry => entry.id === link.entity_id)
                  const path = entityPath(campaignId, link.entity_type, item, link.entity_id)
                  return (
                    <div key={link.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-300 bg-stone-200 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-parchment truncate">
                          {item ? displayName(link.entity_type, item) : link.entity_id}
                        </p>
                        <p className="text-xs text-parchment/35">
                          {[meta.label, link.role].filter(Boolean).join(' - ')}
                        </p>
                      </div>
                      {path && (
                        <Link to={path} className="text-xs text-gold hover:text-gold-light shrink-0 transition-colors">
                          Ver entidade
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-stone-300">
              <Button size="sm" variant="ghost" onClick={() => onEdit(event)}>
                <Pencil size={13} /> Editar
              </Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(event.id)}>
                <Trash2 size={13} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EventEditorModal({ campaignId, initialSessionId, event, lookup, onClose }: {
  campaignId: string
  initialSessionId?: string
  event?: CampaignEvent
  lookup: EntityLookup
  onClose: () => void
}) {
  const { data: arcs } = useArcs(campaignId)
  const { data: sessions } = useCampaignSessions(campaignId)
  const createEvent = useCreateEvent(campaignId)
  const updateEvent = useUpdateEvent(campaignId, event?.id ?? '')
  const addLink = useAddEventLink(campaignId, event?.id ?? '')
  const removeLink = useRemoveEventLink(campaignId, event?.id ?? '')
  const [form, setForm] = useState({
    ...initialForm,
    title: event?.title ?? '',
    type: event?.type ?? 'outro',
    impact: event?.impact ?? 'significativo',
    date_in_world: event?.date_in_world ?? '',
    description: event?.description ?? '',
    image_url: typeof event?.data?.image_url === 'string' ? event.data.image_url : '',
    session_id: event?.session_id ?? initialSessionId ?? '',
    arc_id: event?.arc_id ?? '',
    visibility: event?.visibility ?? 'public',
  })
  const [links, setLinks] = useState<LocalEventLink[]>(
    (event?.entity_links ?? []).map(link => ({
      id: link.id,
      entity_type: link.entity_type,
      entity_id: link.entity_id,
      role: link.role,
    }))
  )
  const [linkForm, setLinkForm] = useState<{ entity_type: LinkableType | ''; entity_id: string; role: string }>({
    entity_type: '',
    entity_id: '',
    role: '',
  })

  const linkableTypes = [...ENTITY_TYPES, 'arcs', 'sessions'] as LinkableType[]
  const linkOptions = linkForm.entity_type ? (lookup[linkForm.entity_type] ?? []) : []

  const addLocalLink = () => {
    if (!linkForm.entity_type || !linkForm.entity_id) return
    const exists = links.some(link => link.entity_type === linkForm.entity_type && link.entity_id === linkForm.entity_id)
    if (!exists) {
      setLinks(current => [...current, {
        entity_type: linkForm.entity_type as LinkableType,
        entity_id: linkForm.entity_id,
        role: linkForm.role || undefined,
      }])
    }
    setLinkForm({ entity_type: '', entity_id: '', role: '' })
  }

  const submit = async () => {
    if (!form.title) return
    const payload = {
      title: form.title,
      type: form.type,
      impact: form.impact,
      date_in_world: form.date_in_world || null,
      description: form.description || null,
      visibility: form.visibility,
      session_id: form.session_id || null,
      arc_id: form.arc_id || null,
      data: { ...(event?.data ?? {}), image_url: form.image_url || undefined },
    }

    if (!event) {
      await createEvent.mutateAsync({ ...payload, entity_links: links })
      onClose()
      return
    }

    await updateEvent.mutateAsync(payload)
    const currentKeys = new Set(links.map(link => `${link.entity_type}:${link.entity_id}`))
    const originalKeys = new Set(event.entity_links.map(link => `${link.entity_type}:${link.entity_id}`))

    for (const original of event.entity_links) {
      if (!currentKeys.has(`${original.entity_type}:${original.entity_id}`)) {
        await removeLink.mutateAsync(original.id)
      }
    }
    for (const link of links) {
      if (!originalKeys.has(`${link.entity_type}:${link.entity_id}`) || link.role !== event.entity_links.find(old => old.entity_type === link.entity_type && old.entity_id === link.entity_id)?.role) {
        await addLink.mutateAsync({
          entity_type: link.entity_type,
          entity_id: link.entity_id,
          role: link.role || undefined,
        })
      }
    }
    onClose()
  }

  const pending = createEvent.isPending || updateEvent.isPending || addLink.isPending || removeLink.isPending
  const error = createEvent.error ?? updateEvent.error ?? addLink.error ?? removeLink.error

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-stone-100 border border-stone-300 rounded-xl shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-300 px-5 py-4 sticky top-0 bg-stone-100 z-10">
          <div>
            <h2 className="font-display text-xl text-parchment">{event ? 'Editar Evento' : 'Novo Evento'}</h2>
            <p className="text-xs text-parchment/35 mt-0.5">Registre o acontecimento e suas conexões.</p>
          </div>
          <button onClick={onClose} className="text-parchment/35 hover:text-parchment transition-colors" title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Título *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="A queda da torre..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Tipo</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as EventType }))}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              {EVENT_TYPES.map(type => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Impacto</label>
            <select
              value={form.impact}
              onChange={e => setForm(f => ({ ...f, impact: e.target.value as EventImpact }))}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              <option value="divisor">Divisor</option>
              <option value="significativo">Significativo</option>
              <option value="menor">Menor</option>
            </select>
          </div>

          <Input
            label="Data no mundo"
            value={form.date_in_world}
            onChange={e => setForm(f => ({ ...f, date_in_world: e.target.value }))}
            placeholder="12 de Flamerule, 1492 DR"
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm text-parchment/70 font-medium">Imagem</label>
            <ImageUpload
              currentUrl={form.image_url}
              context="events"
              onUpload={url => setForm(f => ({ ...f, image_url: url }))}
              compact
            />
            <Input
              label="URL da imagem"
              value={form.image_url}
              onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Sessão</label>
            <select
              value={form.session_id}
              onChange={e => setForm(f => ({ ...f, session_id: e.target.value }))}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              <option value="">Sem sessão</option>
              {(sessions ?? []).map(session => (
                <option key={session.id} value={session.id}>
                  {[session.title, session.arc_title].filter(Boolean).join(' - ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Arco</label>
            <select
              value={form.arc_id}
              onChange={e => setForm(f => ({ ...f, arc_id: e.target.value }))}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              <option value="">Sem arco</option>
              {(arcs ?? []).map(arc => <option key={arc.id} value={arc.id}>{arc.title}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Visibilidade</label>
            <select
              value={form.visibility}
              onChange={e => setForm(f => ({ ...f, visibility: e.target.value as 'public' | 'private' }))}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              <option value="public">Pública</option>
              <option value="private">Privada</option>
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Descrição</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={5}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 resize-y"
            />
          </div>

          <div className="md:col-span-2 border-t border-stone-300 pt-4">
            <h3 className="text-xs uppercase tracking-widest text-parchment/30 mb-3">Conexões</h3>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <select
                value={linkForm.entity_type}
                onChange={e => setLinkForm({ entity_type: e.target.value as LinkableType, entity_id: '', role: '' })}
                className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
              >
                <option value="">Tipo...</option>
                {linkableTypes.map(type => (
                  <option key={type} value={type}>{getEntityMeta(type).labelPlural}</option>
                ))}
              </select>
              <select
                value={linkForm.entity_id}
                disabled={!linkForm.entity_type}
                onChange={e => setLinkForm(f => ({ ...f, entity_id: e.target.value }))}
                className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment disabled:opacity-50 focus:outline-none focus:border-gold/60"
              >
                <option value="">Selecionar...</option>
                {linkOptions.map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {displayName(linkForm.entity_type as LinkableType, item)}
                  </option>
                ))}
              </select>
              <input
                value={linkForm.role}
                onChange={e => setLinkForm(f => ({ ...f, role: e.target.value }))}
                placeholder="papel no evento"
                className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/35 focus:outline-none focus:border-gold/60"
              />
              <Button type="button" size="sm" variant="ghost" onClick={addLocalLink}>
                <Plus size={13} /> Linkar
              </Button>
            </div>

            <div className="flex flex-col gap-2 mt-3">
              {links.length === 0 ? (
                <p className="text-sm text-parchment/25 italic">Nenhuma conexão adicionada.</p>
              ) : links.map(link => {
                const item = (lookup[link.entity_type] ?? []).find(entry => entry.id === link.entity_id)
                const meta = getEntityMeta(link.entity_type)
                return (
                  <div key={`${link.entity_type}:${link.entity_id}`} className="flex items-center justify-between gap-3 rounded-lg border border-stone-300 bg-stone-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-parchment truncate">{item ? displayName(link.entity_type, item) : link.entity_id}</p>
                      <p className="text-xs text-parchment/35">{[meta.label, link.role].filter(Boolean).join(' - ')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLinks(current => current.filter(entry => !(entry.entity_type === link.entity_type && entry.entity_id === link.entity_id)))}
                      className="text-parchment/35 hover:text-crimson-light transition-colors"
                      title="Remover conexão"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {error && <p className="px-5 pb-2 text-sm text-crimson-light">{error.message}</p>}

        <div className="flex justify-end gap-2 border-t border-stone-300 px-5 py-4">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit} loading={pending}>{event ? 'Salvar evento' : 'Criar evento'}</Button>
        </div>
      </div>
    </div>
  )
}

export function ChroniclePage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const location = useLocation()
  const { data: campaign } = useCampaign(campaignId!)
  const { data: events, isLoading } = useEvents(campaignId!)
  const { data: arcs } = useArcs(campaignId!)
  const { data: sessions } = useCampaignSessions(campaignId!)
  const characters = useEntityList(campaignId!, 'characters')
  const npcs = useEntityList(campaignId!, 'npcs')
  const locations = useEntityList(campaignId!, 'locations')
  const items = useEntityList(campaignId!, 'items')
  const spells = useEntityList(campaignId!, 'spells')
  const creatures = useEntityList(campaignId!, 'creatures')
  const notes = useEntityList(campaignId!, 'notes')
  const deleteEvent = useDeleteEvent(campaignId!)

  const state = location.state as { session_id?: string } | null
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<CampaignEvent | null>(null)
  const [initialSessionId, setInitialSessionId] = useState<string | undefined>()
  const [impactFilter, setImpactFilter] = useState<EventImpact | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all')
  const canEdit = ['admin', 'editor'].includes(campaign?.role ?? '')

  useEffect(() => {
    if (state?.session_id) {
      setInitialSessionId(state.session_id)
      setCreating(true)
    }
  }, [state?.session_id])

  const lookup = useMemo<EntityLookup>(() => ({
    characters: characters.data ?? [],
    npcs: npcs.data ?? [],
    locations: locations.data ?? [],
    items: items.data ?? [],
    spells: spells.data ?? [],
    creatures: creatures.data ?? [],
    notes: notes.data ?? [],
    arcs: arcs ?? [],
    sessions: sessions ?? [],
  }), [arcs, characters.data, creatures.data, items.data, locations.data, notes.data, npcs.data, sessions, spells.data])

  const filteredEvents = (events ?? []).filter(event => {
    if (impactFilter !== 'all' && event.impact !== impactFilter) return false
    if (typeFilter !== 'all' && event.type !== typeFilter) return false
    return true
  })

  const openCreate = () => {
    setInitialSessionId(undefined)
    setCreating(true)
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('Excluir este evento da crônica?')) return
    await deleteEvent.mutateAsync(eventId)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-2xl text-parchment">Crônica</h1>
          <p className="text-parchment/30 text-sm mt-1">Eventos, marcos e consequências da campanha.</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Novo Evento
          </Button>
        )}
      </div>

      <div className="bg-stone-100 border border-stone-300 rounded-xl p-4 mb-6 flex flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-parchment/30 mb-2">Impacto</p>
          <div className="flex flex-wrap gap-2">
            {(['all', 'divisor', 'significativo', 'menor'] as const).map(value => (
              <button
                key={value}
                onClick={() => setImpactFilter(value)}
                className={clsx(
                  'text-xs rounded border px-3 py-1.5 transition-colors',
                  impactFilter === value
                    ? 'text-gold border-gold bg-gold/10'
                    : 'text-parchment/45 border-stone-300 hover:text-parchment'
                )}
              >
                {value === 'all' ? 'Todos' : IMPACT_LABEL[value]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-parchment/30 mb-2">Tipo</p>
          <div className="flex flex-wrap gap-2">
            {(['all', ...EVENT_TYPES] as const).map(value => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={clsx(
                  'text-xs rounded border px-3 py-1.5 transition-colors',
                  typeFilter === value
                    ? 'text-gold border-gold bg-gold/10'
                    : 'text-parchment/45 border-stone-300 hover:text-parchment'
                )}
              >
                {value === 'all' ? 'Todos' : TYPE_LABEL[value]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-parchment/30 text-sm">Carregando...</p>}

      {!isLoading && filteredEvents.length === 0 && (
        <EmptyState
          icon={<BookMarked size={40} />}
          title="Nenhum evento na crônica."
          description="Registre os acontecimentos que mudam o rumo da campanha."
          action={canEdit ? { label: 'Criar evento', onClick: openCreate } : undefined}
        />
      )}

      <div className="flex flex-col gap-3">
        {filteredEvents.map(event => (
          <EventCard
            key={event.id}
            event={event}
            campaignId={campaignId!}
            lookup={lookup}
            canEdit={canEdit}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {creating && (
        <EventEditorModal
          campaignId={campaignId!}
          initialSessionId={initialSessionId}
          lookup={lookup}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && (
        <EventEditorModal
          campaignId={campaignId!}
          event={editing}
          lookup={lookup}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
