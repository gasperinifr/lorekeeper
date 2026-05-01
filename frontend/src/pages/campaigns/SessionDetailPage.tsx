import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Sword, CheckCircle, Clock, Calendar, Lock, GitBranch, BookMarked } from 'lucide-react'
import { useSessionDetail, useUpdateSession, useCreateEncounter, useUpdateEncounter } from '@/hooks/useSessions'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useEntityList } from '@/hooks/useEntities'
import { useEvents } from '@/hooks/useEvents'
import { LinksPanel } from '@/components/entity/LinksPanel'
import { ENTITY_CONFIG } from '@/config/entityConfig'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt'
import type { EntityLink, EntityType, LinkableType } from '@/types'
import { clsx } from 'clsx'

const DIFFICULTIES = ['Fácil', 'Médio', 'Difícil', 'Mortal']
const DIFF_COLOR: Record<string, string> = {
  'Fácil':  'text-emerald-400',
  'Médio':  'text-gold',
  'Difícil':'text-orange-400',
  'Mortal': 'text-crimson-light',
}

function SessionContextGrid({ campaignId, sessionId, links }: {
  campaignId: string
  sessionId: string
  links: EntityLink[]
}) {
  const characters = useEntityList(campaignId, 'characters')
  const npcs = useEntityList(campaignId, 'npcs')
  const locations = useEntityList(campaignId, 'locations')
  const items = useEntityList(campaignId, 'items')
  const spells = useEntityList(campaignId, 'spells')
  const creatures = useEntityList(campaignId, 'creatures')
  const notes = useEntityList(campaignId, 'notes')
  const arcs = useArcs(campaignId)
  const sessions = useCampaignSessions(campaignId)

  const lists: Partial<Record<LinkableType, any[]>> = {
    characters: characters.data ?? [],
    npcs: npcs.data ?? [],
    locations: locations.data ?? [],
    items: items.data ?? [],
    spells: spells.data ?? [],
    creatures: creatures.data ?? [],
    notes: notes.data ?? [],
    arcs: arcs.data ?? [],
    sessions: sessions.data ?? [],
  }

  const metaFor = (type: LinkableType) => {
    if (type in ENTITY_CONFIG) {
      const cfg = ENTITY_CONFIG[type as EntityType]
      return { label: cfg.label, icon: cfg.icon, accentClass: cfg.accentClass }
    }
    if (type === 'arcs') return { label: 'Arco', icon: GitBranch, accentClass: 'text-gold' }
    return { label: 'Sessao', icon: Calendar, accentClass: 'text-sky-300' }
  }

  const displayName = (type: LinkableType, item: any) => {
    if (type in ENTITY_CONFIG) return ENTITY_CONFIG[type as EntityType].displayName(item)
    if (type === 'arcs') return item.title
    if (type === 'sessions') return [item.title, item.arc_title].filter(Boolean).join(' - ')
    return item.title ?? item.name ?? item.id
  }

  const pathFor = (type: LinkableType, item: any, id: string) => {
    if (type === 'arcs') return `/campaigns/${campaignId}/arcs/${id}`
    if (type === 'sessions') return `/campaigns/${campaignId}/arcs/${item?.arc_id}/sessions/${id}`
    return `/campaigns/${campaignId}/${type}/${id}`
  }

  const connected = links.map(link => {
    const isSource = link.source_type === 'sessions' && link.source_id === sessionId
    const type = isSource ? link.target_type : link.source_type
    const id = isSource ? link.target_id : link.source_id
    const item = (lists[type] ?? []).find((entry: any) => entry.id === id)
    return { link, type, id, item }
  }).filter(entry => entry.item)

  if (!connected.length) return null

  return (
    <section className="mb-8">
      <h2 className="text-xs text-parchment/30 uppercase tracking-widest mb-3">Contexto conectado</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {connected.map(({ link, type, id, item }) => {
          const meta = metaFor(type)
          const Icon = meta.icon
          return (
            <Link key={link.id} to={pathFor(type, item, id)}>
              <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-lg px-4 py-3 transition-colors flex items-start gap-3">
                <Icon size={15} className={clsx('mt-0.5 shrink-0', meta.accentClass)} />
                <div className="min-w-0">
                  <p className="text-sm text-parchment truncate">{displayName(type, item)}</p>
                  <p className="text-xs text-parchment/35">
                    {[meta.label, link.relation_label].filter(Boolean).join(' - ')}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function SessionDetailPage() {
  const { campaignId, arcId, sessionId } = useParams<{
    campaignId: string; arcId: string; sessionId: string
  }>()
  const navigate = useNavigate()

  const { data: session, isLoading } = useSessionDetail(campaignId!, arcId!, sessionId!)
  const { data: events } = useEvents(campaignId!)
  const updateSession  = useUpdateSession(campaignId!, arcId!, sessionId!)
  const createEncounter = useCreateEncounter(campaignId!, arcId!, sessionId!)

  const [editingNotes, setEditingNotes]       = useState(false)
  const [editingSummary, setEditingSummary]   = useState(false)
  const [dmNotes, setDmNotes]                 = useState('')
  const [summary, setSummary]                 = useState('')
  const [addingEncounter, setAddingEncounter] = useState(false)
  const [encForm, setEncForm] = useState({ title: '', description: '', difficulty: '', visibility: 'public' })

  const startEditNotes = () => {
    setDmNotes(session?.dm_notes ?? '')
    setEditingNotes(true)
  }
  const startEditSummary = () => {
    setSummary(session?.summary ?? '')
    setEditingSummary(true)
  }

  const saveNotes = async () => {
    await updateSession.mutateAsync({ dm_notes: dmNotes })
    setEditingNotes(false)
  }
  const saveSummary = async () => {
    await updateSession.mutateAsync({ summary })
    setEditingSummary(false)
  }

  const savePendingSessionEdits = async () => {
    const payload: Record<string, string> = {}
    if (editingSummary && summary !== (session?.summary ?? '')) payload.summary = summary
    if (editingNotes && dmNotes !== (session?.dm_notes ?? '')) payload.dm_notes = dmNotes
    if (Object.keys(payload).length) await updateSession.mutateAsync(payload)
    setEditingSummary(false)
    setEditingNotes(false)
  }

  const hasUnsavedSessionEdits =
    (editingSummary && summary !== (session?.summary ?? '')) ||
    (editingNotes && dmNotes !== (session?.dm_notes ?? ''))

  const { dialog: unsavedDialog } = useUnsavedChangesPrompt({
    when: hasUnsavedSessionEdits && !updateSession.isPending,
    onSave: savePendingSessionEdits,
    saving: updateSession.isPending,
  })

  const submitEncounter = async () => {
    if (!encForm.title) return
    await createEncounter.mutateAsync(encForm)
    setAddingEncounter(false)
    setEncForm({ title: '', description: '', difficulty: '', visibility: 'public' })
  }

  if (isLoading) return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>
  if (!session) return <div className="p-8 text-crimson-light text-sm">Sessão não encontrada.</div>

  const canEdit = ['admin', 'editor'].includes(session._role)
  const sessionEvents = (events ?? []).filter(event =>
    event.session_id === sessionId ||
    event.entity_links.some(link => link.entity_type === 'sessions' && link.entity_id === sessionId)
  )

  return (
    <>
    {unsavedDialog}
    <div className="p-8">
      {/* Breadcrumb */}
      <Link
        to={`/campaigns/${campaignId}/arcs/${arcId}`}
        className="inline-flex items-center gap-1.5 text-xs text-parchment/30 hover:text-parchment/60 mb-6 transition-colors"
      >
        <ArrowLeft size={12} /> Voltar ao arco
      </Link>

      <div className="flex gap-8 items-start">
        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 text-xs text-parchment/30 mb-2">
              {session.session_number && (
                <span className="font-display text-xl text-parchment/20">#{session.session_number}</span>
              )}
              {session.played_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(session.played_at).toLocaleDateString('pt-BR')}
                </span>
              )}
              {session.duration_min && (
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {session.duration_min}min
                </span>
              )}
              <span className={clsx(
                session.status === 'completed' ? 'text-emerald-400' : 'text-parchment/30'
              )}>
                {session.status === 'completed' ? '✓ Concluída' : 'Planejada'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl text-parchment">{session.title}</h1>
                {session.visibility === 'private' && <Lock size={16} className="text-parchment/30" />}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <select
                    value={session.visibility ?? 'public'}
                    onChange={e => updateSession.mutateAsync({ visibility: e.target.value as 'public' | 'private' })}
                    className="bg-stone-200 border border-stone-300 rounded px-2 py-1.5 text-xs text-parchment focus:outline-none focus:border-gold/60"
                  >
                    <option value="public">Pública</option>
                    <option value="private">Privada</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/campaigns/${campaignId}/chronicle`, { state: { session_id: sessionId } })}
                  >
                    <BookMarked size={13} /> Registrar evento
                  </Button>
                  {session.status !== 'completed' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateSession.mutateAsync({ status: 'completed' })}
                    >
                      <CheckCircle size={13} /> Marcar concluída
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateSession.mutateAsync({ status: 'planned' })}
                    >
                      <CheckCircle size={13} /> Desmarcar concluída
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Resumo */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs text-parchment/30 uppercase tracking-widest">Resumo</h2>
              {canEdit && !editingSummary && (
                <button onClick={startEditSummary} className="text-xs text-parchment/30 hover:text-gold transition-colors">
                  Editar
                </button>
              )}
            </div>
            {editingSummary ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  rows={5}
                  placeholder="O que aconteceu nessa sessão..."
                  className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 resize-y"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveSummary} loading={updateSession.isPending}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSummary(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <p className={clsx(
                'text-sm leading-relaxed whitespace-pre-wrap',
                session.summary ? 'text-parchment/70' : 'text-parchment/25 italic'
              )}>
                {session.summary || 'Nenhum resumo ainda. Clique em editar para adicionar.'}
              </p>
            )}
          </div>

          {/* Notas do mestre */}
          {(session.dm_notes !== undefined) && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs text-crimson/60 uppercase tracking-widest">🔒 Notas do Mestre</h2>
                {canEdit && !editingNotes && (
                  <button onClick={startEditNotes} className="text-xs text-parchment/30 hover:text-gold transition-colors">
                    Editar
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={dmNotes}
                    onChange={e => setDmNotes(e.target.value)}
                    rows={6}
                    placeholder="Suas notas privadas para esta sessão..."
                    className="bg-stone-200 border border-crimson/20 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-crimson/40 resize-y"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveNotes} loading={updateSession.isPending}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="bg-crimson/10 border border-crimson/20 rounded-lg p-4">
                  <p className={clsx(
                    'text-sm leading-relaxed whitespace-pre-wrap',
                    session.dm_notes ? 'text-parchment/70' : 'text-parchment/30 italic'
                  )}>
                    {session.dm_notes || 'Nenhuma nota ainda.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <SessionContextGrid
            campaignId={campaignId!}
            sessionId={sessionId!}
            links={session.links ?? []}
          />

          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-parchment/30 uppercase tracking-widest flex items-center gap-1.5">
                <BookMarked size={11} /> Eventos da crônica ({sessionEvents.length})
              </h2>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/campaigns/${campaignId}/chronicle`, { state: { session_id: sessionId } })}
                >
                  <Plus size={13} /> Registrar
                </Button>
              )}
            </div>
            {sessionEvents.length === 0 ? (
              <p className="text-parchment/25 text-sm italic">Nenhum evento registrado para esta sessão.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sessionEvents.map(event => (
                  <Link key={event.id} to={`/campaigns/${campaignId}/chronicle`}>
                    <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-lg px-4 py-3 transition-colors">
                      <p className="text-sm text-parchment font-medium truncate">{event.title}</p>
                      <p className="text-xs text-parchment/35 mt-0.5">
                        {[event.impact, event.type, event.date_in_world].filter(Boolean).join(' - ')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Encontros */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs text-parchment/30 uppercase tracking-widest flex items-center gap-1.5">
                <Sword size={11} /> Encontros ({(session.encounters ?? []).length})
              </h2>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setAddingEncounter(a => !a)}>
                  <Plus size={13} /> Adicionar
                </Button>
              )}
            </div>

            {addingEncounter && (
              <div className="bg-stone-100 border border-gold/20 rounded-xl p-4 mb-4 flex flex-col gap-3">
                <Input
                  label="Título *"
                  value={encForm.title}
                  onChange={e => setEncForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Emboscada na floresta..."
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-parchment/70 font-medium">Descrição</label>
                  <textarea
                    value={encForm.description}
                    onChange={e => setEncForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 resize-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-parchment/70 font-medium">Dificuldade</label>
                  <select
                    value={encForm.difficulty}
                    onChange={e => setEncForm(f => ({ ...f, difficulty: e.target.value }))}
                    className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
                  >
                    <option value="">Selecionar...</option>
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-parchment/70 font-medium">Visibilidade</label>
                  <select
                    value={encForm.visibility}
                    onChange={e => setEncForm(f => ({ ...f, visibility: e.target.value }))}
                    className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
                  >
                    <option value="public">Pública</option>
                    <option value="private">Privada</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitEncounter} loading={createEncounter.isPending} className="flex-1">
                    Criar encontro
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingEncounter(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {(session.encounters ?? []).length === 0 && !addingEncounter && (
              <p className="text-parchment/25 text-sm italic py-4">Nenhum encontro nesta sessão.</p>
            )}

            <div className="flex flex-col gap-2">
              {(session.encounters ?? []).map((enc: any) => (
                <EncounterCard key={enc.id} enc={enc} campaignId={campaignId!} arcId={arcId!} sessionId={sessionId!} canEdit={canEdit} />
              ))}
            </div>
          </div>
        </div>

        {/* Painel de links */}
        <LinksPanel
          campaignId={campaignId!}
          entityType="sessions"
          entityId={sessionId!}
          links={session.links ?? []}
          tags={[]}
          canEdit={canEdit}
        />
      </div>
    </div>
    </>
  )
}

function EncounterCard({ enc, campaignId, arcId, sessionId, canEdit }: {
  enc: any; campaignId: string; arcId: string; sessionId: string; canEdit: boolean
}) {
  const updateEncounter = useUpdateEncounter(campaignId, arcId, sessionId, enc.id)
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-stone-100 border border-stone-300 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-200 transition-colors"
      >
        <Sword size={14} className="text-rose-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-parchment truncate">{enc.title}</p>
          {enc.visibility === 'private' && <p className="text-xs text-parchment/30 flex items-center gap-1"><Lock size={10} /> Privado</p>}
          {enc.difficulty && (
            <p className={clsx('text-xs', DIFF_COLOR[enc.difficulty] ?? 'text-parchment/30')}>
              {enc.difficulty}
            </p>
          )}
        </div>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-full border',
          enc.status === 'completed'
            ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
            : 'text-parchment/30 border-stone-300'
        )}>
          {enc.status === 'completed' ? 'Concluído' : 'Planejado'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-stone-300 pt-3 flex flex-col gap-3">
          {enc.description && (
            <p className="text-sm text-parchment/60 leading-relaxed whitespace-pre-wrap">{enc.description}</p>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <select
                value={enc.visibility ?? 'public'}
                onChange={e => updateEncounter.mutateAsync({ visibility: e.target.value })}
                className="bg-stone-200 border border-stone-300 rounded px-2 py-1.5 text-xs text-parchment focus:outline-none focus:border-gold/60"
              >
                <option value="public">Público</option>
                <option value="private">Privado</option>
              </select>
              {enc.status !== 'completed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() => updateEncounter.mutateAsync({ status: 'completed' })}
                  loading={updateEncounter.isPending}
                >
                  <CheckCircle size={13} /> Marcar concluído
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
