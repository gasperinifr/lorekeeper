import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AtSign,
  Bold,
  Download,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  List as ListIcon,
  ListOrdered,
  Minus,
  Table,
} from 'lucide-react'
import { clsx } from 'clsx'
import { ENTITY_CONFIG, ENTITY_TYPES } from '@/config/entityConfig'
import { useEntityList } from '@/hooks/useEntities'
import type { EntityType } from '@/types'

interface Props {
  campaignId: string
  value?: string
  onChange: (value: string) => void
}

type MentionOption = {
  id: string
  type: EntityType
  label: string
  path: string
  icon: React.ElementType
  accentClass: string
}

const toolbarButton = 'h-8 w-8 rounded flex items-center justify-center text-parchment/55 hover:text-gold hover:bg-stone-300 transition-colors disabled:opacity-40'

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function toEditableHtml(value?: string) {
  if (!value) return ''
  if (looksLikeHtml(value)) return value
  return value
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function getSelectionRange(editor: HTMLDivElement | null) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !editor?.contains(selection.anchorNode)) return null
  return selection.getRangeAt(0)
}

function getTextBeforeCursor(editor: HTMLDivElement | null) {
  const range = getSelectionRange(editor)
  if (!range || !editor) return ''
  const preRange = range.cloneRange()
  preRange.selectNodeContents(editor)
  preRange.setEnd(range.endContainer, range.endOffset)
  return preRange.toString()
}

