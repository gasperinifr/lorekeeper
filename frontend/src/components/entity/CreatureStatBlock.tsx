import { BookOpen, Eye, Footprints, HeartPulse, Languages, Shield, Swords } from 'lucide-react'
import { clsx } from 'clsx'

function abilityMod(score?: number) {
  if (typeof score !== 'number') return ''
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : String(mod)
}

function MetricCard({ icon: Icon, label, value }: {
  icon: React.ElementType
  label: string
  value?: unknown
}) {
  return (
    <div className="border border-stone-300 bg-stone-200 rounded-md px-4 py-3">
      <p className="text-xs text-parchment/35 uppercase tracking-widest flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </p>
      <p className="text-base font-display text-parchment mt-1 leading-tight">{value ? String(value) : '—'}</p>
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value?: unknown }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px,1fr] gap-1 sm:gap-3 py-2 border-b border-stone-300/60 last:border-b-0">
      <p className="text-xs uppercase tracking-widest text-parchment/35">{label}</p>
      <p className="text-sm text-parchment/75 leading-relaxed">{String(value)}</p>
    </div>
  )
}

function EntrySection({ title, entries, accent = 'border-gold/40' }: {
  title: string
  entries?: { name?: string; text?: string }[]
  accent?: string
}) {
  if (!entries?.length) return null
  return (
    <section className="rounded-md border border-stone-300 bg-stone-100 overflow-hidden">
      <h3 className={clsx('font-display text-base text-gold border-b px-4 py-3', accent)}>{title}</h3>
      <div className="divide-y divide-stone-300/70">
        {entries.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="px-4 py-3">
            {entry.name && <p className="font-semibold italic text-parchment text-sm mb-1">{entry.name}</p>}
            <p className="text-sm text-parchment/75 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function CreatureStatBlock({ creature }: { creature: any }) {
  const data = creature.data ?? {}
  const abilities = [
    ['FOR', data.str],
    ['DES', data.dex],
    ['CON', data.con],
    ['INT', data.int],
    ['SAB', data.wis],
    ['CAR', data.cha],
  ] as const

  return (
    <div className="rounded-lg border border-gold/25 bg-stone-100 overflow-hidden">
      <div className="flex flex-col md:flex-row gap-5 p-5 border-b border-stone-300 bg-stone-200/60">
        {creature.image_url && (
          <img
            src={creature.image_url}
            alt={creature.name}
            className="w-full md:w-40 max-h-64 md:max-h-40 rounded-md object-contain border border-gold/35 bg-stone-300"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs px-2 py-1 rounded border border-gold/25 bg-gold/10 text-gold">
              CR {creature.cr ?? '—'}
            </span>
            {data.source && (
              <span className="text-xs px-2 py-1 rounded border border-stone-300 text-parchment/45 flex items-center gap-1">
                <BookOpen size={11} /> {[data.source, data.page ? `p. ${data.page}` : null].filter(Boolean).join(' ')}
              </span>
            )}
          </div>

          <p className="text-sm text-parchment/60 leading-relaxed">
            {[data.size, creature.type, data.alignment].filter(Boolean).join(', ')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <MetricCard icon={Shield} label="CA" value={data.ac} />
            <MetricCard icon={HeartPulse} label="PV" value={data.hpText || data.hp} />
            <MetricCard icon={Footprints} label="Desloc." value={data.speedText} />
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {abilities.map(([label, score]) => (
            <div key={label} className="bg-stone-200 border border-stone-300 rounded-md px-3 py-2 text-center">
              <p className="text-xs text-parchment/35 uppercase">{label}</p>
              <p className="text-lg text-parchment font-display leading-tight">{score ?? '—'}</p>
              {typeof score === 'number' && <p className="text-xs text-parchment/45">{abilityMod(score)}</p>}
            </div>
          ))}
        </div>

        <div className="rounded-md border border-stone-300 bg-stone-200 px-4">
          <DetailLine label="Salvaguardas" value={data.save && Object.entries(data.save).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(', ')} />
          <DetailLine label="Perícias" value={data.skill && Object.entries(data.skill).map(([k, v]) => `${k} ${v}`).join(', ')} />
          <DetailLine label="Vulnerável" value={data.vulnerable} />
          <DetailLine label="Resiste" value={data.resist} />
          <DetailLine label="Imune" value={data.immune} />
          <DetailLine label="Condições" value={data.conditionImmune} />
          <DetailLine
            label="Sentidos"
            value={[data.senses, data.passive ? `Percepção passiva ${data.passive}` : null].filter(Boolean).join(', ')}
          />
          <DetailLine label="Idiomas" value={data.languages} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EntrySection title="Traços" entries={data.traits} />
          <EntrySection title="Ações" entries={data.actions} />
          <EntrySection title="Ações Bônus" entries={data.bonus} />
          <EntrySection title="Reações" entries={data.reactions} />
          <EntrySection title="Ações Lendárias" entries={data.legendary} accent="border-crimson/40" />
        </div>

        {!data.traits?.length && !data.actions?.length && creature.description && (
          <section className="rounded-md border border-stone-300 bg-stone-200 p-4">
            <h3 className="text-xs text-parchment/35 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Swords size={12} /> Descrição
            </h3>
            <p className="text-sm text-parchment/70 leading-relaxed whitespace-pre-wrap">{creature.description}</p>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-parchment/35">
          {data.senses && <span className="flex items-center gap-1.5"><Eye size={12} /> {data.senses}</span>}
          {data.languages && <span className="flex items-center gap-1.5"><Languages size={12} /> {data.languages}</span>}
        </div>
      </div>
    </div>
  )
}
