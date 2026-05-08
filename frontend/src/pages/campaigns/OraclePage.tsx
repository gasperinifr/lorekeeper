import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { Send, Shield, Sparkles, Trash2, UserRound } from 'lucide-react'
import { useCampaign } from '@/hooks/useCampaign'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useEntityList } from '@/hooks/useEntities'
import { useEvents } from '@/hooks/useEvents'
import { useClearOracleHistory, useOracleHistory, useSendOracleMessage } from '@/hooks/useOracle'
import { ENTITY_CONFIG, ENTITY_TYPES } from '@/config/entityConfig'
import type { EntityType, LinkableType, OracleMode } from '@/types'

const SUGGESTIONS = [
  'Quem sao os aliados mais importantes da campanha?',
  'O que aconteceu nas ultimas 3 sessoes?',
  'Crie 3 plot hooks envolvendo um local e uma faccao.',
  'Quais NPCs ainda nao foram apresentados?',
  'Que segredos os jogadores ainda nao descobriram?',
]

type CitationTarget = {
  label: string
  path: string
  type: LinkableType
}

function citationPath(campaignId: string, type: LinkableType, item: any) {
  if (type === 'arcs') return `/campaigns/${campaignId}/arcs/${item.id}`
  if (type === 'sessions') return `/campaigns/${campaignId}/arcs/${item.arc_id}/sessions/${item.id}`
  if (type === 'events') return `/campaigns/${campaignId}/chronicle`
  return `/campaigns/${campaignId}/${type}/${item.id}`
}

