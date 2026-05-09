import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { AtSign, ChevronDown, Image as ImageIcon, NotebookPen, Pencil, Send, Shield, Trash2, Users, X } from 'lucide-react'
import { ENTITY_CONFIG, ENTITY_TYPES } from '@/config/entityConfig'
import { useAuth } from '@/contexts/AuthContext'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useCampaign } from '@/hooks/useCampaign'
import {
  useCreateDiaryMessage,
  useDeleteDiaryMessage,
  useDiaryMessages,
  useDiaryPlayers,
  useUpdateDiaryMessage,
} from '@/hooks/useDiary'
import { useEntityList } from '@/hooks/useEntities'
import { useGroups } from '@/hooks/useGroups'
import type { ChatMention, DiaryChannel, DiaryMessage, EntityType, LinkableType } from '@/types'

const EXTRA_TYPES = [
  { type: 'arcs' as const, label: 'Arcos' },
  { type: 'sessions' as const, label: 'Sessões' },
]

function linkableLabel(type: LinkableType) {
  if (type in ENTITY_CONFIG) return ENTITY_CONFIG[type as EntityType].labelPlural
  return EXTRA_TYPES.find(t => t.type === type)?.label ?? type
}

function diaryTimestamp(value: string) {
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

function renderLinkedText(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const urlRegex = /https?:\/\/[^\s<>"']+/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0]
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    nodes.push(
      <a
        key={`${url}-${match.index}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-gold hover:text-gold-light underline decoration-gold/30 underline-offset-2 break-all"
      >
        {url}
      </a>
    )
    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function DiaryEntry({
  message,
  own,
  canDelete,
  onUpdate,
  onDelete,
  updating,
  deleting,
}: {
  message: DiaryMessage
  own: boolean
  canDelete: boolean
  onUpdate: (content: string) => Promise<unknown>
  onDelete: () => void
  updating: boolean
  deleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)

  useEffect(() => {
    if (!editing) setDraft(message.content)
  }, [editing, message.content])

  const save = async () => {
    const text = draft.trim()
    if (!text || updating) return
    await onUpdate(text)
    setEditing(false)
  }

  return (
    <article className={clsx('flex', own ? 'justify-end' : 'justify-start')}>
      <div className={clsx(
        'max-w-[78%] rounded-lg px-3 py-2 shadow-sm group',
        own ? 'bg-gold/15 border border-gold/20' : 'bg-stone-100 border border-stone-300'
      )}>
        <div className="flex items-center gap-2 mb-1">
          {!own && <span className="text-xs text-gold/75">{message.username ?? 'Usuário'}</span>}
          <span className="text-[11px] text-parchment/25">{diaryTimestamp(message.created_at)}</span>
          <div className="ml-auto flex items-center gap-1">
            {own && !editing && message.content && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="opacity-0 group-hover:opacity-100 text-parchment/25 hover:text-gold transition-all"
                title="Editar entrada"
              >
                <Pencil size={12} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="opacity-0 group-hover:opacity-100 text-parchment/25 hover:text-crimson disabled:opacity-40 transition-all"
                title="Apagar entrada"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-2">
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              className="w-full min-h-24 bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/35 focus:outline-none focus:border-gold/50 resize-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-8 px-3 rounded text-xs text-parchment/55 hover:text-parchment hover:bg-stone-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={updating || !draft.trim()}
                className="h-8 px-3 rounded bg-gold text-ink text-xs font-medium hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.content && <p className="text-sm text-parchment/80 whitespace-pre-wrap leading-relaxed">{renderLinkedText(message.content)}</p>}
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
          </>
        )}
      </div>
    </article>
  )
}

export function DiaryPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { user } = useAuth()
  const { data: campaign } = useCampaign(campaignId!)
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
  const [channel, setChannel] = useState<DiaryChannel>('group')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined)
  const [playerMenuOpen, setPlayerMenuOpen] = useState(false)
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [mentions, setMentions] = useState<ChatMention[]>([])
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const isGm = ['admin', 'editor'].includes(campaign?.role ?? '') || campaign?.play_role === 'gm'
  const players = useDiaryPlayers(campaignId!, isGm && channel === 'private')
  const effectivePlayerId = channel === 'private'
    ? (isGm && selectedPlayerId ? selectedPlayerId : user?.id)
    : undefined
  const selectedPlayer = players.data?.find(player => player.id === selectedPlayerId)

  const { data: messages, isLoading, isError, error } = useDiaryMessages(campaignId!, channel, effectivePlayerId)
  const createMessage = useCreateDiaryMessage(campaignId!, channel, effectivePlayerId)
  const updateMessage = useUpdateDiaryMessage(campaignId!, channel, effectivePlayerId)
  const deleteMessage = useDeleteDiaryMessage(campaignId!, channel, effectivePlayerId)

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
    if (channel !== 'private' || !isGm || selectedPlayerId || !players.data?.length) return
    setSelectedPlayerId(players.data[0].id)
  }, [channel, isGm, players.data, selectedPlayerId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages?.length])

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = content.trim()
    if ((!text && !imageUrl) || createMessage.isPending) return

    await createMessage.mutateAsync({
      content: text,
      image_url: imageUrl || undefined,
      mentions,
      channel,
      player_id: channel === 'private' ? effectivePlayerId : undefined,
    })
    setContent('')
    setImageUrl('')
    setMentions([])
    setMentionMenuOpen(false)
  }

  const addMention = (mention: ChatMention) => {
    setMentions(current => current.some(m => m.type === mention.type && m.id === mention.id) ? current : [...current, mention])
    setMentionFilter('')
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
      <header className="px-6 py-3 border-b border-stone-300 bg-stone-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <NotebookPen size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg text-parchment">Diário</h1>
            <p className="text-xs text-parchment/30 truncate">Registros e discussões da campanha.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded border border-stone-300 bg-stone-200 p-0.5">
            <button
              type="button"
              onClick={() => setChannel('group')}
              className={clsx(
                'h-8 px-3 rounded text-xs inline-flex items-center gap-1.5 transition-colors',
                channel === 'group' ? 'bg-gold text-ink' : 'text-parchment/50 hover:text-parchment'
              )}
              title="Diário do grupo"
            >
              <Users size={13} /> Grupo
            </button>
            <button
              type="button"
              onClick={() => setChannel('private')}
              className={clsx(
                'h-8 px-3 rounded text-xs inline-flex items-center gap-1.5 transition-colors',
                channel === 'private' ? 'bg-gold text-ink' : 'text-parchment/50 hover:text-parchment'
              )}
              title="Diário privado"
            >
              <Shield size={13} /> Privado
            </button>
          </div>

          {isGm && channel === 'private' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setPlayerMenuOpen(open => !open)}
                className="h-8 w-36 rounded border border-stone-300 bg-stone-200 px-3 text-xs text-parchment hover:border-gold/40 focus:outline-none focus:border-gold/50 transition-colors inline-flex items-center justify-between gap-2"
                title="Escolher jogador"
              >
                <span className="truncate">{selectedPlayer?.username ?? 'Escolha um jogador'}</span>
                <ChevronDown size={14} className="text-parchment/45 shrink-0" />
              </button>

              {playerMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 max-h-64 overflow-y-auto rounded-lg border border-stone-300 bg-stone-100 shadow-xl p-1 z-30">
                  {(players.data ?? []).map(player => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlayerId(player.id)
                        setPlayerMenuOpen(false)
                      }}
                      className={clsx(
                        'w-full rounded px-3 py-2 text-left text-xs transition-colors',
                        selectedPlayerId === player.id
                          ? 'bg-gold/15 text-gold'
                          : 'text-parchment/70 hover:bg-stone-200 hover:text-parchment'
                      )}
                    >
                      <span className="block truncate">{player.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isLoading && <p className="text-sm text-parchment/30">Carregando mensagens...</p>}
        <div className="flex flex-col gap-2 w-full max-w-[1400px] mx-auto">
          {isError && <p className="text-sm text-crimson-light">{error.message}</p>}

          {!isLoading && !isError && (messages ?? []).length === 0 && (
            <div className="min-h-[45vh] flex flex-col items-center justify-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gold/15 text-gold flex items-center justify-center">
                <NotebookPen size={24} />
              </div>
              <div>
                <h2 className="font-display text-2xl text-parchment">Nenhuma entrada ainda</h2>
                <p className="text-sm text-parchment/35 mt-1 max-w-lg">
                  Registre pensamentos, descobertas e pistas no ritmo da mesa.
                </p>
              </div>
            </div>
          )}

          {(messages ?? []).map(message => {
            const own = message.author_id === user?.id
            const canDelete = own || isGm
            return (
              <DiaryEntry
                key={message.id}
                message={message}
                own={own}
                canDelete={canDelete}
                updating={updateMessage.isPending}
                deleting={deleteMessage.isPending}
                onUpdate={text => updateMessage.mutateAsync({ messageId: message.id, content: text })}
                onDelete={() => deleteMessage.mutate(message.id)}
              />
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
                context="diary"
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
