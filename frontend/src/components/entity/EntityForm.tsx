import { useMemo, useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Calendar, GitBranch, Link2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { ENTITY_CONFIG } from '@/config/entityConfig'
import { EntitySection } from '@/components/entity/EntitySection'
import { useCreateEntity, useEntityList, useUpdateEntity } from '@/hooks/useEntities'
import { useArcs, useCampaignSessions } from '@/hooks/useArcs'
import { useCreateLink } from '@/hooks/useLinks'
import { useCampaign } from '@/hooks/useCampaign'
import { useEntityDraft } from '@/hooks/useEntityDraft'
import { useSuggestLinks } from '@/hooks/useSuggestLinks'
import { Input } from '@/components/ui/Input'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { Button } from '@/components/ui/Button'
import { RichTextEditor } from '@/components/entity/RichTextEditor'
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt'
import type { EntityType, LinkableType } from '@/types'
import { clsx } from 'clsx'

interface Props {
  campaignId: string
  type: EntityType
  initial?: Record<string, any>  // preenchido em modo edição
  entityId?: string
}

const inputClass = 'bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-colors'
const visibilityLabels: Record<string, string> = {
  public: 'Todos os membros',
  private: 'Apenas editores/admins',
  gm: 'Mestre e admins',
  user: 'Usuário único',
}

const serializeForm = (value: unknown) => JSON.stringify(value ?? null)
const DRAFT_TYPES: EntityType[] = ['npcs', 'locations', 'creatures', 'items', 'spells']

function flattenEntityData(entity?: Record<string, any>) {
  if (!entity) return undefined
  return {
    ...entity,
    ...(entity.data && typeof entity.data === 'object'
      ? Object.fromEntries(Object.entries(entity.data).map(([key, value]) => [`data.${key}`, value]))
      : {}),
  }
}

function fieldDefault(type: string) {
  if (type === 'toggle') return true
  if (type === 'tags-input') return []
  return ''
}

function SmallField({ label, value, onChange, type = 'text' }: {
  label: string
  value: any
  onChange: (value: any) => void
  type?: 'text' | 'number'
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-parchment/40 uppercase tracking-widest">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
        className={inputClass}
      />
    </label>
  )
}

function SmallTextarea({ label, value, onChange, rows = 3 }: {
  label: string
  value: any
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-parchment/40 uppercase tracking-widest">{label}</span>
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className={clsx(inputClass, 'resize-y')}
      />
    </label>
  )
}

function EntryListEditor({ title, entries = [], onChange }: {
  title: string
  entries?: { name?: string; text?: string }[]
  onChange: (entries: { name?: string; text?: string }[]) => void
}) {
  const setEntry = (index: number, key: 'name' | 'text', value: string) => {
    onChange(entries.map((entry, i) => i === index ? { ...entry, [key]: value } : entry))
  }

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-200 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-parchment font-medium">{title}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange([...(entries ?? []), { name: '', text: '' }])}
        >
          <Plus size={13} /> Adicionar
        </Button>
      </div>

      {!entries.length && (
        <p className="text-xs text-parchment/30">Nenhuma entrada nesta seção.</p>
      )}

      {entries.map((entry, index) => (
        <div key={index} className="rounded border border-stone-300 bg-stone-100 p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={entry.name ?? ''}
              onChange={e => setEntry(index, 'name', e.target.value)}
              placeholder="Nome"
              className={clsx(inputClass, 'flex-1')}
            />
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() => onChange(entries.filter((_, i) => i !== index))}
              aria-label="Remover entrada"
            >
              <Trash2 size={13} />
            </Button>
          </div>
          <textarea
            value={entry.text ?? ''}
            onChange={e => setEntry(index, 'text', e.target.value)}
            rows={4}
            placeholder="Texto"
            className={clsx(inputClass, 'resize-y')}
          />
        </div>
      ))}
    </div>
  )
}

