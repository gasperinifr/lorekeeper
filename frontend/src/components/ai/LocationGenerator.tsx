import { useState } from 'react'
import { Map, Sparkles, X, Plus } from 'lucide-react'
import { useGenerateLocation } from '@/hooks/useAI'
import { useCreateEntity, useEntityList } from '@/hooks/useEntities'
import { Button } from '@/components/ui/Button'

interface Props {
  campaignId: string
  onClose: () => void
  onCreated?: (location: any) => void
}

const AUTO = 'Automático'
const CUSTOM = 'Personalizado'

const PRESETS = {
  type: ['Automático', 'Cidade', 'Vila', 'Taverna', 'Castelo', 'Dungeon', 'Floresta', 'Ruína', 'Planície', 'Porto', 'Outro', 'Personalizado'],
  scale: ['Automático', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Isolado', 'Labiríntico', 'Personalizado'],
  mood: ['Automático', 'Acolhedor', 'Sombrio', 'Sagrado', 'Decadente', 'Misterioso', 'Hostil', 'Maravilhoso', 'Personalizado'],
  importance: ['Automático', 'Cenário de passagem', 'Base segura', 'Ponto de conflito', 'Segredo antigo', 'Centro político', 'Ameaça iminente', 'Personalizado'],
} as const

const EXTENDED_PRESETS = {
  type: [...PRESETS.type, 'Bairro', 'Templo', 'Biblioteca', 'Mercado', 'Acampamento', 'Fortaleza', 'Laboratorio', 'Cemiterio', 'Ilha', 'Monasterio', 'Esgoto', 'Arena', 'Sede de guilda'],
  scale: [...PRESETS.scale, 'Subterraneo', 'Vertical', 'Disperso', 'Megalitico', 'Em ruinas', 'Movel', 'Planar'],
  mood: [...PRESETS.mood, 'Opulento', 'Assombrado', 'Sufocante', 'Cerimonial', 'Caotico', 'Melancolico', 'Vivo demais', 'Esquecido'],
  importance: [...PRESETS.importance, 'Lar de faccao', 'Fonte de rumores', 'Prisao', 'Portal', 'Campo de batalha antigo', 'Santuario proibido', 'Recurso estrategico'],
  history: ['Automatico', 'Recem-fundado', 'Conquistado', 'Reconstruido sobre ruinas', 'Amaldicoado', 'Antiga capital', 'Sede de culto extinto', 'Local de massacre', 'Ponto de peregrinacao', 'Criado por magia', 'Abandonado e reocupado', 'Personalizado'],
  inhabitants: ['Automatico', 'Mercadores', 'Refugiados', 'Nobreza decadente', 'Cultistas', 'Mineiros', 'Piratas', 'Monges', 'Academicos', 'Soldados', 'Criaturas inteligentes', 'Comunidade isolada', 'Personalizado'],
  conflict: ['Automatico', 'Guerra fria entre faccoes', 'Praga', 'Escassez', 'Assombracao', 'Corrupcao politica', 'Monstro nos arredores', 'Segredo soterrado', 'Portal instavel', 'Revolta popular', 'Personalizado'],
} as const

type PresetKey = keyof typeof EXTENDED_PRESETS

function getPresetValue(value: string, custom: string) {
  if (value === AUTO || value === 'Automatico') return ''
  if (value === CUSTOM) return custom.trim()
  return value
}

export function LocationGenerator({ campaignId, onClose, onCreated }: Props) {
  const [hint, setHint] = useState('')
  const [parentId, setParentId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [presets, setPresets] = useState<Record<PresetKey, string>>({
    type: AUTO,
    scale: AUTO,
    mood: AUTO,
    importance: AUTO,
    history: 'Automatico',
    inhabitants: 'Automatico',
    conflict: 'Automatico',
  })
  const [customPresets, setCustomPresets] = useState<Record<PresetKey, string>>({
    type: '',
    scale: '',
    mood: '',
    importance: '',
    history: '',
    inhabitants: '',
    conflict: '',
  })

  const generateLocation = useGenerateLocation(campaignId)
  const createEntity = useCreateEntity(campaignId, 'locations')
  const { data: locations = [] } = useEntityList(campaignId, 'locations')

  const setPreset = (key: PresetKey, value: string) =>
    setPresets(current => ({ ...current, [key]: value }))

  const setCustomPreset = (key: PresetKey, value: string) =>
    setCustomPresets(current => ({ ...current, [key]: value }))

  const buildPrompt = () => {
    const parent = locations.find((location: any) => location.id === parentId)
    const selected = [
      ['Tipo', getPresetValue(presets.type, customPresets.type)],
      ['Escala', getPresetValue(presets.scale, customPresets.scale)],
      ['Atmosfera', getPresetValue(presets.mood, customPresets.mood)],
      ['Importância narrativa', getPresetValue(presets.importance, customPresets.importance)],
      ['Historia', getPresetValue(presets.history, customPresets.history)],
      ['Habitantes/faccoes', getPresetValue(presets.inhabitants, customPresets.inhabitants)],
      ['Conflito atual', getPresetValue(presets.conflict, customPresets.conflict)],
    ].filter(([, value]) => value)

    const presetText = selected.map(([label, value]) => `${label}: ${value}`).join('; ')
    const parentText = parent
      ? `Sub-local de: ${parent.name}. Tipo do local pai/mae: ${parent.type ?? 'nao definido'}. Descricao do local pai/mae: ${parent.description ?? 'sem descricao'}.`
      : ''
    return [hint.trim(), parentText, presetText ? `Presets escolhidos: ${presetText}.` : ''].filter(Boolean).join('\n')
  }

  const generate = async () => {
    setError('')
    try {
      const location = await generateLocation.mutateAsync({ hint: buildPrompt(), parent_id: parentId || undefined })
      setResult(location)
    } catch (err: any) {
      setError(err.message ?? 'Falha ao gerar local.')
    }
  }

  const save = async () => {
    if (!result) return
    const description = [
      result.description,
      result.hook ? `\nGancho: ${result.hook}` : '',
      result.secret ? `\nSegredo: ${result.secret}` : '',
    ].filter(Boolean).join('\n')

    const saved = await createEntity.mutateAsync({
      name: result.name,
      type: result.type,
      description,
      data: {
        ...(result.data ?? {}),
        ...(result.hook ? { plot_hook: result.hook } : {}),
        ...(result.secret ? { dm_notes: result.secret } : {}),
      },
      parent_id: parentId || null,
      visibility,
    })
    onCreated?.(saved)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[85vh] bg-stone-100 border border-stone-300 rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-300 shrink-0">
          <div className="flex items-center gap-2">
            <Map size={16} className="text-emerald-400" />
            <h2 className="font-display text-lg text-parchment">Gerar local com IA</h2>
          </div>
          <button onClick={onClose} className="text-parchment/30 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 min-h-0 flex-1">
          <div>
            <label className="text-sm text-parchment/70 font-medium block mb-1">
              Direção (opcional)
            </label>
            <input
              value={hint}
              onChange={e => setHint(e.target.value)}
              placeholder='Ex: "um porto amaldiçoado onde ninguém envelhece"'
              className="w-full bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/60"
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
          </div>

          <p className="text-xs italic text-parchment/35 -mt-1">
            Você pode orientar a geração pela caixa acima, pelos presets abaixo, ou combinando os dois.
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">Local pai/mae (opcional)</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
            >
              <option value="">Nenhum, criar como local principal</option>
              {locations.map((location: any) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            <p className="text-xs text-parchment/35">A IA usa esse lugar como contexto e salva o novo local dentro dele.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['type', 'Tipo'],
              ['scale', 'Escala'],
              ['mood', 'Atmosfera'],
              ['importance', 'Importância'],
              ['history', 'Historia'],
              ['inhabitants', 'Habitantes'],
              ['conflict', 'Conflito'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-parchment/50 font-medium">{label}</label>
                <select
                  value={presets[key]}
                  onChange={e => setPreset(key, e.target.value)}
                  className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-xs text-parchment focus:outline-none focus:border-gold/60"
                >
                  {EXTENDED_PRESETS[key].map(option => (
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

          <Button onClick={generate} loading={generateLocation.isPending} className="w-full">
            <Sparkles size={14} />
            {generateLocation.isPending ? 'Gerando...' : 'Gerar local'}
          </Button>

          {error && (
            <p className="text-xs text-crimson-light bg-crimson/10 border border-crimson/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          {result && (
            <div className="bg-stone-200 border border-emerald-400/20 rounded-xl p-4 flex flex-col gap-3 overflow-y-auto min-h-0">
              <div>
                <p className="font-display text-lg text-parchment">{result.name}</p>
                {result.type && <p className="text-xs text-parchment/50">{result.type}</p>}
              </div>
              {result.description && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Descrição</p>
                  <p className="text-sm text-parchment/70 whitespace-pre-wrap">{result.description}</p>
                </div>
              )}
              {result.hook && (
                <div>
                  <p className="text-xs text-parchment/30 uppercase tracking-widest mb-1">Gancho</p>
                  <p className="text-sm text-parchment/70">{result.hook}</p>
                </div>
              )}
              {result.secret && (
                <div className="bg-crimson/10 border border-crimson/20 rounded p-3">
                  <p className="text-xs text-crimson/60 uppercase tracking-widest mb-1">Segredo</p>
                  <p className="text-sm text-parchment/70">{result.secret}</p>
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
                <Plus size={13} /> Salvar na campanha
              </Button>
              <Button size="sm" variant="ghost" onClick={generate} loading={generateLocation.isPending}>
                Regerar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