function isBoundary(char: string | undefined) {
  return !char || /[\s.,;:!?()[\]{}"'`]/.test(char)
}

function OracleMessageContent({ content, citations }: { content: string; citations: CitationTarget[] }) {
  const sortedCitations = useMemo(
    () => [...citations].sort((a, b) => b.label.length - a.label.length),
    [citations]
  )

  const renderInline = (text: string, keyPrefix = 't'): ReactNode[] => {
    const nodes: ReactNode[] = []
    let i = 0

    while (i < text.length) {
      if (text.startsWith('**', i)) {
        const end = text.indexOf('**', i + 2)
        if (end !== -1) {
          nodes.push(
            <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-parchment">
              {renderInline(text.slice(i + 2, end), `${keyPrefix}-b-${i}`)}
            </strong>
          )
          i = end + 2
          continue
        }
      }

      if (text[i] === '@') {
        const match = sortedCitations.find(citation => {
          const token = `@${citation.label}`
          return text.slice(i, i + token.length).toLocaleLowerCase('pt-BR') === token.toLocaleLowerCase('pt-BR') &&
            isBoundary(text[i + token.length])
        })

        if (match) {
          nodes.push(
            <Link
              key={`${keyPrefix}-m-${i}`}
              to={match.path}
              className="text-gold hover:text-gold-light underline decoration-gold/30 underline-offset-2 font-medium transition-colors"
              title={`Abrir ${match.label}`}
            >
              @{match.label}
            </Link>
          )
          i += match.label.length + 1
          continue
        }
      }

      const nextBold = text.indexOf('**', i)
      const nextMention = text.indexOf('@', i + 1)
      const nextStops = [nextBold, nextMention].filter(index => index !== -1)
      const next = nextStops.length ? Math.min(...nextStops) : text.length
      nodes.push(text.slice(i, next))
      i = next
    }

    return nodes
  }

  return (
    <p className="text-sm text-parchment/80 whitespace-pre-wrap leading-relaxed">
      {renderInline(content)}
    </p>
  )
}

export function OraclePage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { data: campaign } = useCampaign(campaignId!)
  const characters = useEntityList(campaignId!, 'characters')
  const npcs = useEntityList(campaignId!, 'npcs')
  const locations = useEntityList(campaignId!, 'locations')
  const items = useEntityList(campaignId!, 'items')
  const spells = useEntityList(campaignId!, 'spells')
  const creatures = useEntityList(campaignId!, 'creatures')
  const notes = useEntityList(campaignId!, 'notes')
  const arcs = useArcs(campaignId!)
  const sessions = useCampaignSessions(campaignId!)
  const events = useEvents(campaignId!)
  const [mode, setMode] = useState<OracleMode>('dm')
  const [message, setMessage] = useState('')
  const [pendingPrompt, setPendingPrompt] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const canUseDm = campaign?.role === 'admin' || campaign?.play_role === 'gm'
  const effectiveMode: OracleMode = canUseDm ? mode : 'player'
  const { data, isLoading } = useOracleHistory(campaignId!, effectiveMode)
  const sendMessage = useSendOracleMessage(campaignId!, effectiveMode)
  const clearHistory = useClearOracleHistory(campaignId!, effectiveMode)
  const messages = data?.messages ?? []
  const citations = useMemo<CitationTarget[]>(() => {
    if (!campaignId) return []
    const entityData: Record<EntityType, any[]> = {
      characters: characters.data ?? [],
      npcs: npcs.data ?? [],
      locations: locations.data ?? [],
      items: items.data ?? [],
      spells: spells.data ?? [],
      creatures: creatures.data ?? [],
      notes: notes.data ?? [],
    }

    const entityCitations = ENTITY_TYPES.flatMap(type =>
      (entityData[type] ?? []).map(item => ({
        label: ENTITY_CONFIG[type].displayName(item),
        path: citationPath(campaignId, type, item),
        type,
      }))
    )

    return [
      ...entityCitations,
      ...(arcs.data ?? []).map(arc => ({ label: arc.title, path: citationPath(campaignId, 'arcs', arc), type: 'arcs' as const })),
      ...(sessions.data ?? []).map(session => ({ label: session.title, path: citationPath(campaignId, 'sessions', session), type: 'sessions' as const })),
      ...(events.data ?? []).map(event => ({ label: event.title, path: citationPath(campaignId, 'events', event), type: 'events' as const })),
    ].filter(citation => citation.label && citation.path)
  }, [
    campaignId,
    arcs.data,
    characters.data,
    creatures.data,
    events.data,
    items.data,
    locations.data,
    notes.data,
    npcs.data,
    sessions.data,
    spells.data,
  ])

  useEffect(() => {
    if (!canUseDm) setMode('player')
  }, [canUseDm])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, sendMessage.isPending])

  const submit = async (event?: FormEvent, suggestion?: string) => {
    event?.preventDefault()
    const text = (suggestion ?? message).trim()
    if (!text || sendMessage.isPending) return
    setPendingPrompt(text)
    setMessage('')
    try {
      await sendMessage.mutateAsync(text)
    } finally {
      setPendingPrompt('')
    }
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
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg text-parchment">Oráculo</h1>
            <p className="text-xs text-parchment/30 truncate">IA com memoria da campanha e conversa contextual.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canUseDm && (
            <div className="flex rounded border border-stone-300 bg-stone-200 p-0.5">
              <button
                type="button"
                onClick={() => setMode('dm')}
                className={clsx(
                  'h-8 px-3 rounded text-xs inline-flex items-center gap-1.5 transition-colors',
                  effectiveMode === 'dm' ? 'bg-gold text-ink' : 'text-parchment/50 hover:text-parchment'
                )}
                title="Modo DM"
              >
                <Shield size={13} /> DM
              </button>
              <button
                type="button"
                onClick={() => setMode('player')}
                className={clsx(
                  'h-8 px-3 rounded text-xs inline-flex items-center gap-1.5 transition-colors',
                  effectiveMode === 'player' ? 'bg-gold text-ink' : 'text-parchment/50 hover:text-parchment'
                )}
                title="Modo Jogador"
              >
                <UserRound size={13} /> Jogador
              </button>
            </div>
          )}
          {canUseDm && messages.length > 0 && (
            <button
              type="button"
              onClick={() => clearHistory.mutate()}
              disabled={clearHistory.isPending || sendMessage.isPending}
              className="h-9 w-9 rounded text-parchment/35 hover:text-crimson hover:bg-stone-200 disabled:opacity-40 transition-colors flex items-center justify-center"
              title="Limpar historico"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="w-full max-w-[1400px] mx-auto flex flex-col gap-3">
          {isLoading && <p className="text-sm text-parchment/30">Consultando memoria...</p>}

          {!isLoading && messages.length === 0 && !sendMessage.isPending && (
            <div className="min-h-[55vh] flex flex-col items-center justify-center text-center gap-5">
              <div className="w-14 h-14 rounded-full bg-gold/15 text-gold flex items-center justify-center">
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="font-display text-2xl text-parchment">Pergunte ao Oráculo</h2>
                <p className="text-sm text-parchment/35 mt-1 max-w-xl">
                  Ele usa Eventos, NPCs, locais, arcos, sessoes, notas e itens da campanha para responder em contexto.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
                {SUGGESTIONS.map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={event => submit(event, suggestion)}
                    className="rounded-full border border-stone-300 bg-stone-100 px-3 py-1.5 text-xs text-parchment/60 hover:text-gold hover:border-gold/40 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(item => (
            <article key={item.id} className={clsx('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={clsx(
                'max-w-[82%] rounded-lg px-4 py-3 shadow-sm border',
                item.role === 'user'
                  ? 'bg-gold/15 border-gold/20'
                  : 'bg-stone-100 border-stone-300'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gold/75">{item.role === 'user' ? item.username ?? 'Você' : 'Oráculo'}</span>
                  <span className="text-[11px] text-parchment/25">
                    {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <OracleMessageContent content={item.content} citations={citations} />
              </div>
            </article>
          ))}

          {sendMessage.isPending && (
            <>
              {pendingPrompt && (
                <article className="flex justify-end">
                  <div className="max-w-[82%] rounded-lg px-4 py-3 shadow-sm border bg-gold/15 border-gold/20">
                    <OracleMessageContent content={pendingPrompt} citations={citations} />
                  </div>
                </article>
              )}
              <article className="flex justify-start">
                <div className="rounded-lg px-4 py-3 shadow-sm border bg-stone-100 border-stone-300 flex items-center gap-2 text-parchment/45">
                  <Sparkles size={14} />
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:120ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:240ms]" />
                  </span>
                </div>
              </article>
            </>
          )}

          {sendMessage.isError && (
            <p className="text-sm text-crimson-light">{sendMessage.error.message}</p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-stone-300 bg-stone-100 px-5 py-3">
        <div className="w-full max-w-[1400px] mx-auto grid grid-cols-[1fr_auto] gap-2 items-end">
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            onKeyDown={onTextKeyDown}
            rows={1}
            placeholder={effectiveMode === 'dm' ? 'Pergunte sobre segredos, arcos ou proximos ganchos...' : 'Pergunte sobre o que os jogadores sabem...'}
            className="min-h-11 max-h-32 bg-stone-200 border border-stone-300 rounded-2xl px-4 py-3 text-sm text-parchment placeholder-parchment/35 focus:outline-none focus:border-gold/50 resize-none"
          />
          <button
            type="submit"
            disabled={sendMessage.isPending || !message.trim()}
            className="h-11 w-11 rounded-full bg-gold text-ink hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            title="Enviar"
          >
            <Send size={17} />
          </button>
        </div>
      </form>
    </div>
  )
}