function Structured5eEditor({ type, data, setData }: {
  type: EntityType
  data: Record<string, any>
  setData: (key: string, value: any) => void
}) {
  if (type === 'creatures') {
    return (
      <section className="rounded-xl border border-gold/25 bg-stone-100 p-5 flex flex-col gap-5">
        <div>
          <h2 className="font-display text-lg text-gold">Ficha 5e</h2>
          <p className="text-xs text-parchment/35 mt-1">Edite os dados que aparecem na ficha da criatura.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SmallField label="CA" value={data.ac} onChange={v => setData('ac', v)} />
          <SmallField label="PV" value={data.hpText} onChange={v => setData('hpText', v)} />
          <SmallField label="Deslocamento" value={data.speedText} onChange={v => setData('speedText', v)} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {(['str','dex','con','int','wis','cha'] as const).map(key => (
            <SmallField key={key} label={key.toUpperCase()} type="number" value={data[key]} onChange={v => setData(key, v)} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SmallTextarea label="Sentidos" value={data.senses} onChange={v => setData('senses', v)} />
          <SmallTextarea label="Idiomas" value={data.languages} onChange={v => setData('languages', v)} />
          <SmallTextarea label="Resistências" value={data.resist} onChange={v => setData('resist', v)} />
          <SmallTextarea label="Imunidades" value={data.immune} onChange={v => setData('immune', v)} />
          <SmallTextarea label="Vulnerabilidades" value={data.vulnerable} onChange={v => setData('vulnerable', v)} />
          <SmallTextarea label="Imunidades a condições" value={data.conditionImmune} onChange={v => setData('conditionImmune', v)} />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <EntryListEditor title="Traços" entries={data.traits ?? []} onChange={v => setData('traits', v)} />
          <EntryListEditor title="Ações" entries={data.actions ?? []} onChange={v => setData('actions', v)} />
          <EntryListEditor title="Ações bônus" entries={data.bonus ?? []} onChange={v => setData('bonus', v)} />
          <EntryListEditor title="Reações" entries={data.reactions ?? []} onChange={v => setData('reactions', v)} />
          <EntryListEditor title="Ações lendárias" entries={data.legendary ?? []} onChange={v => setData('legendary', v)} />
        </div>
      </section>
    )
  }

  if (type === 'spells') {
    return (
      <section className="rounded-xl border border-cyan-300/25 bg-stone-100 p-5 flex flex-col gap-5">
        <div>
          <h2 className="font-display text-lg text-cyan-200">Ficha da magia</h2>
          <p className="text-xs text-parchment/35 mt-1">Padronize efeito, conjuração e campos importados do 5etools.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SmallField label="Tempo" value={data.castingTime} onChange={v => setData('castingTime', v)} />
          <SmallField label="Alcance" value={data.range} onChange={v => setData('range', v)} />
          <SmallField label="Componentes" value={data.componentsText} onChange={v => setData('componentsText', v)} />
          <SmallField label="Duração" value={data.duration} onChange={v => setData('duration', v)} />
          <SmallField label="Dano" value={data.damageInflict} onChange={v => setData('damageInflict', v)} />
          <SmallField label="Teste" value={data.savingThrow} onChange={v => setData('savingThrow', v)} />
        </div>
        <SmallTextarea label="Efeito" rows={8} value={data.entries} onChange={v => setData('entries', v)} />
        <EntryListEditor title="Em níveis superiores" entries={data.higherLevel ?? []} onChange={v => setData('higherLevel', v)} />
      </section>
    )
  }

  if (type === 'items') {
    return (
      <section className="rounded-xl border border-amber-300/25 bg-stone-100 p-5 flex flex-col gap-5">
        <div>
          <h2 className="font-display text-lg text-amber-200">Ficha do item</h2>
          <p className="text-xs text-parchment/35 mt-1">Ajuste propriedades, sintonização e descrição do item importado.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SmallField label="Peso" type="number" value={data.weight} onChange={v => setData('weight', v)} />
          <SmallField label="Valor" value={data.valueText} onChange={v => setData('valueText', v)} />
          <SmallField label="Dano" value={data.damage} onChange={v => setData('damage', v)} />
        </div>
        <SmallTextarea label="Propriedades" value={data.propertiesText} onChange={v => setData('propertiesText', v)} />
        <SmallTextarea label="Descrição" rows={8} value={data.entries} onChange={v => setData('entries', v)} />
        <button
          type="button"
          onClick={() => setData('requiresAttunement', !data.requiresAttunement)}
          className="self-start flex items-center gap-3 text-sm text-parchment/70"
        >
          <span className={clsx('w-10 h-5 rounded-full transition-colors relative', data.requiresAttunement ? 'bg-gold' : 'bg-stone-300')}>
            <span className={clsx('absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', data.requiresAttunement ? 'translate-x-5' : 'translate-x-0.5')} />
          </span>
          Requer sintonização
        </button>
      </section>
    )
  }

  return null
}

interface PendingConnection {
  target_type: LinkableType
  target_id: string
  relation_label?: string
  relation_type?: string
  label: string
}

function PendingConnectionsEditor({ campaignId, value, onChange }: {
  campaignId: string
  value: PendingConnection[]
  onChange: (value: PendingConnection[]) => void
}) {
  const [targetType, setTargetType] = useState<LinkableType>('locations')
  const [targetId, setTargetId] = useState('')
  const [relation, setRelation] = useState('')

  const characters = useEntityList(campaignId, 'characters')
  const npcs = useEntityList(campaignId, 'npcs')
  const locations = useEntityList(campaignId, 'locations')
  const items = useEntityList(campaignId, 'items')
  const spells = useEntityList(campaignId, 'spells')
  const creatures = useEntityList(campaignId, 'creatures')
  const notes = useEntityList(campaignId, 'notes')
  const groups = useEntityList(campaignId, 'groups')
  const arcs = useArcs(campaignId)
  const sessions = useCampaignSessions(campaignId)

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

  const types: { type: LinkableType; label: string; icon: React.ElementType }[] = [
    ...Object.entries(ENTITY_CONFIG).map(([type, cfg]) => ({ type: type as LinkableType, label: cfg.labelPlural, icon: cfg.icon })),
    { type: 'arcs', label: 'Arcos', icon: GitBranch },
    { type: 'sessions', label: 'Sessões', icon: Calendar },
  ]

  const displayName = (type: LinkableType, item: any) => {
    if (type in ENTITY_CONFIG) return ENTITY_CONFIG[type as EntityType].displayName(item)
    if (type === 'arcs') return item.title
    if (type === 'sessions') return [item.title, item.arc_title].filter(Boolean).join(' - ')
    return item.title ?? item.name ?? item.id
  }

  const add = () => {
    const item = (lists[targetType] ?? []).find((entry: any) => entry.id === targetId)
    if (!item) return
    const next = {
      target_type: targetType,
      target_id: targetId,
      relation_label: relation.trim() || undefined,
      label: displayName(targetType, item),
    }
    onChange(value.some(link => link.target_type === next.target_type && link.target_id === next.target_id) ? value : [...value, next])
    setTargetId('')
    setRelation('')
  }

  return (
    <section className="rounded-xl border border-stone-300 bg-stone-100 p-4 flex flex-col gap-3">
      <div>
        <h2 className="text-sm text-parchment font-medium flex items-center gap-2">
          <Link2 size={14} className="text-gold" /> Conexões iniciais
        </h2>
        <p className="text-xs text-parchment/35 mt-1">Essas conexões serão criadas assim que a entidade for salva.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_1fr_auto] gap-2">
        <select value={targetType} onChange={e => { setTargetType(e.target.value as LinkableType); setTargetId('') }} className={inputClass}>
          {types.map(type => <option key={type.type} value={type.type}>{type.label}</option>)}
        </select>
        <select value={targetId} onChange={e => setTargetId(e.target.value)} className={inputClass}>
          <option value="">Selecionar...</option>
          {(lists[targetType] ?? []).map((item: any) => (
            <option key={item.id} value={item.id}>{displayName(targetType, item)}</option>
          ))}
        </select>
        <input
          value={relation}
          onChange={e => setRelation(e.target.value)}
          placeholder="Relação"
          className={inputClass}
        />
        <Button type="button" size="sm" onClick={add} disabled={!targetId}>
          <Plus size={13} /> Adicionar
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(link => {
            const type = types.find(t => t.type === link.target_type)
            const Icon = type?.icon ?? Link2
            return (
              <button
                key={`${link.target_type}-${link.target_id}`}
                type="button"
                onClick={() => onChange(value.filter(item => !(item.target_type === link.target_type && item.target_id === link.target_id)))}
                className="text-xs rounded-full border border-gold/25 bg-gold/10 text-gold px-2 py-1 inline-flex items-center gap-1"
              >
                <Icon size={11} /> {link.label} <X size={11} />
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function EntityForm({ campaignId, type, initial, entityId }: Props) {
  const cfg = ENTITY_CONFIG[type]
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEdit = !!entityId
  const initialParentId = type === 'locations' ? searchParams.get('parentId') ?? '' : ''
  const allConfigFields = useMemo(
    () => [...cfg.fields, ...(cfg.sections?.flatMap(section => section.fields) ?? [])],
    [cfg.fields, cfg.sections]
  )
  const initialForm = useMemo(
    () => flattenEntityData(initial) ?? {
      ...Object.fromEntries(allConfigFields.map(f => [f.key, f.key === 'visibility' ? 'public' : fieldDefault(f.type)])),
      ...(type === 'locations' && initialParentId ? { parent_id: initialParentId } : {}),
    },
    [allConfigFields, initial, initialParentId, type]
  )

  const [form, setForm] = useState<Record<string, any>>(initialForm)
  const [savedSnapshot, setSavedSnapshot] = useState(() => serializeForm({ form: initialForm, pendingConnections: [] }))
  const [error, setError] = useState('')
  const [draftError, setDraftError] = useState('')
  const [showDraftHint, setShowDraftHint] = useState(false)
  const [draftHint, setDraftHint] = useState('')
  const [pendingConnections, setPendingConnections] = useState<PendingConnection[]>([])

  const create = useCreateEntity(campaignId, type)
  const update = useUpdateEntity(campaignId, type, entityId ?? '')
  const createLink = useCreateLink(campaignId)
  const draft = useEntityDraft(campaignId)
  const suggestLinks = useSuggestLinks(campaignId)
  const { data: campaign } = useCampaign(campaignId)
  const { data: locations = [] } = useEntityList(campaignId, 'locations', type === 'locations')
  const canShareWithUser = campaign?.role === 'admin' || campaign?.play_role === 'gm'

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))
  const setData = (key: string, val: any) =>
    setForm(f => ({
      ...f,
      [`data.${key}`]: f[`data.${key}`] !== undefined ? val : f[`data.${key}`],
      data: { ...(f.data ?? {}), [key]: val },
    }))

  const structuredData = useMemo(() => {
    const data = form.data && typeof form.data === 'object' ? { ...form.data } : {}
    for (const [key, value] of Object.entries(form)) {
      if (key.startsWith('data.')) data[key.slice(5)] = value
    }
    return data
  }, [form])

  const buildPayload = () => {
    const payload: Record<string, any> = {}
    const dataFields: Record<string, any> = form.data && typeof form.data === 'object' ? { ...form.data } : {}
    for (const [key, value] of Object.entries(form)) {
      if (key.startsWith('data.')) dataFields[key.slice(5)] = value
      else payload[key] = value
    }
    payload.data = dataFields
    if (type === 'locations' && payload.parent_id === '') payload.parent_id = null
    if (payload.visibility !== 'user') payload.shared_with_user_id = null
    if (payload.visibility === 'user' && payload.shared_with_user_id === '') payload.shared_with_user_id = null
    if (type === 'spells') {
      payload.data = {
        ...payload.data,
        spellBlock: true,
        school: payload.school ?? payload.data.school,
        castingTime: payload.casting_time ?? payload.data.castingTime,
        range: payload.range ?? payload.data.range,
        componentsText: payload.components ?? payload.data.componentsText,
        duration: payload.duration ?? payload.data.duration,
      }
    }
    if (type === 'items') {
      payload.data = {
        ...payload.data,
        itemBlock: true,
        type: payload.type ?? payload.data.type,
        rarity: payload.rarity ?? payload.data.rarity,
        entries: payload.description ?? payload.data.entries,
        propertiesText: payload.properties ?? payload.data.propertiesText,
      }
    }
    if (type === 'creatures') {
      payload.data = {
        ...payload.data,
        statBlock: true,
      }
    }
    return payload
  }

  const saveEntity = async () => {
    setError('')
    const payload = buildPayload()
    const result = isEdit
      ? await update.mutateAsync(payload)
      : await create.mutateAsync(payload)
    if (!isEdit && pendingConnections.length) {
      await Promise.all(pendingConnections.map(link => createLink.mutateAsync({
        source_type: type,
        source_id: result.id,
        target_type: link.target_type,
        target_id: link.target_id,
        relation_label: link.relation_label,
        relation_type: link.relation_type as any,
      })))
    }
    setSavedSnapshot(serializeForm({ form, pendingConnections }))
    return result
  }

  const applyDraft = (draftValues: Record<string, any>) => {
    setForm(prev => {
      const next = { ...prev }
      const nextData = next.data && typeof next.data === 'object' && !Array.isArray(next.data)
        ? { ...next.data }
        : {}
      const isBlank = (input: any) => {
        if (input === undefined || input === null) return true
        if (typeof input === 'string') {
          const plain = input.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
          return plain.length === 0
        }
        if (Array.isArray(input)) return input.length === 0
        return false
      }

      const applyField = (key: string, value: any) => {
        if (value === undefined || value === null || value === '') return
        const current = key.startsWith('data.')
          ? nextData[key.slice(5)]
          : next[key]
        if (isBlank(current)) {
          if (key.startsWith('data.')) nextData[key.slice(5)] = value
          else next[key] = value
        }
      }

      for (const [key, value] of Object.entries(draftValues)) {
        if (key === 'data' && value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [dataKey, dataValue] of Object.entries(value as Record<string, any>)) {
            applyField(`data.${dataKey}`, dataValue)
          }
        } else {
          applyField(key, value)
        }
      }
      next.data = nextData
      return next
    })
  }

  const generateDraft = async () => {
    const name = String(form.name ?? '').trim()
    if (name.length < 2) return
    setDraftError('')
    try {
      const result = await draft.generate({ entity_type: type, name, hint: draftHint.trim() || undefined })
      applyDraft(result)
    } catch {
      setDraftError('Não foi possível gerar o rascunho agora.')
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const result = await saveEntity()
      let linkSuggestions: any[] = []
      if (!isEdit) {
        try {
          linkSuggestions = await suggestLinks.suggest({
            entity_type: type,
            entity_id: result.id,
            name: result.name ?? result.title ?? form.name ?? '',
            description: result.description ?? form.description,
          })
        } catch {
          linkSuggestions = []
        }
      }
      runWithoutPrompt(() => navigate(`/campaigns/${campaignId}/${type}/${result.id}`, {
        state: linkSuggestions.length ? { linkSuggestions } : undefined,
      }))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const isPending = create.isPending || update.isPending
  const hasUnsavedChanges = serializeForm({ form, pendingConnections }) !== savedSnapshot
  const { dialog: unsavedDialog, runWithoutPrompt } = useUnsavedChangesPrompt({
    when: hasUnsavedChanges && !isPending,
    onSave: saveEntity,
    saving: isPending,
  })
  const imageField = cfg.fields.find(field => field.key === 'image_url' || field.key === 'portrait_url')
  const parentOptions = locations.filter((location: any) => location.id !== entityId)
  const parentLocationField = type === 'locations' ? (
    <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-4 flex flex-col gap-1">
      <label className="text-sm text-parchment/70 font-medium">Local pai</label>
      <select
        value={form.parent_id ?? ''}
        onChange={e => set('parent_id', e.target.value)}
        className={inputClass}
      >
        <option value="">Nenhum, local principal</option>
        {parentOptions.map((location: any) => (
          <option key={location.id} value={location.id}>{location.name}</option>
        ))}
      </select>
      <p className="text-xs text-parchment/35">Escolha onde este local vive dentro da árvore da campanha.</p>
    </div>
  ) : null

  return (
    <>
    {unsavedDialog}
    <div className="p-8 w-full max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <cfg.icon size={20} className={cfg.accentClass} />
        <div>
          <h1 className="font-display text-2xl text-parchment">
            {isEdit ? `Editar ${cfg.label}` : `Novo ${cfg.label}`}
          </h1>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {DRAFT_TYPES.includes(type) && (
          <div className="rounded-lg border border-gold/20 bg-gold/5 p-4 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm text-parchment/70 font-medium">Rascunho assistido</p>
                <p className="text-xs text-parchment/35 mt-1">A IA preenche apenas campos vazios; você edita tudo antes de salvar.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={generateDraft}
                loading={draft.isPending}
                disabled={String(form.name ?? '').trim().length < 2}
              >
                <Sparkles size={13} /> Gerar rascunho
              </Button>
            </div>
            {showDraftHint ? (
              <Input
                label="Direção (opcional)"
                value={draftHint}
                onChange={event => setDraftHint(event.target.value)}
                placeholder="Ex: tom sombrio, ligado a uma ruína antiga..."
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowDraftHint(true)}
                className="self-start text-xs text-gold hover:text-gold-light transition-colors"
              >
                Adicionar direção
              </button>
            )}
            {draftError && <p className="text-xs text-crimson-light">{draftError}</p>}
          </div>
        )}

        {cfg.fields.map(field => {
          if (field.key === 'image_url' || field.key === 'portrait_url') return null

          if (field.type === 'text' || field.type === 'number') return (
            <Input
              key={field.key}
              label={field.label}
              type={field.type}
              value={form[field.key] ?? ''}
              onChange={e => set(field.key, e.target.value)}
              required={field.required}
              placeholder={field.placeholder}
            />
          )

          if (field.type === 'textarea') return (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-sm text-parchment/70 font-medium">
                {field.label}
                {field.hint && <span className="text-parchment/30 font-normal ml-2 text-xs">{field.hint}</span>}
              </label>
              {type === 'notes' && field.key === 'content' ? (
                <RichTextEditor
                  campaignId={campaignId}
                  value={form[field.key] ?? ''}
                  onChange={value => set(field.key, value)}
                />
              ) : (
                <textarea
                  value={form[field.key] ?? ''}
                  onChange={e => set(field.key, e.target.value)}
                  rows={field.rows ?? 4}
                  placeholder={field.placeholder}
                  className={clsx(inputClass, 'resize-y')}
                />
              )}
            </div>
          )

          if (field.type === 'select') return (
            <div key={field.key} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-parchment/70 font-medium">{field.label}</label>
                <select
                  value={form[field.key] ?? ''}
                  onChange={e => {
                    set(field.key, e.target.value)
                    if (field.key === 'visibility' && e.target.value !== 'user') set('shared_with_user_id', null)
                  }}
                  className={inputClass}
                >
                  <option value="">Selecionar...</option>
                  {field.options
                    ?.filter(o => field.key !== 'visibility' || o !== 'user' || canShareWithUser)
                    .map(o => <option key={o} value={o}>{field.key === 'visibility' ? visibilityLabels[o] ?? o : field.optionLabels?.[o] ?? o}</option>)}
                </select>
              </div>
              {field.key === 'visibility' && form.visibility === 'user' && (
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 flex flex-col gap-1">
                  <label className="text-sm text-parchment/70 font-medium">Usuário com acesso</label>
                  <select
                    value={form.shared_with_user_id ?? ''}
                    onChange={e => set('shared_with_user_id', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecionar membro...</option>
                    {(campaign?.members ?? []).map(member => (
                      <option key={member.id} value={member.id}>{member.username}</option>
                    ))}
                  </select>
                </div>
              )}
              {type === 'locations' && field.key === 'type' && parentLocationField}
            </div>
          )

          if (field.type === 'toggle') return (
            <div key={field.key} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set(field.key, !form[field.key])}
                className={clsx(
                  'w-10 h-5 rounded-full transition-colors relative',
                  form[field.key] ? 'bg-gold' : 'bg-stone-300'
                )}
              >
                <span className={clsx(
                  'absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  form[field.key] ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </button>
              <label className="text-sm text-parchment/70">{field.label}</label>
            </div>
          )

          if (field.type === 'slider') {
            const min = field.sliderMin ?? 1
            const max = field.sliderMax ?? 5
            const current = form[field.key] ?? Math.round((min + max) / 2)
            return (
              <div key={field.key} className="flex flex-col gap-2">
                <label className="text-sm text-parchment/70 font-medium">{field.label}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={current}
                    onChange={e => set(field.key, Number(e.target.value))}
                    className="w-full accent-gold"
                  />
                  <span className="text-xs text-gold w-6 text-right">{current}</span>
                </div>
                {field.sliderLabels && (
                  <div className="flex justify-between text-[11px] text-parchment/35">
                    <span>{field.sliderLabels[0]}</span>
                    <span>{field.sliderLabels[1]}</span>
                  </div>
                )}
              </div>
            )
          }

          if (field.type === 'tags-input') {
            const value = Array.isArray(form[field.key]) ? form[field.key] : []
            return (
              <div key={field.key} className="flex flex-col gap-2">
                <label className="text-sm text-parchment/70 font-medium">{field.label}</label>
                <Input
                  onKeyDown={e => {
                    if (e.key !== 'Enter' && e.key !== ',') return
                    e.preventDefault()
                    const next = e.currentTarget.value.trim().replace(/,$/, '')
                    if (next && !value.includes(next)) set(field.key, [...value, next])
                    e.currentTarget.value = ''
                  }}
                  onBlur={e => {
                    const next = e.currentTarget.value.trim()
                    if (next && !value.includes(next)) set(field.key, [...value, next])
                    e.currentTarget.value = ''
                  }}
                  placeholder={field.placeholder}
                />
                {!!value.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {value.map((tag: string) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => set(field.key, value.filter((item: string) => item !== tag))}
                        className="text-xs rounded-full border border-gold/25 bg-gold/10 text-gold px-2 py-1 inline-flex items-center gap-1"
                      >
                        {tag} <X size={11} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return null
        })}
        {imageField && (
          <div className="flex flex-col gap-2">
            <label className="text-sm text-parchment/70 font-medium">{imageField.label}</label>
            <ImageUpload
              currentUrl={form[imageField.key]}
              context={type}
              fieldKey={imageField.key}
              onUpload={url => set(imageField.key, url)}
            />
            <Input
              label="URL da imagem"
              value={form[imageField.key] ?? ''}
              onChange={e => set(imageField.key, e.target.value)}
              placeholder="https://..."
            />
          </div>
        )}

        {cfg.sections?.map(section => (
          <EntitySection
            key={section.key}
            section={section}
            formValues={form}
            onChange={set}
          />
        ))}

        <Structured5eEditor type={type} data={structuredData} setData={setData} />

        {type === 'npcs' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm text-parchment/70 font-medium">
              Como encontrar
              <span className="text-parchment/30 font-normal ml-2 text-xs"></span>
            </label>
            <textarea
              value={form.data?.hook ?? ''}
              onChange={e => setData('hook', e.target.value)}
              rows={3}
              placeholder="Onde e como o grupo pode encontrar ou conhecer este NPC..."
              className={clsx(inputClass, 'resize-y')}
            />
          </div>
        )}

        {!isEdit && (
          <PendingConnectionsEditor
            campaignId={campaignId}
            value={pendingConnections}
            onChange={setPendingConnections}
          />
        )}

        {error && <p className="text-xs text-crimson-light">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" loading={isPending} className="flex-1">
            {isEdit ? 'Salvar alterações' : `Criar ${cfg.label}`}
          </Button>
        </div>
      </form>
    </div>
    </>
  )
}
