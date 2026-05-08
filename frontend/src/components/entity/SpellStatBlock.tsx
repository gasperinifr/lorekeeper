import { BookOpen, Clock, Component, Gem, Ruler, Sparkles, Target } from 'lucide-react'

function Fact({ icon: Icon, label, value }: {
  icon: React.ElementType
  label: string
  value?: unknown
}) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="rounded-md border border-stone-300 bg-stone-200 px-4 py-3">
      <p className="text-xs text-parchment/35 uppercase tracking-widest flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </p>
      <p className="text-sm text-parchment/75 mt-1 leading-relaxed">{String(value)}</p>
    </div>
  )
}

export function SpellStatBlock({ spell }: { spell: any }) {
  const data = spell.data ?? {}
  const hasMeta = data.ritual || data.concentration || data.damageInflict || data.savingThrow
  const headerFacts = [
    ['Tempo', data.castingTime ?? spell.casting_time],
    ['Alcance', data.range ?? spell.range],
    ['Duração', data.duration ?? spell.duration],
    ['Teste', data.savingThrow],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')

  return (
    <div className="rounded-lg border border-cyan-300/20 bg-stone-100 overflow-hidden">
      <div className="flex flex-col md:flex-row items-start gap-5 p-5 border-b border-stone-300 bg-stone-200/60">
        {spell.image_url && (
          <img
            src={spell.image_url}
            alt={spell.name}
            className="w-full md:w-40 max-h-64 md:max-h-40 rounded-md object-contain border border-cyan-300/30 bg-stone-300 shrink-0"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs px-2 py-1 rounded border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              {data.levelText ?? (spell.level === 0 ? 'Truque' : `Nível ${spell.level}`)}
            </span>
            {spell.school && (
              <span className="text-xs px-2 py-1 rounded border border-stone-300 text-parchment/50">{spell.school}</span>
            )}
            {data.source && (
              <span className="text-xs px-2 py-1 rounded border border-stone-300 text-parchment/45 flex items-center gap-1">
                <BookOpen size={11} /> {[data.source, data.page ? `p. ${data.page}` : null].filter(Boolean).join(' ')}
              </span>
            )}
          </div>
          <p className="text-sm text-parchment/60 leading-relaxed">
            {[
              data.ritual ? 'Ritual' : null,
              data.concentration ? 'Concentração' : null,
              data.classes?.length ? data.classes.join(', ') : null,
            ].filter(Boolean).join(' · ')}
          </p>
          {headerFacts.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {headerFacts.map(([label, value]) => (
                <div key={String(label)} className="rounded border border-cyan-300/15 bg-stone-100 px-3 py-2">
                  <p className="text-[11px] text-parchment/35 uppercase tracking-widest">{label}</p>
                  <p className="text-xs text-parchment/75 mt-1 truncate">{String(value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Fact icon={Clock} label="Tempo" value={data.castingTime ?? spell.casting_time} />
          <Fact icon={Ruler} label="Alcance" value={data.range ?? spell.range} />
          <Fact icon={Component} label="Componentes" value={data.componentsText ?? spell.components} />
          <Fact icon={Sparkles} label="Duração" value={data.duration ?? spell.duration} />
        </div>

        {hasMeta && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Fact icon={Gem} label="Dano" value={data.damageInflict} />
            <Fact icon={Target} label="Teste" value={data.savingThrow} />
          </div>
        )}

        {data.entries && (
          <section className="rounded-md border border-stone-300 bg-stone-200 p-4">
            <p className="text-xs text-parchment/35 uppercase tracking-widest mb-2">Efeito</p>
            <p className="text-sm text-parchment/75 leading-relaxed whitespace-pre-wrap">{data.entries}</p>
          </section>
        )}

        {data.higherLevel?.length > 0 && (
          <section className="rounded-md border border-cyan-300/20 bg-cyan-300/5 p-4">
            <p className="text-xs text-cyan-200/70 uppercase tracking-widest mb-2">Em níveis superiores</p>
            {data.higherLevel.map((entry: any, index: number) => (
              <p key={`${entry.name}-${index}`} className="text-sm text-parchment/75 leading-relaxed whitespace-pre-wrap">
                {entry.text}
              </p>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
