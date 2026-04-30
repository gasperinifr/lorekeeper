import { useState } from 'react'
import { Sparkles, X, Check } from 'lucide-react'
import { useSummarizeSession } from '@/hooks/useAI'
import { useUpdateSession }    from '@/hooks/useSessions'
import { Button } from '@/components/ui/Button'

interface Props {
  campaignId: string
  arcId: string
  sessionId: string
  onClose: () => void
}

export function SessionSummarizer({ campaignId, arcId, sessionId, onClose }: Props) {
  const [result, setResult] = useState('')
  const summarize   = useSummarizeSession(campaignId)
  const updateSession = useUpdateSession(campaignId, arcId, sessionId)

  const generate = async () => {
    const { summary } = await summarize.mutateAsync(sessionId)
    setResult(summary)
  }

  const save = async () => {
    await updateSession.mutateAsync({ summary: result })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-stone-100 border border-stone-300 rounded-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-300">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            <h2 className="font-display text-lg text-parchment">Resumir Sessão com IA</h2>
          </div>
          <button onClick={onClose} className="text-parchment/30 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <p className="text-sm text-parchment/50 leading-relaxed">
            A IA vai gerar um resumo narrativo desta sessão com base nas notas do mestre e nos encontros registrados.
          </p>

          <Button onClick={generate} loading={summarize.isPending} className="w-full">
            <Sparkles size={14} />
            {summarize.isPending ? 'Gerando resumo...' : 'Gerar resumo'}
          </Button>

          {result && (
            <div className="flex flex-col gap-3">
              <div className="bg-stone-200 border border-stone-300 rounded-xl p-4">
                <p className="text-xs text-parchment/30 uppercase tracking-widest mb-3">Resumo gerado</p>
                <textarea
                  value={result}
                  onChange={e => setResult(e.target.value)}
                  rows={10}
                  className="w-full bg-transparent text-sm text-parchment/80 leading-relaxed resize-none focus:outline-none"
                />
              </div>
              <p className="text-xs text-parchment/30 italic">
                Você pode editar o texto acima antes de salvar.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={save} loading={updateSession.isPending} className="flex-1">
                  <Check size={13} /> Salvar como resumo da sessão
                </Button>
                <Button size="sm" variant="ghost" onClick={generate} loading={summarize.isPending}>
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