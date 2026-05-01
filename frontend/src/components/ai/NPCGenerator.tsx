import { useState } from 'react'
import { Sparkles, X, UserPlus } from 'lucide-react'
import { useGenerateNPC } from '@/hooks/useAI'
import { useCreateEntity } from '@/hooks/useEntities'
import { Button } from '@/components/ui/Button'

interface Props {
  campaignId: string
  onClose: () => void
  onCreated?: (npc: any) => void
}

const AUTO = 'Automático'
const CUSTOM = 'Personalizado'

const PRESETS = {
  race: ['Automático', 'Humano', 'Elfo', 'Anão', 'Halfling', 'Tiefling', 'Draconato', 'Meio-orc', 'Gnomo', 'Personalizado'],
  role: ['Automático', 'Aliado', 'Vilão', 'Mercador', 'Nobre', 'Guarda', 'Curandeiro', 'Informante', 'Mentor', 'Personalizado'],
  age: ['Automático', 'Criança', 'Jovem adulto', 'Adulto', 'Meia-idade', 'Idoso', 'Ancestral', 'Personalizado'],
  tone: ['Automático', 'Amigável', 'Misterioso', 'Ameaçador', 'Cômico', 'Trágico', 'Excêntrico', 'Solenemente educado', 'Personalizado'],
} as const

type PresetKey = keyof typeof PRESETS

function getPresetValue(value: string, custom: string) {
  if (value === AUTO) return ''
  if (value === CUSTOM) return custom.trim()
  return value
}

export function NPCGenerator({ campaignId, onClose, onCreated }: Props) {
  const [hint, setHint]         = useState('')
  const [result, setResult]     = useState<any>(null)
  const [error, setError]       = useState('')
  const [visibility, setVisibility] = useState('public')
  const [presets, setPresets] = useState<Record<PresetKey, string>>({
    race: AUTO,
    role: AUTO,
    age: AUTO,
    tone: AUTO,
  })
  const [customPresets, setCustomPresets] = useState<Record<PresetKey, string>>({
    race: '',
    role: '',
    age: '',
    tone: '',
  })
  const generateNPC  = useGenerateNPC(campaignId)
  const createEntity = useCreateEntity(campaignId, 'npcs')

  const setPreset = (key: PresetKey, value: string) =>
    setPresets(current => ({ ...current, [key]: value }))

  const setCustomPreset = (key: PresetKey, value: string) =>
    setCustomPresets(current => ({ ...current, [key]: value }))

  const buildPrompt = () => {
    const selected = [
      ['Raça', getPresetValue(presets.race, customPresets.race)],
      ['Função', getPresetValue(presets.role, customPresets.role)],
      ['Idade', getPresetValue(presets.age, customPresets.age)],
      ['Tom', getPresetValue(presets.tone, customPresets.tone)],
    ].filter(([, value]) => value)

    const presetText = selected.map(([label, value]) => `${label}: ${value}`).join('; ')
    return [hint.trim(), presetText ? `Presets escolhidos: ${presetText}.` : ''].filter(Boolean).join('\n')
  }

  const generate = async () => {
    setError('')
    try {
      const npc = await generateNPC.mutateAsync(buildPrompt())
      setResult(npc)
    } catch (err: any) {
      setError(err.message ?? 'Falha ao gerar NPC.')
    }
  }

  const save = async () => {
    if (!result) return
    const saved = await createEntity.mutateAsync({
      name: result.name, race: result.race, role: result.role,
      description: result.description, personality: result.personality,
      secrets: result.secrets,
      data: result.hook ? { hook: result.hook } : {},
      visibility,
    })
    onCreated?.(saved)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] bg-stone-100 border border-stone-300 rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-300 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            <h2 className="font-display text-lg text-parchment">Gerar NPC com IA</h2>
          </div>
          <button onClick={onClose} className="text-parchment/30 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 min-h-0 flex-1">
          {/* Input de direção */}
          <div>
            <label className="text-sm text-parchment/70 font-medium block mb-1">
              Direção (opcional)
            </label>
            <input
              value={hint}
              onChange={e => setHint(e.target.value)}
              placeholder='Ex: "uma estalajadeira anã, viúva e sabe de muitos segredos"'
              className="w-full bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/60"
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
          </div>

          <p className="text-xs italic text-parchment/35 -mt-1">
            Você pode orientar a geração pela caixa acima, pelos presets abaixo, ou combinando os dois.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['race', 'Raça'],
              ['role', 'Função'],
              ['age', 'Idade'],
              ['tone', 'Tom'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-parchment/50 font-medium">{label}</label>
                <select
                  value={presets[key]}
                  onChange={e => setPreset(key, e.target.value)}
                  className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-xs text-parchment focus:outline-none focus:border-gold/60"
                >
                  {PRESETS[key].map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {presets[key] === CUSTOM && (
                  <input
                    value={customPresets[key]}
                    onChange={e => setCustomPreset(key, e.target.value)}
                    placeholder={`${label} personalizada`}
                    className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-xs text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/60"
                  />
                )}
              </div>
            ))}
          </div>

          <Button onClick={generate} loading={generateNPC.isPending} className="w-full">
            <Sparkles size={14} />
            {generateNPC.isPending ? 'Gerando...' : 'Gerar NPC'}
          </Button>

          {error && (
            <p className="text-xs text-crimson-light bg-crimson/10 border border-crimson/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Resultado */}
          {result && (
            <div className="bg-stone-200 border border-gold/20 rounded-xl p-4 flex flex-col gap-3 overflow-y-auto min-h-0">
              <div>
                <p className="font-display text-lg text-parchment">{result.name}</p>
                <p className="text-xs text-parchment/50">
                  {[result.race, result.role].filter(Boolean).join(' · ')}
                </p>
              </div>
              {result.description && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Aparência</p>
                  <p className="text-sm text-parchment/70">{result.description}</p>
                </div>
              )}
              {result.personality && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Personalidade</p>
                  <p className="text-sm text-parchment/70">{result.personality}</p>
                </div>
              )}
              {result.secrets && (
                <div className="bg-crimson/10 border border-crimson/20 rounded p-3">
                  <p className="text-xs text-crimson/60 uppercase tracking-widest mb-1">🔒 Segredo</p>
                  <p className="text-sm text-parchment/70">{result.secrets}</p>
                </div>
              )}
              {result.hook && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Como encontrar</p>
                  <p className="text-sm text-parchment/70">{result.hook}</p>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="flex gap-2 shrink-0">
              <select
                value={visibility}
                onChange={e => setVisibility(e.target.value)}
                className="bg-stone-200 border border-stone-300 rounded px-2 py-1.5 text-xs text-parchment focus:outline-none focus:border-gold/60"
              >
                <option value="public">Público</option>
                <option value="private">Privado</option>
              </select>
              <Button size="sm" onClick={save} loading={createEntity.isPending} className="flex-1">
                <UserPlus size={13} /> Salvar na campanha
              </Button>
              <Button size="sm" variant="ghost" onClick={generate} loading={generateNPC.isPending}>
                Regerar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
