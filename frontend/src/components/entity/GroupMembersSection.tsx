import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Plus, Skull, User, Users, X } from 'lucide-react'
import { useEntityList } from '@/hooks/useEntities'
import { useAddGroupMember, useRemoveGroupMember } from '@/hooks/useGroups'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Group, GroupMember } from '@/types'
import { clsx } from 'clsx'

const inputClass = 'bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-colors'

function memberName(member: GroupMember) {
  return member.npc_name ?? member.char_name ?? 'Membro sem nome'
}

function memberPortrait(member: GroupMember) {
  return member.npc_portrait ?? member.char_portrait
}

function memberPath(campaignId: string, member: GroupMember) {
  if (member.npc_id) return `/campaigns/${campaignId}/npcs/${member.npc_id}`
  if (member.character_id) return `/campaigns/${campaignId}/characters/${member.character_id}`
  return '#'
}

function memberType(member: GroupMember) {
  return member.npc_id ? 'NPC' : 'Personagem'
}

export function GroupMembersSection({ campaignId, group, canEdit }: {
  campaignId: string
  group: Group
  canEdit: boolean
}) {
  const [memberTypeToAdd, setMemberTypeToAdd] = useState<'npcs' | 'characters'>('npcs')
  const [selectedId, setSelectedId] = useState('')
  const [role, setRole] = useState('')
  const [isSecret, setIsSecret] = useState(false)
  const [error, setError] = useState('')

  const npcs = useEntityList(campaignId, 'npcs', canEdit)
  const characters = useEntityList(campaignId, 'characters', canEdit)
  const addMember = useAddGroupMember(campaignId, group.id)
  const removeMember = useRemoveGroupMember(campaignId, group.id)

  const options = memberTypeToAdd === 'npcs' ? npcs.data ?? [] : characters.data ?? []
  const existingIds = useMemo(
    () => new Set(group.members.map(member => memberTypeToAdd === 'npcs' ? member.npc_id : member.character_id).filter(Boolean)),
    [group.members, memberTypeToAdd]
  )
  const availableOptions = options.filter((item: any) => !existingIds.has(item.id))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedId) return
    setError('')
    try {
      await addMember.mutateAsync({
        npc_id: memberTypeToAdd === 'npcs' ? selectedId : undefined,
        character_id: memberTypeToAdd === 'characters' ? selectedId : undefined,
        role: role.trim() || undefined,
        is_secret: isSecret,
      })
      setSelectedId('')
      setRole('')
      setIsSecret(false)
    } catch (err: any) {
      setError(err.message ?? 'Nao foi possivel adicionar o membro.')
    }
  }

  const remove = async (memberId: string) => {
    setError('')
    try {
      await removeMember.mutateAsync(memberId)
    } catch (err: any) {
      setError(err.message ?? 'Nao foi possivel remover o membro.')
    }
  }

  return (
    <section className="mt-4 border-t border-stone-300 pt-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-lg text-parchment flex items-center gap-2">
            <Users size={17} className="text-amber-400" /> Membros
          </h2>
          <p className="text-xs text-parchment/35 mt-1">{group.members.length} integrante(s) registrados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {group.members.map(member => {
          const portrait = memberPortrait(member)
          const name = memberName(member)
          return (
            <article key={member.id} className="rounded-lg border border-stone-300 bg-stone-100 p-3 flex items-center gap-3">
              <Link to={memberPath(campaignId, member)} className="shrink-0">
                <div className="h-11 w-11 rounded-full border border-stone-300 bg-stone-200 overflow-hidden flex items-center justify-center text-sm text-gold font-medium">
                  {portrait ? (
                    <img src={portrait} alt={name} className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    name.slice(0, 1).toUpperCase()
                  )}
                </div>
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Link to={memberPath(campaignId, member)} className="text-sm text-parchment hover:text-gold transition-colors truncate">
                    {name}
                  </Link>
                  <span className="text-[11px] text-parchment/30 shrink-0">{memberType(member)}</span>
                  {group._can_view_dm && member.is_secret && (
                    <span className="inline-flex items-center rounded border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold" title="Secreto">
                      <Lock size={10} />
                    </span>
                  )}
                  {member.npc_id && member.npc_is_alive === false && (
                    <span className="rounded border border-crimson/25 bg-crimson/10 px-1.5 py-0.5 text-[10px] text-crimson-light">
                      morto
                    </span>
                  )}
                </div>
                <p className="text-xs text-parchment/35 truncate">
                  {[member.role, member.npc_role, member.char_class].filter(Boolean).join(' - ') || 'Sem papel definido'}
                </p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(member.id)}
                  className="h-8 w-8 rounded text-parchment/30 hover:text-crimson-light hover:bg-stone-200 transition-colors flex items-center justify-center"
                  title="Remover membro"
                >
                  <X size={15} />
                </button>
              )}
            </article>
          )
        })}
      </div>

      {!group.members.length && (
        <div className="rounded-lg border border-stone-300 bg-stone-100 p-5 text-sm text-parchment/35">
          Nenhum membro registrado neste grupo.
        </div>
      )}

      {canEdit && (
        <form onSubmit={submit} className="mt-4 rounded-lg border border-stone-300 bg-stone-100 p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-parchment/70 font-medium">Tipo</label>
              <div className="h-10 rounded border border-stone-300 bg-stone-200 p-0.5 grid grid-cols-2">
                {(['npcs', 'characters'] as const).map(type => {
                  const Icon = type === 'npcs' ? Skull : User
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setMemberTypeToAdd(type); setSelectedId('') }}
                      className={clsx(
                        'rounded px-2 text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors',
                        memberTypeToAdd === type ? 'bg-stone-300 text-gold' : 'text-parchment/40 hover:text-parchment/70'
                      )}
                    >
                      <Icon size={13} /> {type === 'npcs' ? 'NPC' : 'Personagem'}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-parchment/70 font-medium">Membro</label>
              <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className={inputClass}>
                <option value="">Selecionar...</option>
                {availableOptions.map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {memberTypeToAdd === 'npcs' ? [item.name, item.role].filter(Boolean).join(' - ') : [item.name, item.class].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Papel"
              value={role}
              onChange={event => setRole(event.target.value)}
              placeholder="Lider, agente, aliado..."
            />

            <Button type="submit" size="sm" loading={addMember.isPending} disabled={!selectedId}>
              <Plus size={13} /> Adicionar
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setIsSecret(value => !value)}
            className="self-start flex items-center gap-3 text-sm text-parchment/70"
          >
            <span className={clsx('w-10 h-5 rounded-full transition-colors relative', isSecret ? 'bg-gold' : 'bg-stone-300')}>
              <span className={clsx('absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', isSecret ? 'translate-x-5' : 'translate-x-0.5')} />
            </span>
            Secreto
          </button>

          {error && <p className="text-xs text-crimson-light">{error}</p>}
        </form>
      )}
    </section>
  )
}
