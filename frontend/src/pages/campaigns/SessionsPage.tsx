import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, GitBranch, Plus } from 'lucide-react'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useCampaign } from '@/hooks/useCampaign'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Session } from '@/types'
import { clsx } from 'clsx'

function SessionCard({ session, campaignId }: {
  session: Session & { arc_title?: string }
  campaignId: string
}) {
  return (
    <Link to={`/campaigns/${campaignId}/arcs/${session.arc_id}/sessions/${session.id}`}>
      <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-xl px-5 py-4 transition-colors group flex items-center gap-4">
        <div className="w-10 h-10 rounded border border-stone-300 bg-stone-200 flex items-center justify-center shrink-0">
          <Calendar size={16} className="text-gold/70" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-parchment group-hover:text-gold transition-colors truncate">
            {session.title}
          </p>
          <p className="text-xs text-parchment/35 mt-0.5 truncate">
            {[session.arc_title, session.session_number ? `Sessão ${session.session_number}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={clsx(
          'text-xs px-2 py-1 rounded border',
          session.status === 'completed'
            ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
            : 'text-parchment/35 border-stone-300'
        )}>
          {session.status === 'completed' ? 'Concluída' : 'Planejada'}
        </span>
      </div>
    </Link>
  )
}

export function SessionsPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const { data: arcs, isLoading: arcsLoading } = useArcs(campaignId!)
  const { data: sessions, isLoading: sessionsLoading } = useCampaignSessions(campaignId!)
  const { data: campaign } = useCampaign(campaignId!)

  const isLoading = arcsLoading || sessionsLoading
  const hasArcs = (arcs?.length ?? 0) > 0
  const canEdit = ['admin', 'editor'].includes(campaign?.role ?? '')

  return (
    <div className="p-8 w-full max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-parchment">Sessões</h1>
          <p className="text-parchment/30 text-sm mt-1">Registros de jogo organizados pelos arcos da campanha.</p>
        </div>
        {hasArcs && canEdit && (
          <Button size="sm" onClick={() => navigate(`/campaigns/${campaignId}/arcs`)}>
            <Plus size={14} /> Criar em um arco
          </Button>
        )}
      </div>

      {isLoading && <p className="text-parchment/30 text-sm">Carregando...</p>}

      {!isLoading && !hasArcs && (
        <EmptyState
          icon={<Calendar size={40} />}
          title="Sessões aparecem depois de um ato."
          description="Crie primeiro um arco ou ato narrativo; depois você poderá adicionar sessões dentro dele."
          action={canEdit ? {
            label: 'Criar ato',
            onClick: () => navigate(`/campaigns/${campaignId}/arcs`),
          } : undefined}
        />
      )}

      {!isLoading && hasArcs && (sessions?.length ?? 0) === 0 && (
        <EmptyState
          icon={<GitBranch size={40} />}
          title="Nenhuma sessão criada."
          description="Abra um arco para registrar a primeira sessão desse trecho da história."
          action={canEdit ? {
            label: 'Ver arcos',
            onClick: () => navigate(`/campaigns/${campaignId}/arcs`),
          } : undefined}
        />
      )}

      <div className="flex flex-col gap-3">
        {(sessions ?? []).map(session => (
          <SessionCard key={session.id} session={session} campaignId={campaignId!} />
        ))}
      </div>
    </div>
  )
}
