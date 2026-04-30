import { useState } from 'react'
import { Sparkles, X, Sword, Plus } from 'lucide-react'
import { useSuggestEncounter } from '@/hooks/useAI'
import { useCreateEncounter }  from '@/hooks/useSessions'
import { Button } from '@/components/ui/Button'
import { clsx } from 'clsx'

interface Props {
  campaignId: string
  arcId: string
  sessionId: string
  onClose: () => void
}

const DIFF_COLOR: Record<string, string> = {
  'Fácil':  'text-emerald-400',
  'Médio':  'text-gold',
  'Difícil':'text-orange-400',
  'Mortal': 'text-crimson-light',
}

export function EncounterSuggester({ campaignId, arcId, sessionId, onClose }: Props) {
  const [form, setForm] = useState({ difficulty: 'Médio', location: '', theme: '' })
  const [result, setResult] = useState<any>(null)

  const suggest = useSuggestEncounter(campaignId)
  const create  = useCreateEncounter(campaignId, arcId, sessionId)

  const generate = async () => {
    const enc = await suggest.mutateAsync(form)
    setResult(enc)
  }

  const save = async () => {
    if (!result) return
    await create.mutateAsync({
      title:       result.title,
      description: [
        result.description,
        result.terrain  ? `**Terreno:** ${result.terrain}`  : '',
        result.twist    ? `**Reviravolta:** ${result.twist}` : '',
        result.loot     ? `**Loot:** ${result.loot}`         : '',
      ].filter(Boolean).join('\n\n'),
      difficulty: result.difficulty,
    })
    onClose()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-stone-100 border border-stone-300 rounded-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-300">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            <h2 className="font-display text-lg text-parchment">Sugerir Encontro</h2>
          </div>
          <button onClick={onClose} className="text-parchment/30 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {/* Configurações */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-parchment/70 font-medium">Dificuldade</label>
              <select value={form.difficulty} onChange={set('difficulty')}
                className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60">
                {['Fácil','Médio','Difícil','Mortal'].map(d =>
                  <option key={d} value={d}>{d}</option>
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-parchment/70 font-medium">Local (opcional)</label>
              <input value={form.location} onChange={set('location')}
                placeholder='Ex: "floresta densa à noite"'
                className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/60" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-parchment/70 font-medium">Tema (opcional)</label>
              <input value={form.theme} onChange={set('theme')}
                placeholder='Ex: "emboscada de cultistas"'
                className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/60" />
            </div>
          </div>

          <Button onClick={generate} loading={suggest.isPending} className="w-full">
            <Sparkles size={14} />
            {suggest.isPending ? 'Gerando...' : 'Gerar encontro'}
          </Button>

          {/* Resultado */}
          {result && (
            <div className="bg-stone-200 border border-gold/20 rounded-xl p-4 flex flex-col gap-3">
              <div>
                <p className="font-display text-lg text-parchment">{result.title}</p>
                <p className={clsx('text-xs font-medium', DIFF_COLOR[result.difficulty])}>
                  {result.difficulty}
                </p>
              </div>

              {result.description && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Situação</p>
                  <p className="text-sm text-parchment/70 leading-relaxed">{result.description}</p>
                </div>
              )}

              {result.monsters?.length > 0 && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Criaturas</p>
                  <div className="flex flex-col gap-1">
                    {result.monsters.map((m: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Sword size={11} className="text-rose-400 shrink-0" />
                        <span className="text-parchment">
                          {m.quantity}× {m.name}
                        </span>
                        {m.role && <span className="text-parchment/40">— {m.role}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.terrain && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Terreno</p>
                  <p className="text-sm text-parchment/70">{result.terrain}</p>
                </div>
              )}

              {result.twist && (
                <div className="bg-gold/10 border border-gold/20 rounded p-3">
                  <p className="text-xs text-gold/60 uppercase tracking-widest mb-1">⚡ Reviravolta</p>
                  <p className="text-sm text-parchment/70">{result.twist}</p>
                </div>
              )}

              {result.loot && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Recompensa</p>
                  <p className="text-sm text-parchment/70">{result.loot}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={save} loading={create.isPending} className="flex-1">
                  <Plus size={13} /> Salvar na sessão
                </Button>
                <Button size="sm" variant="ghost" onClick={generate} loading={suggest.isPending}>
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