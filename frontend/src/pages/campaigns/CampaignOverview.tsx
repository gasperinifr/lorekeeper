import { useParams, Link } from 'react-router-dom'
import {
  Users, Skull, Map, Sword, Bug, Scroll,
  GitBranch, Calendar, TrendingUp, BookOpen,
} from 'lucide-react'
import { useCampaign } from '@/hooks/useCampaign'
import { useEntityList } from '@/hooks/useEntities'
import { useArcs } from '@/hooks/useArcs'
import type { EntityType } from '@/types'
import { clsx } from 'clsx'

interface StatCardProps {
  label: string
  count: number
  icon: React.ElementType
  color: string
  to: string
}

function StatCard({ label, count, icon: Icon, color, to }: StatCardProps) {
  return (
    <Link to={to}>
      <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-xl px-4 py-3 transition-colors group min-h-[4.75rem]">
        <div className="flex items-center justify-between mb-2">
          <Icon size={16} className={clsx(color, 'opacity-70 group-hover:opacity-100 transition-opacity')} />
          <span className="font-display text-2xl leading-none text-parchment">{count}</span>
        </div>
        <p className="text-xs text-parchment/40 group-hover:text-parchment/60 transition-colors">{label}</p>
      </div>
    </Link>
  )
}

const ENTITY_STATS: { type: EntityType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'characters', label: 'Personagens', icon: Users, color: 'text-sky-400' },
  { type: 'npcs', label: 'NPCs', icon: Skull, color: 'text-violet-400' },
  { type: 'locations', label: 'Locais', icon: Map, color: 'text-emerald-400' },
  { type: 'items', label: 'Itens', icon: Sword, color: 'text-amber-400' },
  { type: 'spells', label: 'Magias', icon: BookOpen, color: 'text-cyan-300' },
  { type: 'creatures', label: 'Criaturas', icon: Bug, color: 'text-rose-400' },
  { type: 'notes', label: 'Notas', icon: Scroll, color: 'text-parchment/50' },
]

function EntityStatCard({ type, label, icon, color, campaignId }: typeof ENTITY_STATS[0] & { campaignId: string }) {
  const { data } = useEntityList(campaignId, type)
  return (
    <StatCard
      label={label}
      count={data?.length ?? 0}
      icon={icon}
      color={color}
      to={`/campaigns/${campaignId}/${type}`}
    />
  )
}

const STATUS_LABEL = { active: 'Ativa', paused: 'Pausada', completed: 'Concluida' }

export function CampaignOverview() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { data: campaign, isLoading } = useCampaign(campaignId!)
  const { data: arcs } = useArcs(campaignId!)

  if (isLoading) return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>
  if (!campaign) return null

  const activeArc = arcs?.find(a => a.status === 'active')
  const totalSessions = arcs?.reduce((acc, a) => acc + (Number(a.session_count) || 0), 0) ?? 0
  const bannerUrl = campaign.hub_banner_url || campaign.cover_image_url
  const bannerFit = campaign.hub_banner_url ? campaign.hub_banner_fit ?? 'cover' : 'contain'
  const bannerPosition = campaign.hub_banner_position ?? 'center'

  return (
    <div className="p-6 lg:p-8 w-full max-w-[1400px] mx-auto">
      <div className="mb-6">
        {bannerUrl && (
          <div className="h-[clamp(14rem,32vh,24rem)] rounded-xl overflow-hidden mb-5 bg-stone-100 border border-stone-300 flex items-center justify-center">
            <img
              src={bannerUrl}
              alt={campaign.title}
              className={clsx('h-full w-full', bannerFit === 'cover' ? 'object-cover' : 'object-contain')}
              style={{ objectPosition: bannerPosition }}
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-parchment/30 mb-1 uppercase tracking-widest">
              {campaign.scenario_type ?? 'Campanha'}
            </p>
            <h1 className="font-display text-3xl text-parchment leading-tight">{campaign.title}</h1>
            {campaign.description && (
              <p className="text-parchment/50 text-sm mt-2 max-w-2xl leading-relaxed line-clamp-2">
                {campaign.description}
              </p>
            )}
          </div>
          <span className={clsx(
            'shrink-0 inline-block text-xs px-2.5 py-1 rounded-full border',
            campaign.status === 'active' && 'text-gold border-gold/30 bg-gold/10',
            campaign.status === 'paused' && 'text-parchment/40 border-stone-300',
            campaign.status === 'completed' && 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
          )}>
            {STATUS_LABEL[campaign.status]}
          </span>
        </div>
      </div>

      {activeArc && (
        <Link to={`/campaigns/${campaignId}/arcs/${activeArc.id}`}>
          <div className="bg-gold/10 border border-gold/30 rounded-xl px-5 py-4 mb-5 hover:bg-gold/15 transition-colors">
            <p className="text-xs text-gold/60 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <TrendingUp size={11} /> Arco em andamento
            </p>
            <p className="font-display text-lg text-parchment">{activeArc.title}</p>
            {activeArc.summary && (
              <p className="text-sm text-parchment/40 mt-1 line-clamp-1">{activeArc.summary}</p>
            )}
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link to={`/campaigns/${campaignId}/arcs`}>
          <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-xl p-4 transition-colors group min-h-[6rem]">
            <div className="flex items-center justify-between mb-3">
              <GitBranch size={16} className="text-gold/60 group-hover:text-gold transition-colors" />
              <span className="font-display text-2xl leading-none text-parchment">{arcs?.length ?? 0}</span>
            </div>
            <p className="text-xs text-parchment/40 group-hover:text-parchment/60 transition-colors">Arcos / Atos</p>
          </div>
        </Link>
        <div className="bg-stone-100 border border-stone-300 rounded-xl p-4 min-h-[6rem]">
          <div className="flex items-center justify-between mb-3">
            <Calendar size={16} className="text-parchment/30" />
            <span className="font-display text-2xl leading-none text-parchment">{totalSessions}</span>
          </div>
          <p className="text-xs text-parchment/40">Sessoes no total</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-parchment/30 uppercase tracking-widest mb-3">Mundo</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {ENTITY_STATS.map(s => (
            <EntityStatCard key={s.type} {...s} campaignId={campaignId!} />
          ))}
        </div>
      </div>

      {campaign.members && campaign.members.length > 0 && (
        <div className="mt-5">
          <p className="text-xs text-parchment/30 uppercase tracking-widest mb-3">Membros</p>
          <div className="flex flex-wrap gap-2">
            {campaign.members.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-stone-100 border border-stone-300 rounded-full px-3 py-1.5">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
                  {m.username[0].toUpperCase()}
                </div>
                <span className="text-xs text-parchment/70">{m.username}</span>
                <span className="text-xs text-parchment/30 capitalize">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