export function RichTextEditor({ campaignId, value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const savedRange = useRef<Range | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const characters = useEntityList(campaignId, 'characters')
  const npcs = useEntityList(campaignId, 'npcs')
  const locations = useEntityList(campaignId, 'locations')
  const items = useEntityList(campaignId, 'items')
  const spells = useEntityList(campaignId, 'spells')
  const creatures = useEntityList(campaignId, 'creatures')
  const notes = useEntityList(campaignId, 'notes')

  const mentions = useMemo(() => ENTITY_TYPES.flatMap(type => {
    const lists: Partial<Record<EntityType, any[]>> = {
      characters: characters.data ?? [],
      npcs: npcs.data ?? [],
      locations: locations.data ?? [],
      items: items.data ?? [],
      spells: spells.data ?? [],
      creatures: creatures.data ?? [],
      notes: notes.data ?? [],
    }
    const cfg = ENTITY_CONFIG[type]
    return (lists[type] ?? []).map((entity: any): MentionOption => ({
      id: entity.id,
      type,
      label: cfg.displayName(entity),
      path: `/campaigns/${campaignId}/${type}/${entity.id}`,
      icon: cfg.icon,
      accentClass: cfg.accentClass,
    }))
  }), [
    campaignId,
    characters.data,
    npcs.data,
    locations.data,
    items.data,
    spells.data,
    creatures.data,
    notes.data,
  ])

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return []
    const query = mentionQuery.toLowerCase()
    return mentions
      .filter(mention => mention.label.toLowerCase().includes(query))
      .slice(0, 8)
  }, [mentionQuery, mentions])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || document.activeElement === editor) return
    const next = toEditableHtml(value)
    if (editor.innerHTML !== next) editor.innerHTML = next
  }, [value])

  const sync = () => {
    const html = editorRef.current?.innerHTML ?? ''
    onChange(html)
    const before = getTextBeforeCursor(editorRef.current)
    const match = before.match(/@([A-Za-z0-9 _.-]{0,40})$/)
    if (match) {
      savedRange.current = getSelectionRange(editorRef.current)
      setMentionQuery(match[1])
    } else {
      setMentionQuery(null)
    }
  }

  const focusEditor = () => {
    editorRef.current?.focus()
    const selection = window.getSelection()
    if (selection && savedRange.current) {
      selection.removeAllRanges()
      selection.addRange(savedRange.current)
    }
  }

  const command = (name: string, argument?: string) => {
    focusEditor()
    document.execCommand(name, false, argument)
    sync()
  }

  const insertHtml = (html: string) => {
    focusEditor()
    document.execCommand('insertHTML', false, html)
    setMentionQuery(null)
    sync()
  }

  const insertTable = () => {
    insertHtml(
      '<table><tbody>' +
      Array.from({ length: 3 }).map(() =>
        '<tr>' + Array.from({ length: 3 }).map(() => '<td><br></td>').join('') + '</tr>'
      ).join('') +
      '</tbody></table><p><br></p>'
    )
  }

  const insertMention = (mention: MentionOption) => {
    focusEditor()
    const selection = window.getSelection()
    const range = getSelectionRange(editorRef.current)
    if (!selection || !range) return

    const before = getTextBeforeCursor(editorRef.current)
    const match = before.match(/@([A-Za-z0-9 _.-]{0,40})$/)
    if (match) {
      range.setStart(range.endContainer, Math.max(0, range.endOffset - match[0].length))
    }

    range.deleteContents()
    const fragment = range.createContextualFragment(
      `<a href="${mention.path}" data-mention-type="${mention.type}" data-mention-id="${mention.id}">@${escapeHtml(mention.label)}</a>&nbsp;`
    )
    range.insertNode(fragment)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    setMentionQuery(null)
    sync()
  }

  const uploadInlineImage = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/uploads/image?context=notes-inline', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('lk_token')}` },
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Erro ${res.status} ao enviar imagem.` }))
        throw new Error(body.error ?? `Erro ${res.status} ao enviar imagem.`)
      }
      const { url } = await res.json()
      insertHtml(`<p><img src="${url}" alt="" /></p>`)
    } catch (err: any) {
      setError(err.message ?? 'Nao foi possivel enviar a imagem.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const exportHtml = () => {
    const html = editorRef.current?.innerHTML ?? ''
    const blob = new Blob([
      `<!doctype html><html><head><meta charset="utf-8"><title>Nota Lorekeeper</title></head><body>${html}</body></html>`,
    ], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'nota-lorekeeper.html'
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const html = editorRef.current?.innerHTML ?? ''
    const popup = window.open('', '_blank')
    if (!popup) return
    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Nota Lorekeeper</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #221f18; line-height: 1.55; padding: 32px; }
            img { max-width: 100%; border-radius: 8px; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #bbb; padding: 8px; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-100 overflow-visible">
      <div className="flex flex-wrap items-center gap-1 border-b border-stone-300 bg-stone-200 px-2 py-2">
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={() => command('bold')} title="Negrito">
          <Bold size={15} />
        </button>
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={() => command('italic')} title="Italico">
          <Italic size={15} />
        </button>
        <span className="mx-1 h-5 w-px bg-stone-300" />
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={() => command('formatBlock', 'H2')} title="Titulo H2">
          <Heading2 size={16} />
        </button>
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={() => command('formatBlock', 'H3')} title="Titulo H3">
          <Heading3 size={16} />
        </button>
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={() => command('insertUnorderedList')} title="Lista">
          <ListIcon size={15} />
        </button>
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={() => command('insertOrderedList')} title="Lista numerada">
          <ListOrdered size={15} />
        </button>
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={insertTable} title="Tabela">
          <Table size={15} />
        </button>
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={() => command('insertHorizontalRule')} title="Separador">
          <Minus size={15} />
        </button>
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={() => fileRef.current?.click()} disabled={uploading} title="Imagem inline">
          <ImageIcon size={15} />
        </button>
        <span className="mx-1 h-5 w-px bg-stone-300" />
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={exportHtml} title="Exportar HTML">
          <Download size={15} />
        </button>
        <button type="button" className={toolbarButton} onMouseDown={e => e.preventDefault()} onClick={exportPdf} title="Exportar PDF">
          <Download size={15} className="-rotate-90" />
        </button>
        <span className="ml-auto inline-flex items-center gap-1 px-2 text-xs text-parchment/35">
          <AtSign size={12} /> para menções
        </span>
      </div>

      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={sync}
          onKeyUp={sync}
          onMouseUp={() => { savedRange.current = getSelectionRange(editorRef.current) }}
          onBlur={() => { savedRange.current = getSelectionRange(editorRef.current) }}
          className="lk-rich-editor min-h-[22rem] px-4 py-3 text-sm text-parchment/80 focus:outline-none"
        />

        {mentionQuery !== null && filteredMentions.length > 0 && (
          <div className="absolute left-4 top-3 z-20 w-72 max-w-[calc(100%-2rem)] rounded-lg border border-stone-300 bg-stone-100 shadow-xl overflow-hidden">
            {filteredMentions.map(mention => {
              const Icon = mention.icon
              return (
                <button
                  key={`${mention.type}-${mention.id}`}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => insertMention(mention)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-stone-200 transition-colors"
                >
                  <Icon size={14} className={clsx('shrink-0', mention.accentClass)} />
                  <span className="min-w-0 flex-1 truncate text-xs text-parchment">{mention.label}</span>
                  <span className="text-[10px] text-parchment/30">{ENTITY_CONFIG[mention.type].label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {error && <p className="px-4 pb-3 text-xs text-crimson-light">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) uploadInlineImage(file)
        }}
      />
    </div>
  )
}
