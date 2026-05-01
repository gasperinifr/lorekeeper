import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import { useEntityDetail, useDeleteEntity } from '@/hooks/useEntities'
import { ENTITY_CONFIG } from '@/config/entityConfig'
import { LinksPanel } from '@/components/entity/LinksPanel'
import { CreatureStatBlock } from '@/components/entity/CreatureStatBlock'
import { SpellStatBlock } from '@/components/entity/SpellStatBlock'
import { ItemStatBlock } from '@/components/entity/ItemStatBlock'
import { TagBadge } from '@/components/ui/TagBadge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import type { EntityType } from '@/types'

// Renderiza markdown simples (quebras de linha → <br>)
function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function sanitizeHtml(value: string) {
  const template = document.createElement('template')
  template.innerHTML = value
  template.content.querySelectorAll('script,style,iframe,object,embed').forEach(node => node.remove())
  template.content.querySelectorAll('*').forEach(node => {
    ;[...node.attributes].forEach(attr => {
      const name = attr.name.toLowerCase()
      const content = attr.value.toLowerCase()
      if (name.startsWith('on') || content.startsWith('javascript:')) {
        node.removeAttribute(attr.name)
      }
    })
  })
  return template.innerHTML
}

function Prose({ text }: { text: string }) {
  if (looksLikeHtml(text)) {
    return (
      <div
        className="lk-rich-content text-sm text-parchment/70 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    )
  }

  return (
    <p className="text-sm text-parchment/70 leading-relaxed whitespace-pre-wrap">{text}</p>
  )
}

export function EntityDetailPage({ entityTypeOverride }: { entityTypeOverride?: EntityType }) {
  const { campaignId, entityType: routeEntityType, entityId } = useParams<{
    campaignId: string; entityType: EntityType; entityId: string
  }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [deleteError, setDeleteError] = useState('')

  const entityType = entityTypeOverride ?? routeEntityType
  const cfg = ENTITY_CONFIG[entityType!]
  const { data: entity, isLoading } = useEntityDetail(campaignId!, entityType!, entityId!)
  const deleteEntity = useDeleteEntity(campaignId!, entityType!)

  const canEdit = entity && ['admin', 'editor'].includes(entity._role)

  const handleDelete = async () => {
    if (!confirm(`Excluir este ${cfg?.label}? Essa ação é irreversível.`)) return
    setDeleteError('')
    try {
      await deleteEntity.mutateAsync(entityId!)
      navigate(`/campaigns/${campaignId}/${entityType}`)
    } catch (err: any) {
      setDeleteError(err.message ?? 'Não foi possível excluir.')
    }
  }

  if (isLoading) return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>
  if (!entity || !cfg) return <div className="p-8 text-crimson-light text-sm">Entidade não encontrada.</div>

  const hasStructuredBlock =
    (entityType === 'creatures' && entity.data?.statBlock) ||
    (entityType === 'spells' && entity.data?.spellBlock) ||
    (entityType === 'items' && entity.data?.itemBlock)
  const structuredMeta = ['type','cr','level','school','casting_time','range','duration','components','rarity','properties']
  const textFields = cfg.fields.filter(f =>
    f.type === 'textarea' && entity[f.key] && f.key !== 'secrets' && !hasStructuredBlock
  )
  const secretsField = cfg.fields.find(f => f.key === 'secrets')
  const metaFields = cfg.fields.filter(f =>
    f.type !== 'textarea' &&
    f.key !== cfg.fields[0].key &&
    f.key !== 'image_url' &&
    f.key !== 'portrait_url' &&
    !(hasStructuredBlock && structuredMeta.includes(f.key))
  )
  const imageUrl = entity.image_url ?? entity.portrait_url
  const imageKey = entity.image_url ? 'image_url' : entity.portrait_url ? 'portrait_url' : null

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <Link
        to={`/campaigns/${campaignId}/${entityType}`}
        className="inline-flex items-center gap-1.5 text-xs text-parchment/30 hover:text-parchment/60 mb-6 transition-colors"
      >
        <ArrowLeft size={12} /> {cfg.labelPlural}
      </Link>

      <div className="flex gap-8 items-start">
        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <cfg.icon size={18} className={cfg.accentClass} />
                <span className="text-xs text-parchment/30">{cfg.label}</span>
              </div>
              <h1 className="font-display text-3xl text-parchment">{cfg.displayName(entity)}</h1>
              {cfg.displaySub(entity) && (
                <p className="text-parchment/40 text-sm mt-1">{cfg.displaySub(entity)}</p>
              )}
              {entity.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {entity.tags.map((t: any) => <TagBadge key={t.id} tag={t} />)}
                </div>
              )}
            </div>

            {canEdit && (
              <div className="flex gap-2 shrink-0">
                <Link to={`/campaigns/${campaignId}/${entityType}/${entityId}/edit`}>
                  <Button size="sm" variant="ghost"><Pencil size={13} /> Editar</Button>
                </Link>
                <Button size="sm" variant="danger" onClick={handleDelete} loading={deleteEntity.isPending}>
                  <Trash2 size={13} />
                </Button>
              </div>
            )}
          </div>

          {deleteError && (
            <p className="text-xs text-crimson-light bg-crimson/10 border border-crimson/20 rounded px-3 py-2 mb-4">
              {deleteError}
            </p>
          )}

          {imageUrl && !hasStructuredBlock && (
            imageKey === 'portrait_url' ? (
              <img
                src={imageUrl}
                alt={cfg.displayName(entity)}
                className="mx-auto max-h-[20rem] w-auto object-contain rounded-lg border border-stone-300 bg-stone-200 mb-6"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <img
                src={imageUrl}
                alt={cfg.displayName(entity)}
                className="w-full max-h-[20rem] object-cover rounded-lg border border-stone-300 bg-stone-200 mb-6"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            )
          )}

          {/* Metadados em linha */}
          {metaFields.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6 pb-6 border-b border-stone-300">
              {metaFields.map(f => {
                const val = entity[f.key]
                if (val === undefined || val === null || val === '') return null
                const displayVal = f.key === 'visibility'
                  ? ({ public: 'Pública', private: 'Privada' } as Record<string, string>)[String(val)] ?? val
                  : typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : val
                return (
                  <div key={f.key}>
                    <p className="text-xs text-parchment/30">{f.label}</p>
                    <p className="text-sm text-parchment mt-0.5">
                      {displayVal}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Campos de texto */}
          <div className="flex flex-col gap-6">
            {entityType === 'creatures' && entity.data?.statBlock && (
              <CreatureStatBlock creature={entity} />
            )}
            {entityType === 'spells' && entity.data?.spellBlock && (
              <SpellStatBlock spell={entity} />
            )}
            {entityType === 'items' && entity.data?.itemBlock && (
              <ItemStatBlock item={entity} />
            )}

            {textFields.map(f => (
              entity[f.key] ? (
                <div key={f.key}>
                  <h3 className="text-xs text-parchment/30 uppercase tracking-widest mb-2">{f.label}</h3>
                  <Prose text={entity[f.key]} />
                </div>
              ) : null
            ))}

            {/* Segredos do mestre */}
            {secretsField && entity.secrets && (
              <div className="bg-crimson/10 border border-crimson/20 rounded-lg p-4">
                <h3 className="text-xs text-crimson/70 uppercase tracking-widest mb-2">
                  🔒 {secretsField.label}
                </h3>
                <Prose text={entity.secrets} />
              </div>
            )}

            {/* Como encontrar (NPCs) */}
            {entityType === 'npcs' && entity.data?.hook && (
              <div>
                <h3 className="text-xs text-parchment/30 uppercase tracking-widest mb-2">Como encontrar</h3>
                <Prose text={entity.data.hook} />
              </div>
            )}
          </div>
        </div>

        {/* Painel de links */}
        <LinksPanel
          campaignId={campaignId!}
          entityType={entityType!}
          entityId={entityId!}
          links={entity.links ?? []}
          eventLinks={entity.event_links ?? []}
          tags={entity.tags ?? []}
          canEdit={!!canEdit}
        />
      </div>
    </div>
  )
}
