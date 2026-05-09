import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AtSign, Image as ImageIcon, MessageSquare, Send, Trash2, X } from 'lucide-react'
import { ENTITY_CONFIG, ENTITY_TYPES } from '@/config/entityConfig'
import { useEntityList } from '@/hooks/useEntities'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useGroups } from '@/hooks/useGroups'
import { useCampaign } from '@/hooks/useCampaign'
import { useAuth } from '@/contexts/AuthContext'
import { useChatMessages, useCreateChatMessage, useDeleteChatMessage } from '@/hooks/useChat'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { Button } from '@/components/ui/Button'
import type { ChatMention, EntityType, LinkableType } from '@/types'
import { clsx } from 'clsx'

const EXTRA_TYPES = [
  { type: 'arcs' as const, label: 'Arcos' },
  { type: 'sessions' as const, label: 'Sessões' },
]

function linkableLabel(type: LinkableType) {
  if (type in ENTITY_CONFIG) return ENTITY_CONFIG[type as EntityType].labelPlural
  return EXTRA_TYPES.find(t => t.type === type)?.label ?? type
}

function messageTimestamp(value: string) {
  const sentAt = new Date(value)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const messageDay = new Date(sentAt.getFullYear(), sentAt.getMonth(), sentAt.getDate())
  const diffDays = Math.round((today.getTime() - messageDay.getTime()) / 86400000)
  const time = sentAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (diffDays === 0) return `hoje ${time}`
  if (diffDays === 1) return `ontem ${time}`
  if (diffDays > 1 && diffDays < 7) {
    return `${sentAt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} ${time}`
  }
  return `${sentAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`
}

