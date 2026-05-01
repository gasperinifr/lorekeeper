import { useState } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { Pencil, Trash2, ArrowLeft, Link2, X } from 'lucide-react'
import { useEntityDetail, useDeleteEntity } from '@/hooks/useEntities'
import { useCreateLink } from '@/hooks/useLinks'
import { ENTITY_CONFIG } from '@/config/entityConfig'
import { LinksPanel } from '@/components/entity/LinksPanel'
import { CreatureStatBlock } from '@/components/entity/CreatureStatBlock'
import { SpellStatBlock } from '@/components/entity/SpellStatBlock'
import { ItemStatBlock } from '@/components/entity/ItemStatBlock'
import { TagBadge } from '@/components/ui/TagBadge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import type { EntityType } from '@/types'
import type { LinkSuggestion } from '@/hooks/useSuggestLinks'

const RELATION_LABELS: Record<string, string> = {
  alianca: 'alianca',
  rivalidade: 'rivalidade',
  familia: 'familia',
  lealdade: 'lealdade',
  segredo: 'segredo',
  divida: 'divida',
  amor: 'amor',
  odio: 'odio',
  mentor: 'mentor',
  neutro: 'neutro',
  outro: 'outro',
}

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
  const location = useLocation()
  const { user } = useAuth()
  const [deleteError, setDeleteError] = useState('')
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>(
    () => (location.state as { linkSuggestions?: LinkSuggestion[] } | null)?.linkSuggestions ?? []
  )

  const entityType = entityTypeOverride ?? routeEntityType
  const cfg = ENTITY_CONFIG[entityType!]
  const { data: entity, isLoading } = useEntityDetail(campaignId!, entityType!, entityId!)
  const deleteEntity = useDeleteEntity(campaignId!, entityType!)
  const createLink = useCreateLink(campaignId!)

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

  const connectSuggestion = async (suggestion: LinkSuggestion) => {
    await createLink.mutateAsync({
      source_type: entityType!,
      source_id: entityId!,
      target_type: suggestion.target_type,
      target_id: suggestion.target_id,
      relation_type: suggestion.relation_type,
      relation_label: suggestion.relation_label,
    })
    setSuggestions(current => current.filter(item => item !== suggestion))
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
      {suggestions.length > 0 && (
        <div className="fixed right-6 top-6 z-40 w-80 rounded-lg border border-gold/25 bg-stone-100 shadow-xl p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-parchment font-medium flex items-center gap-2">
                <Link2 size={14} className="text-gold" /> Sugestoes de conexao
              </p>
              <p className="text-xs text-parchment/35 mt-1">Opcional, voce pode descartar tudo.</p>
            </div>
            <button
              type="button"
              onClick={() => setSuggestions([])}
              className="text-parchment/35 hover:text-parchment/70 transition-colors"
              aria-label="Fechar sugestoes"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {suggestions.map(suggestion => (
              <div key={`${suggestion.target_type}-${suggestion.target_id}`} className="rounded border border-stone-300 bg-stone-200 p-3 flex flex-col gap-2">
                <div>
                  <p className="text-xs text-parchment">
                    {suggestion.target_name ?? suggestion.target_id}
                    <span className="text-gold ml-2">{RELATION_LABELS[suggestion.relation_type] ?? suggestion.relation_type}</span>
                  </p>
                  {suggestion.relation_label && (
                    <p className="text-xs text-parchment/35 mt-0.5">{suggestion.relation_label}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => connectSuggestion(suggestion)}
                    loading={createLink.isPending}
                    className="flex-1"
                  >
                    Conectar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSuggestions(current => current.filter(item => item !== suggestion))}
                  >
                    Ignorar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
