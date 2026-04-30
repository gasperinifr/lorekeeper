import { useState } from 'react'
import { Sparkles, X, Check } from 'lucide-react'
import { useExpandNote } from '@/hooks/useAI'
import { useUpdateEntity } from '@/hooks/useEntities'
import { Button } from '@/components/ui/Button'

interface Props {
  campaignId: string
  noteId: string
  title: string
  content: string
  onClose: () => void
}

export function NoteExpander({ campaignId, noteId, title, content, onClose }: Props) {
  const [result, setResult] = useState('')
  const expand = useExpandNote(campaignId)
  const update = useUpdateEntity(campaignId, 'notes', noteId)

  const generate = async () => {
    const { expanded } = await expand.mutateAsync({ title, content })
    setResult(expanded)
  }

  const save = async () => {
    await update.mutateAsync({ content: result })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-stone-100 border border-stone-300 rounded-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-300">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            <h2 className="font-display text-lg text-parchment">Expandir Nota</h2>
          </div>
          <button onClick={onClose} className="text-parchment/30 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div className="bg-stone-200 border border-stone-300 rounded-xl p-4">
            <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Nota original</p>
            <p className="text-sm font-medium text-parchment">{title}</p>
            <p className="text-sm text-parchment/50 mt-1 whitespace-pre-wrap line-clamp-4">{content}</p>
          </div>

          <Button onClick={generate} loading={expand.isPending} className="w-full">
            <Sparkles size={14} />
            {expand.isPending ? 'Expandindo...' : 'Expandir com IA'}
          </Button>

          {result && (
            <div className="flex flex-col gap-3">
              <div className="bg-stone-200 border border-stone-300 rounded-xl p-4">
                <p className="text-xs text-parchment/30 uppercase tracking-widest mb-3">Versão expandida</p>
                <textarea
                  value={result}
                  onChange={e => setResult(e.target.value)}
                  rows={12}
                  className="w-full bg-transparent text-sm text-parchment/80 leading-relaxed resize-none focus:outline-none"
                />
              </div>
              <p className="text-xs text-parchment/30 italic">
                Edite o texto acima antes de salvar. Isso substituirá o conteúdo atual da nota.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={save} loading={update.isPending} className="flex-1">
                  <Check size={13} /> Salvar nota expandida
                </Button>
                <Button size="sm" variant="ghost" onClick={generate} loading={expand.isPending}>
                  Regerar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}