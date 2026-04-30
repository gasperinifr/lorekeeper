import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Plus, Search, BookOpen, Sparkles, Lock } from 'lucide-react'
import { useEntityList } from '@/hooks/useEntities'
import { useCampaign } from '@/hooks/useCampaign'
import { ENTITY_CONFIG } from '@/config/entityConfig'
import { TagBadge } from '@/components/ui/TagBadge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FiveEBrowser } from '@/components/fiveEtools/FiveEBrowser'
import { NPCGenerator } from '@/components/ai/NPCGenerator'
import type { EntityType } from '@/types'
import { clsx } from 'clsx'

export function EntityListPage() {
  const { campaignId, entityType } = useParams<{ campaignId: string; entityType: EntityType }>()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [showBrowser, setShowBrowser] = useState(false)
  const [showAI, setShowAI] = useState(false)

  const cfg = ENTITY_CONFIG[entityType!]
  const { data, isLoading } = useEntityList(campaignId!, entityType!)
  const { data: campaign } = useCampaign(campaignId!)
  if (!cfg) return null
  const canEdit = ['admin', 'editor'].includes(campaign?.role ?? '')

  const filtered = (data ?? []).filter((e: any) => {
    const name = cfg.displayName(e).toLowerCase()
    return name.includes(search.toLowerCase())
  })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <cfg.icon size={22} className={cfg.accentClass} />
          <h1 className="font-display text-2xl text-parchment">{cfg.labelPlural}</h1>
          {data && <span className="text-parchment/30 text-sm">{data.length}</span>}
        </div>

        <div className="flex items-center gap-2">
          {canEdit && ['creatures', 'spells', 'items'].includes(entityType!) && (
            <Button size="sm" variant="ghost" onClick={() => setShowBrowser(true)}>
              <BookOpen size={14} /> Catálogo 5e
            </Button>
          )}

          {canEdit && entityType === 'npcs' && (
            <Button size="sm" variant="ghost" onClick={() => setShowAI(true)}>
              <Sparkles size={14} /> Gerar com IA
            </Button>
          )}

          {canEdit && (
            <Link to={`/campaigns/${campaignId}/${entityType}/new`}>
              <Button size="sm">
                <Plus size={14} /> Novo
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Busca local */}
      <div className="relative mb-6">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30"
        />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar em ${cfg.labelPlural.toLowerCase()}...`}
          className="w-full bg-stone-100 border border-stone-300 rounded px-3 py-2 pl-8 text-sm text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/40"
        />
      </div>

      {isLoading && <p className="text-parchment/30 text-sm">Carregando...</p>}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<cfg.icon size={40} />}
          title={search ? 'Nenhum resultado.' : `Nenhum ${cfg.label.toLowerCase()} ainda.`}
          action={
            !search && canEdit
              ? {
                  label: `Criar ${cfg.label}`,
                  onClick: () =>
                    navigate(`/campaigns/${campaignId}/${entityType}/new`)
                }
              : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((entity: any) => (
          <Link
            key={entity.id}
            to={`/campaigns/${campaignId}/${entityType}/${entity.id}`}
          >
            <div className="bg-stone-100 border border-stone-300 hover:border-gold/30 rounded-xl px-5 py-4 transition-colors group flex items-start gap-3">
              <div className={clsx('mt-0.5 shrink-0', cfg.accentClass)}>
                <cfg.icon size={16} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium text-parchment text-sm group-hover:text-gold transition-colors truncate">
                  {cfg.displayName(entity)}
                  {entity.visibility === 'private' && <Lock size={12} className="inline ml-2 text-parchment/30" />}
                </p>

                <p className="text-xs text-parchment/40 mt-0.5 truncate">
                  {cfg.displaySub(entity)}
                </p>

                {entity.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {entity.tags.map((t: any) => (
                      <TagBadge key={t.id} tag={t} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Modais */}
      {showBrowser && (
        <FiveEBrowser
          campaignId={campaignId!}
          initialTab={entityType as 'creatures' | 'spells' | 'items'}
          lockedTab
          onClose={() => setShowBrowser(false)}
        />
      )}

      {showAI && (
        <NPCGenerator
          campaignId={campaignId!}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  )
}
