import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useEntityDraft } from '@/hooks/useEntityDraft'
import { useCreateEntity } from '@/hooks/useEntities'
import type { EntityType } from '@/types'

interface Props {
  campaignId: string
  entityType: 'creatures' | 'items' | 'spells'
  onClose: () => void
  onCreated?: (entityId: string) => void
}

const labels: Record<Props['entityType'], string> = {
  creatures: 'criatura',
  items: 'item',
  spells: 'magia',
}

function toPayload(name: string, draftValues: Record<string, any>) {
  const payload: Record<string, any> = { name, ...draftValues }
  const data = payload.data && typeof payload.data === 'object' ? { ...payload.data } : {}
  for (const [key, value] of Object.entries(payload)) {
    if (!key.startsWith('data.')) continue
    data[key.slice(5)] = value
    delete payload[key]
  }
  if (Object.keys(data).length > 0) payload.data = data
  payload.name = String(payload.name ?? name).trim() || name
  return payload
}

export function EntityAIGenerator({ campaignId, entityType, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')
  const draft = useEntityDraft(campaignId)
  const create = useCreateEntity(campaignId, entityType as EntityType)

  const submit = async () => {
    const cleanName = name.trim()
    if (cleanName.length < 2) {
      setError('Informe um nome com ao menos 2 caracteres.')
      return
    }

    setError('')
    try {
      const draftValues = await draft.generate({
        entity_type: entityType as EntityType,
        name: cleanName,
        hint: hint.trim() || undefined,
      })
      const created = await create.mutateAsync(toPayload(cleanName, draftValues))
      onCreated?.(created.id)
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Nao foi possivel criar com IA agora.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-stone-100 border border-stone-300 rounded-xl p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-gold flex items-center gap-2">
            <Sparkles size={18} /> Criar {labels[entityType]} com IA
          </h2>
          <button onClick={onClose} className="text-parchment/35 hover:text-parchment/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        <Input
          label={`Nome da ${labels[entityType]}`}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={entityType === 'spells' ? 'Ex: Orbe Fulgurante' : `Ex: ${labels[entityType]} lendario(a)`}
        />
        <Input
          label="Direcao (opcional)"
          value={hint}
          onChange={e => setHint(e.target.value)}
          placeholder="Tom, bioma, tema, escola de magia, raridade, etc."
        />

        {error && <p className="text-xs text-crimson-light">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit} loading={draft.isPending || create.isPending}>
            Gerar e criar
          </Button>
        </div>
      </div>
    </div>
  )
}
