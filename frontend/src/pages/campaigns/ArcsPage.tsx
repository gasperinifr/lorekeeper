import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus, ChevronRight, Calendar, CheckCircle2, Clock, Lock } from 'lucide-react'
import { useArcs, useCreateArc } from '@/hooks/useArcs'
import { useCampaign } from '@/hooks/useCampaign'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { GitBranch } from 'lucide-react'
import { clsx } from 'clsx'
import type { Arc } from '@/types'

const STATUS_ICON  = { upcoming: Clock, active: GitBranch, completed: CheckCircle2 }
const STATUS_COLOR = { upcoming: 'text-parchment/40', active: 'text-gold', completed: 'text-emerald-400' }
const STATUS_LABEL = { upcoming: 'Em breve', active: 'Em andamento', completed: 'Concluído' }

function ArcCard({ arc, campaignId }: { arc: Arc; campaignId: string }) {
  const Icon = STATUS_ICON[arc.status]
  const sessionCount = Number(arc.session_count ?? 0)
  return (
    <Link to={`/campaigns/${campaignId}/arcs/${arc.id}`}>
      <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-xl p-5 transition-colors group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className={clsx('flex items-center gap-1.5 text-xs mb-1', STATUS_COLOR[arc.status])}>
              <Icon size={12} /> {STATUS_LABEL[arc.status]}
              {arc.visibility === 'private' && <Lock size={11} className="text-parchment/30" />}
            </div>
            <h2 className="font-display text-lg text-parchment group-hover:text-gold transition-colors">
              {arc.title}
            </h2>
            {arc.summary && (
              <p className="text-sm text-parchment/40 mt-1 line-clamp-2">{arc.summary}</p>
            )}
          </div>
          <ChevronRight size={16} className="text-parchment/20 group-hover:text-gold/50 mt-1 shrink-0 transition-colors" />
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-parchment/30">
          <span className="flex items-center gap-1">
            <Calendar size={11} /> {sessionCount} {sessionCount === 1 ? 'sessão' : 'sessões'}
          </span>
          {arc.started_at && <span>{new Date(arc.started_at).toLocaleDateString('pt-BR')}</span>}
        </div>
      </div>
    </Link>
  )
}

export function ArcsPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { data: arcs, isLoading } = useArcs(campaignId!)
  const { data: campaign } = useCampaign(campaignId!)
  const canEdit = ['admin', 'editor'].includes(campaign?.role ?? '')
  const createArc = useCreateArc(campaignId!)

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{ title: string; summary: string; status: Arc['status']; visibility: 'public' | 'private' }>({
    title: '',
    summary: '',
    status: 'upcoming',
    visibility: 'public',
  })

  const submit = async () => {
    if (!form.title) return
    await createArc.mutateAsync(form)
    setCreating(false)
    setForm({ title: '', summary: '', status: 'upcoming', visibility: 'public' })
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-parchment">Arcos & Atos</h1>
          <p className="text-parchment/30 text-sm mt-1">A estrutura narrativa da campanha.</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating(c => !c)}>
            <Plus size={14} /> Novo arco
          </Button>
        )}
      </div>

      {/* Formulário rápido de criação */}
      {canEdit && creating && (
        <div className="bg-stone-100 border border-gold/30 rounded-xl p-5 mb-6 flex flex-col gap-4">
          <Input label="Título do arco *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Resumo</label>
            <textarea
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              rows={2}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 resize-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as Arc['status'] }))}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              <option value="upcoming">Em breve</option>
              <option value="active">Em andamento</option>
              <option value="completed">Concluído</option>
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
          <div className="flex gap-2">
            <Button onClick={submit} loading={createArc.isPending} size="sm" className="flex-1">Criar arco</Button>
            <Button onClick={() => setCreating(false)} variant="ghost" size="sm">Cancelar</Button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-parchment/30 text-sm">Carregando...</p>}

      {!isLoading && (!arcs || arcs.length === 0) && (
        <EmptyState
          icon={<GitBranch size={40} />}
          title="Nenhum arco ainda."
          description="Estruture sua campanha em arcos narrativos."
          action={canEdit ? { label: 'Criar primeiro arco', onClick: () => setCreating(true) } : undefined}
        />
      )}

      <div className="flex flex-col gap-3">
        {(arcs ?? []).map(arc => (
          <ArcCard key={arc.id} arc={arc} campaignId={campaignId!} />
        ))}
      </div>
    </div>
  )
}
