import { useState } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { Pencil, Trash2, Link2, X } from 'lucide-react'
import { useEntityDetail, useDeleteEntity } from '@/hooks/useEntities'
import { useCreateLink } from '@/hooks/useLinks'
import { ENTITY_CONFIG } from '@/config/entityConfig'
import { LinksPanel } from '@/components/entity/LinksPanel'
import { PropagationsPanel } from '@/components/entity/PropagationsPanel'
import { GroupMembersSection } from '@/components/entity/GroupMembersSection'
import { CreatureStatBlock } from '@/components/entity/CreatureStatBlock'
import { SpellStatBlock } from '@/components/entity/SpellStatBlock'
import { ItemStatBlock } from '@/components/entity/ItemStatBlock'
import { TagBadge } from '@/components/ui/TagBadge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import type { EntityType, Group } from '@/types'
import type { LinkSuggestion } from '@/hooks/useSuggestLinks'
import type { FieldDef } from '@/config/entityConfig'

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
        className="lk-rich-content text-base text-parchment/75 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    )
  }

  return (
    <p className="text-base text-parchment/75 leading-relaxed whitespace-pre-wrap">{text}</p>
  )
}

function getFieldValue(entity: any, field: FieldDef) {
  if (field.key.startsWith('data.')) return entity.data?.[field.key.slice(5)]
  return entity[field.key]
}

function hasValue(value: any) {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

function renderValue(value: any) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

export function EntityDetailPage({ entityTypeOverride }: { entityTypeOverride?: EntityType }) {
  const { campaignId, entityType: routeEntityType, entityId } = useParams<{
    campaignId: string; entityType: EntityType; entityId: string
  }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [deleteError, setDeleteError] = useState('')
  const [suggestionError, setSuggestionError] = useState('')
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
    setSuggestionError('')
    try {
      await createLink.mutateAsync({
        source_type: entityType!,
        source_id: entityId!,
        target_type: suggestion.target_type,
        target_id: suggestion.target_id,
        relation_type: suggestion.relation_type,
        relation_label: suggestion.relation_label,
      })
      setSuggestions(current => current.filter(item => item !== suggestion))
    } catch (err: any) {
      setSuggestionError(err.message ?? 'Nao foi possivel criar a conexao.')
    }
  }

  if (isLoading) return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>
  if (!entity || !cfg) return <div className="p-8 text-crimson-light text-sm">Entidade não encontrada.</div>

  const hasStructuredBlock = ['creatures', 'spells', 'items'].includes(entityType!)
  const structuredMeta = ['type','cr','level','school','casting_time','range','duration','components','rarity','properties']
  const sectionFields = cfg.sections?.flatMap(section => section.fields) ?? []
  const sectionFieldKeys = new Set(sectionFields.map(field => field.key))
  const textFields = cfg.fields.filter(f =>
    f.type === 'textarea' && entity[f.key] && f.key !== 'secrets' && !sectionFieldKeys.has(f.key) && !hasStructuredBlock
  )
  const secretsField = [...cfg.fields, ...sectionFields].find(f => f.key === 'secrets')
  const metaFields = cfg.fields.filter(f =>
    f.type !== 'textarea' &&
    f.key !== cfg.fields[0].key &&
    f.key !== 'image_url' &&
    f.key !== 'portrait_url' &&
    !sectionFieldKeys.has(f.key) &&
    !(hasStructuredBlock && structuredMeta.includes(f.key))
  )
  const visibleSections = (cfg.sections ?? [])
    .map(section => ({
      ...section,
      fields: section.fields.filter(field => {
        if (field.key === 'secrets') return false
        if (hasStructuredBlock && structuredMeta.includes(field.key)) return false
        return hasValue(getFieldValue(entity, field))
      }),
    }))
    .filter(section => section.fields.length > 0)
  const imageUrl = entity.image_url ?? entity.portrait_url
  const imageKey = entity.image_url ? 'image_url' : entity.portrait_url ? 'portrait_url' : null
  const isGroup = entityType === 'groups'
  const groupEntity = isGroup ? entity as unknown as Group : null

  return (
    <div className="p-8 w-full max-w-[1400px] mx-auto">
      {suggestions.length > 0 && (
        <div className="fixed right-6 top-6 z-40 w-80 rounded-lg border border-gold/25 bg-stone-100 shadow-xl p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-parchment font-medium flex items-center gap-2">
                <Link2 size={14} className="text-gold" /> Sugestões de conexão
              </p>
              <p className="text-xs text-parchment/35 mt-1">Opcional, você pode descartar tudo.</p>
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
                    {suggestion.target_name ?? 'Sugestao invalida'}
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
                    disabled={!suggestion.target_name}
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
          {suggestionError && (
            <p className="text-xs text-crimson-light">{suggestionError}</p>
          )}
        </div>
      )}

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

          {entity && (
            <PropagationsPanel
              campaignId={campaignId!}
              entityType={entityType!}
              entityId={entityId!}
              entityName={entity.name ?? entity.title ?? ''}
              entityDescription={entity.description ?? entity.content ?? ''}
              entityData={entity.data}
            />
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
                className="w-full max-h-[24rem] object-contain rounded-lg border border-stone-300 bg-stone-200 mb-6"
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
                const displayVal = f.key === 'user_id'
                  ? entity.player_username ?? val
                  : f.key === 'visibility'
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
            {entityType === 'creatures' && (
              <CreatureStatBlock creature={entity} />
            )}
            {entityType === 'spells' && (
              <SpellStatBlock spell={entity} />
            )}
            {entityType === 'items' && (
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

            {visibleSections.map(section => (
              <section key={section.key} className="border-t border-stone-300 pt-5">
                <h2 className="font-display text-lg text-parchment mb-4">{section.label}</h2>
                <div className="grid grid-cols-1 gap-5">
                  {section.fields.map(field => {
                    const value = getFieldValue(entity, field)
                    const isLongText = field.type === 'textarea' || String(value).length > 120
                    return (
                      <div key={field.key}>
                        <h3 className="text-xs text-parchment/30 uppercase tracking-widest mb-2">{field.label}</h3>
                        {isLongText ? (
                          <Prose text={renderValue(value)} />
                        ) : (
                          <p className="text-base text-parchment/75 leading-relaxed">{renderValue(value)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}

            {/* Segredos do mestre */}
            {entity._can_view_dm && secretsField && entity.secrets && (
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

            {isGroup && groupEntity && (
              <GroupMembersSection
                campaignId={campaignId!}
                group={groupEntity}
                canEdit={!!canEdit}
              />
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
          entityName={entity.name ?? entity.title ?? ''}
          entityDescription={entity.description ?? entity.content ?? ''}
        />
      </div>
    </div>
  )
}