export function TavernaPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()
  const { data: campaign } = useCampaign(campaignId!)
  const { data: messages, isLoading } = useChatMessages(campaignId!)
  const createMessage = useCreateChatMessage(campaignId!)
  const deleteMessage = useDeleteChatMessage(campaignId!)

  const characters = useEntityList(campaignId!, 'characters')
  const npcs = useEntityList(campaignId!, 'npcs')
  const locations = useEntityList(campaignId!, 'locations')
  const items = useEntityList(campaignId!, 'items')
  const spells = useEntityList(campaignId!, 'spells')
  const creatures = useEntityList(campaignId!, 'creatures')
  const notes = useEntityList(campaignId!, 'notes')
  const groups = useGroups(campaignId!)
  const arcs = useArcs(campaignId!)
  const sessions = useCampaignSessions(campaignId!)

  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [mentions, setMentions] = useState<ChatMention[]>([])
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const canModerate = ['admin', 'editor'].includes(campaign?.role ?? '')

  const lists: Partial<Record<LinkableType, any[]>> = {
    characters: characters.data ?? [],
    npcs: npcs.data ?? [],
    locations: locations.data ?? [],
    items: items.data ?? [],
    spells: spells.data ?? [],
    creatures: creatures.data ?? [],
    notes: notes.data ?? [],
    groups: groups.data ?? [],
    arcs: arcs.data ?? [],
    sessions: sessions.data ?? [],
  }

  const displayName = (type: LinkableType, item: any) => {
    if (type in ENTITY_CONFIG) return ENTITY_CONFIG[type as EntityType].displayName(item)
    if (type === 'arcs') return item.title
    if (type === 'sessions') return [item.title, item.arc_title].filter(Boolean).join(' - ')
    return item.title ?? item.name ?? item.id
  }

  const pathFor = (type: LinkableType, item: any) => {
    if (type === 'arcs') return `/campaigns/${campaignId}/arcs/${item.id}`
    if (type === 'sessions') return `/campaigns/${campaignId}/arcs/${item.arc_id}/sessions/${item.id}`
    return `/campaigns/${campaignId}/${type}/${item.id}`
  }

  const mentionItems = useMemo(() => {
    const types = [...ENTITY_TYPES, ...EXTRA_TYPES.map(t => t.type)] as LinkableType[]
    return types.flatMap(type => (lists[type] ?? []).map((item: any) => ({
      type,
      id: item.id,
      label: displayName(type, item),
      path: pathFor(type, item),
      typeLabel: linkableLabel(type),
    })))
  }, [characters.data, npcs.data, locations.data, items.data, spells.data, creatures.data, notes.data, groups.data, arcs.data, sessions.data])

  const filteredMentions = mentionItems
    .filter(item => item.label.toLowerCase().includes(mentionFilter.toLowerCase()) || item.typeLabel.toLowerCase().includes(mentionFilter.toLowerCase()))
    .slice(0, 36)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages?.length])

  const addMention = (mention: ChatMention) => {
    setMentions(current => current.some(m => m.type === mention.type && m.id === mention.id) ? current : [...current, mention])
    setMentionFilter('')
    setMentionMenuOpen(false)
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!content.trim() && !imageUrl) return
    await createMessage.mutateAsync({ content: content.trim(), image_url: imageUrl || undefined, mentions })
    setContent('')
    setImageUrl('')
    setMentions([])
    setMentionMenuOpen(false)
  }

  const onTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="h-full flex flex-col bg-stone">
      <header className="px-6 py-3 border-b border-stone-300 bg-stone-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gold/15 text-gold flex items-center justify-center">
          <MessageSquare size={18} />
        </div>
        <div>
          <h1 className="font-display text-lg text-parchment">Taverna</h1>
          <p className="text-xs text-parchment/30">Mensagens, imagens e referencias da campanha.</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isLoading && <p className="text-sm text-parchment/30">Carregando mensagens...</p>}
        <div className="flex flex-col gap-2 w-full max-w-[1400px] mx-auto">
          {(messages ?? []).map(message => {
            const own = message.user_id === user?.id
            const canDelete = own || canModerate
            return (
              <article key={message.id} className={clsx('flex', own ? 'justify-end' : 'justify-start')}>
                <div className={clsx(
                  'max-w-[78%] rounded-lg px-3 py-2 shadow-sm group',
                  own ? 'bg-gold/15 border border-gold/20' : 'bg-stone-100 border border-stone-300'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {!own && <span className="text-xs text-gold/75">{message.username ?? 'Usuário'}</span>}
                    <span className="text-[11px] text-parchment/25">{messageTimestamp(message.created_at)}</span>
                    {canDelete && (
                      <button
                        onClick={() => deleteMessage.mutate(message.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-parchment/25 hover:text-crimson transition-all"
                        title="Apagar mensagem"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {message.content && <p className="text-sm text-parchment/80 whitespace-pre-wrap leading-relaxed">{message.content}</p>}
                  {message.image_url && (
                    <img
                      src={message.image_url}
                      alt="Imagem enviada"
                      className="mt-2 max-h-80 max-w-full rounded-md object-contain bg-stone-300"
                    />
                  )}
                  {(message.mentions ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {message.mentions?.map(mention => (
                        <Link
                          key={`${mention.type}-${mention.id}`}
                          to={mention.path}
                          className="text-xs rounded-full bg-stone-200 text-gold px-2 py-0.5 hover:bg-gold/10 transition-colors"
                        >
                          @{mention.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-stone-300 bg-stone-100 px-5 py-3">
        <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-2 relative">
          {mentionMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full max-w-xl rounded-lg border border-stone-300 bg-stone-100 shadow-xl p-3 z-20">
              <input
                autoFocus
                value={mentionFilter}
                onChange={event => setMentionFilter(event.target.value)}
                placeholder="Buscar algo para citar..."
                className="w-full bg-stone-200 border border-stone-300 rounded px-3 py-2 text-xs text-parchment placeholder-parchment/35 focus:outline-none focus:border-gold/50 mb-3"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-72 overflow-y-auto">
                {filteredMentions.map(mention => (
                  <button
                    key={`${mention.type}-${mention.id}`}
                    type="button"
                    onClick={() => addMention(mention)}
                    className="text-left rounded px-3 py-2 hover:bg-stone-200 transition-colors"
                  >
                    <p className="text-xs text-parchment truncate">{mention.label}</p>
                    <p className="text-[11px] text-parchment/30">{mention.typeLabel}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(mentions.length > 0 || imageUrl) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {mentions.map(mention => (
                <button
                  type="button"
                  key={`${mention.type}-${mention.id}`}
                  onClick={() => setMentions(current => current.filter(m => !(m.type === mention.type && m.id === mention.id)))}
                  className="text-xs rounded-full border border-gold/25 bg-gold/10 text-gold px-2 py-1 inline-flex items-center gap-1"
                >
                  @{mention.label} <X size={11} />
                </button>
              ))}
              {imageUrl && (
                <button type="button" onClick={() => setImageUrl('')} className="text-xs rounded-full border border-stone-300 bg-stone-200 text-parchment/55 px-2 py-1 inline-flex items-center gap-1">
                  <ImageIcon size={12} /> imagem <X size={11} />
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-[auto_auto_1fr_auto] gap-2 items-end">
            <button
              type="button"
              onClick={() => setMentionMenuOpen(open => !open)}
              className="h-10 w-10 rounded-full text-parchment/45 hover:text-gold hover:bg-stone-200 transition-colors flex items-center justify-center"
              title="Citar"
            >
              <AtSign size={18} />
            </button>
            <div className="w-48">
              <ImageUpload
                currentUrl={imageUrl}
                context="taverna"
                onUpload={setImageUrl}
                compact
              />
            </div>
            <textarea
              value={content}
              onChange={event => setContent(event.target.value)}
              onKeyDown={onTextKeyDown}
              rows={1}
              placeholder="Mensagem"
              className="min-h-10 max-h-28 bg-stone-200 border border-stone-300 rounded-2xl px-4 py-2.5 text-sm text-parchment placeholder-parchment/35 focus:outline-none focus:border-gold/50 resize-none"
            />
            <button
              type="submit"
              disabled={createMessage.isPending || (!content.trim() && !imageUrl)}
              className="h-10 w-10 rounded-full bg-gold text-ink hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              title="Enviar"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
