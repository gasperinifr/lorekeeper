import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, Map, Sparkles, Lock, List, LayoutGrid } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useEntityList } from '@/hooks/useEntities'
import { useCampaign } from '@/hooks/useCampaign'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LocationGenerator } from '@/components/ai/LocationGenerator'
import { clsx } from 'clsx'

interface LocationNode {
  id: string
  name: string
  type?: string
  description?: string
  visibility?: 'public' | 'private'
  children: LocationNode[]
  depth: number
}

function TreeNode({ node, campaignId, depth = 0, canEdit }: {
  node: LocationNode
  campaignId: string
  depth?: number
  canEdit: boolean
}) {
  const [open, setOpen] = useState(depth < 1)
  const hasChildren = node.children.length > 0

  return (
    <div className="relative">
      {depth > 0 && (
        <span
          className="absolute top-0 bottom-0 w-px bg-emerald-400/15"
          style={{ left: `${(depth - 1) * 24 + 14}px` }}
        />
      )}
      <div
        className="flex items-center gap-2 group rounded-lg hover:bg-stone-200/70 transition-colors"
        style={{ paddingLeft: `${depth * 24}px` }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          className={clsx(
            'w-6 h-10 flex items-center justify-center text-parchment/30 transition-transform',
            open && 'rotate-90',
            !hasChildren && 'invisible'
          )}
          title={open ? 'Recolher' : 'Expandir'}
        >
          <ChevronRight size={12} />
        </button>
        <Link
          to={`/campaigns/${campaignId}/locations/${node.id}`}
          className="flex-1 flex items-center gap-2 py-2.5 text-sm text-parchment hover:text-gold transition-colors min-w-0"
        >
          <span className="w-7 h-7 rounded-md border border-emerald-400/20 bg-emerald-400/10 flex items-center justify-center shrink-0">
            <Map size={13} className="text-emerald-400" />
          </span>
          <span className="truncate">{node.name}</span>
          {node.visibility === 'private' && <Lock size={11} className="text-parchment/30" />}
          {node.type && <span className="text-xs text-parchment/30 truncate">{node.type}</span>}
          {hasChildren && <span className="text-xs text-emerald-400/45">{node.children.length}</span>}
        </Link>
        {canEdit && (
          <Link
            to={`/campaigns/${campaignId}/locations/new?parentId=${node.id}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-parchment/35 hover:text-gold p-2"
            title="Criar local dentro deste"
          >
            <Plus size={13} />
          </Link>
        )}
      </div>
      {open && hasChildren && (
        <div className="ml-3">
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} campaignId={campaignId} depth={depth + 1} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

export function LocationsPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'tree'>('list')
  const [showAI, setShowAI] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list')

  const { data: list, isLoading: listLoading } = useEntityList(campaignId!, 'locations')
  const { data: campaign } = useCampaign(campaignId!)
  const canEdit = ['admin', 'editor'].includes(campaign?.role ?? '')
  const { data: tree, isLoading: treeLoading } = useQuery({
    queryKey: ['locations-tree', campaignId],
    queryFn:  () => api.get<LocationNode[]>(`/campaigns/${campaignId}/locations/tree`),
    enabled:  view === 'tree',
  })

  const isLoading = view === 'list' ? listLoading : treeLoading

  useEffect(() => {
    const saved = localStorage.getItem('lk_entity_view_locations')
    setViewMode(saved === 'gallery' ? 'gallery' : 'list')
  }, [])

  const changeViewMode = (mode: 'list' | 'gallery') => {
    setViewMode(mode)
    localStorage.setItem('lk_entity_view_locations', mode)
  }

  return (
    <div className="p-8 w-full max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Map size={22} className="text-emerald-400" />
          <h1 className="font-display text-2xl text-parchment">Locais</h1>
          {list && <span className="text-parchment/30 text-sm">{list.length}</span>}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setShowAI(true)}>
              <Sparkles size={14} /> Gerar com IA
            </Button>
          )}

          {view === 'list' && (
            <div className="h-8 rounded border border-stone-300 bg-stone-100 p-0.5 flex items-center">
              <button
                type="button"
                onClick={() => changeViewMode('list')}
                className={clsx(
                  'h-7 w-8 rounded flex items-center justify-center transition-colors',
                  viewMode === 'list' ? 'bg-stone-300 text-gold' : 'text-parchment/35 hover:text-parchment/65'
                )}
                title="Modo lista"
              >
                <List size={15} />
              </button>
              <button
                type="button"
                onClick={() => changeViewMode('gallery')}
                className={clsx(
                  'h-7 w-8 rounded flex items-center justify-center transition-colors',
                  viewMode === 'gallery' ? 'bg-stone-300 text-gold' : 'text-parchment/35 hover:text-parchment/65'
                )}
                title="Modo galeria"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          )}

          <div className="flex bg-stone-200 border border-stone-300 rounded-md p-0.5">
            {(['list', 'tree'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={clsx(
                  'text-xs px-3 py-1.5 rounded transition-colors',
                  view === v ? 'bg-stone-100 text-parchment shadow-sm' : 'text-parchment/45 hover:text-parchment'
                )}
              >
                {v === 'list' ? 'Lista' : 'Arvore'}
              </button>
            ))}
          </div>

          {canEdit && (
            <Link to={`/campaigns/${campaignId}/locations/new`}>
              <Button size="sm"><Plus size={14} /> Novo</Button>
            </Link>
          )}
        </div>
      </div>

      {isLoading && <p className="text-parchment/30 text-sm">Carregando...</p>}

      {!isLoading && view === 'list' && (
        <>
          {(!list || list.length === 0) && (
            <EmptyState
              icon={<Map size={40} />}
              title="Nenhum local ainda."
              action={canEdit ? { label: 'Criar local', onClick: () => navigate(`/campaigns/${campaignId}/locations/new`) } : undefined}
            />
          )}
          <div className={clsx('grid gap-3', viewMode === 'gallery' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
            {(list ?? []).map((loc: any) => (
              <Link key={loc.id} to={`/campaigns/${campaignId}/locations/${loc.id}`}>
                {viewMode === 'gallery' ? (
                  <div className="bg-stone-100 border border-stone-300 hover:border-emerald-400/30 rounded-lg overflow-hidden transition-colors group h-full flex flex-col">
                    <div className="aspect-[4/3] bg-stone-200 border-b border-stone-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {loc.image_url ? (
                        <img
                          src={loc.image_url}
                          alt={loc.name}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          onError={e => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full border border-stone-300 bg-stone-100 flex items-center justify-center text-emerald-400">
                          <Map size={28} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <p className="font-medium text-parchment text-sm group-hover:text-gold transition-colors line-clamp-2">
                        {loc.name}
                        {loc.visibility === 'private' && <Lock size={12} className="inline ml-2 text-parchment/30" />}
                      </p>
                      {loc.type && <p className="text-xs text-parchment/40 mt-1 line-clamp-2">{loc.type}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="bg-stone-100 border border-stone-300 hover:border-emerald-400/30 rounded-xl px-5 py-4 transition-colors group">
                    <div className="flex items-center gap-2 mb-1">
                      <Map size={14} className="text-emerald-400" />
                      <p className="text-sm font-medium text-parchment group-hover:text-gold transition-colors truncate">
                        {loc.name}
                        {loc.visibility === 'private' && <Lock size={12} className="inline ml-2 text-parchment/30" />}
                      </p>
                    </div>
                    {loc.type && <p className="text-xs text-parchment/40 ml-6">{loc.type}</p>}
                    {loc.parent_id && <p className="text-xs text-emerald-400/40 ml-6 mt-1">sub-local</p>}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {!isLoading && view === 'tree' && (
        <div className="bg-stone-100 border border-stone-300 rounded-xl p-3">
          {(!tree || tree.length === 0) ? (
            <EmptyState icon={<Map size={40} />} title="Nenhum local ainda." />
          ) : (
            <div className="flex flex-col gap-1">
              {tree.map(node => (
                <TreeNode key={node.id} node={node} campaignId={campaignId!} canEdit={canEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      {showAI && (
        <LocationGenerator
          campaignId={campaignId!}
          onClose={() => setShowAI(false)}
        />
      )}
    </div>
  )
}
