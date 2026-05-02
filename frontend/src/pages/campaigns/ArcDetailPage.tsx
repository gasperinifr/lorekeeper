import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, Calendar, Clock, Lock, BookMarked } from 'lucide-react'
import { useArcDetail, useCreateSession, useUpdateArc } from '@/hooks/useArcs'
import { useEvents } from '@/hooks/useEvents'
import { LinksPanel } from '@/components/entity/LinksPanel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Arc, Session } from '@/types'
import { clsx } from 'clsx'

export function ArcDetailPage() {
  const { campaignId, arcId } = useParams<{ campaignId: string; arcId: string }>()
  const { data: arc, isLoading } = useArcDetail(campaignId!, arcId!)
  const { data: events } = useEvents(campaignId!)
  const createSession = useCreateSession(campaignId!, arcId!)
  const updateArc = useUpdateArc(campaignId!, arcId!)

  const [addingSession, setAddingSession] = useState(false)
  const [form, setForm] = useState<{ title: string; session_number: string; played_at: string; visibility: 'public' | 'private' }>({
    title: '',
    session_number: '',
    played_at: '',
    visibility: 'public',
  })

  const submit = async () => {
    if (!form.title) return
    await createSession.mutateAsync({
      title: form.title,
      session_number: form.session_number ? Number(form.session_number) : undefined,
      played_at: form.played_at || undefined,
      visibility: form.visibility,
    })
    setAddingSession(false)
    setForm({ title: '', session_number: '', played_at: '', visibility: 'public' })
  }

  if (isLoading) return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>
  if (!arc) return <div className="p-8 text-crimson-light text-sm">Arco nao encontrado.</div>
  const canEdit = ['admin', 'editor'].includes((arc as any)._role)
  const arcEvents = (events ?? []).filter(event =>
    event.arc_id === arcId ||
    event.entity_links.some(link => link.entity_type === 'arcs' && link.entity_id === arcId)
  )

  return (
    <div className="p-8 w-full max-w-[1400px] mx-auto">
      <div className="flex gap-8 items-start">
        <div className="flex-1 min-w-0 max-w-3xl">
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl text-parchment">{arc.title}</h1>
                {arc.visibility === 'private' && <Lock size={16} className="text-parchment/30" />}
              </div>
              {canEdit && (
                <select
                  value={arc.visibility ?? 'public'}
                  onChange={e => updateArc.mutateAsync({ visibility: e.target.value as Arc['visibility'] })}
                  className="bg-stone-200 border border-stone-300 rounded px-2 py-1.5 text-xs text-parchment focus:outline-none focus:border-gold/60"
                >
                  <option value="public">Publico</option>
                  <option value="private">Privado</option>
                </select>
              )}
            </div>
            {arc.summary && <p className="text-parchment/50 text-sm leading-relaxed">{arc.summary}</p>}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs text-parchment/30 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={12} /> Sessoes ({(arc.sessions ?? []).length})
            </h2>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => setAddingSession(a => !a)}>
                <Plus size={13} /> Adicionar sessao
              </Button>
            )}
          </div>

          {addingSession && (
            <div className="bg-stone-100 border border-gold/30 rounded-xl p-4 mb-4 flex flex-col gap-3">
              <Input label="Titulo *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Sessao 1..." />
              <div className="flex gap-3">
                <Input label="Numero da sessao" type="number" value={form.session_number} onChange={e => setForm(f => ({ ...f, session_number: e.target.value }))} />
                <Input label="Data jogada" type="date" value={form.played_at} onChange={e => setForm(f => ({ ...f, played_at: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-parchment/70 font-medium">Visibilidade</label>
                <select
                  value={form.visibility}
                  onChange={e => setForm(f => ({ ...f, visibility: e.target.value as 'public' | 'private' }))}
                  className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
                >
                  <option value="public">Publica</option>
                  <option value="private">Privada</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={submit} loading={createSession.isPending} className="flex-1">Criar sessao</Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingSession(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {(arc.sessions ?? []).length === 0 && !addingSession && (
            <p className="text-parchment/25 text-sm italic text-center py-8">Nenhuma sessao neste arco ainda.</p>
          )}

          <div className="flex flex-col gap-2">
            {(arc.sessions ?? []).map((session: Session) => (
              <Link
                key={session.id}
                to={`/campaigns/${campaignId}/arcs/${arcId}/sessions/${session.id}`}
              >
                <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-xl px-5 py-4 transition-colors group flex items-center gap-4">
                  {session.session_number && (
                    <span className="text-2xl font-display text-parchment/20 w-8 text-center shrink-0">
                      {session.session_number}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-parchment group-hover:text-gold transition-colors truncate">
                      {session.title}
                      {session.visibility === 'private' && <Lock size={12} className="inline ml-2 text-parchment/30" />}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-parchment/30 mt-0.5">
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
                        'capitalize',
                        session.status === 'completed' ? 'text-emerald-400/60' : 'text-parchment/30'
                      )}>
                        {session.status === 'completed' ? 'Concluida' : 'Planejada'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="text-xs text-parchment/30 uppercase tracking-widest flex items-center gap-2 mb-4">
              <BookMarked size={12} /> Eventos da crônica ({arcEvents.length})
            </h2>
            {arcEvents.length === 0 ? (
              <p className="text-parchment/25 text-sm italic">Nenhum evento registrado para este arco.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {arcEvents.map(event => (
                  <Link key={event.id} to={`/campaigns/${campaignId}/chronicle`}>
                    <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-xl px-4 py-3 transition-colors">
                      <p className="text-sm text-parchment font-medium">{event.title}</p>
                      <p className="text-xs text-parchment/35 mt-0.5">
                        {[event.impact, event.type, event.date_in_world].filter(Boolean).join(' - ')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <LinksPanel
          campaignId={campaignId!}
          entityType="arcs"
          entityId={arcId!}
          links={(arc as any).links ?? []}
          tags={[]}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
