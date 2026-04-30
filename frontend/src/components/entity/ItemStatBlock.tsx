import { BookOpen, Coins, Feather, Gem, Package, ShieldCheck, Swords } from 'lucide-react'

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

export function ItemStatBlock({ item }: { item: any }) {
  const data = item.data ?? {}

  return (
    <div className="rounded-lg border border-amber-300/20 bg-stone-100 overflow-hidden">
      <div className="p-5 border-b border-stone-300 bg-stone-200/60">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs px-2 py-1 rounded border border-amber-300/25 bg-amber-300/10 text-amber-200">
            {data.rarity ?? item.rarity ?? 'Comum'}
          </span>
          <span className="text-xs px-2 py-1 rounded border border-stone-300 text-parchment/50">
            {data.type ?? item.type ?? 'Item'}
          </span>
          {data.source && (
            <span className="text-xs px-2 py-1 rounded border border-stone-300 text-parchment/45 flex items-center gap-1">
              <BookOpen size={11} /> {[data.source, data.page ? `p. ${data.page}` : null].filter(Boolean).join(' ')}
            </span>
          )}
        </div>
        {data.requiresAttunement && (
          <p className="text-sm text-gold/80 leading-relaxed">
            Requer sintonização{data.attunementText ? `: ${data.attunementText}` : ''}
          </p>
        )}
      </div>

      <div className="p-5 flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Fact icon={Package} label="Tipo" value={data.type ?? item.type} />
          <Fact icon={Gem} label="Raridade" value={data.rarity ?? item.rarity} />
          <Fact icon={Feather} label="Peso" value={data.weight ? `${data.weight} lb.` : ''} />
          <Fact icon={Coins} label="Valor" value={data.valueText} />
          <Fact icon={Swords} label="Dano" value={data.damage} />
          <Fact icon={ShieldCheck} label="Propriedades" value={data.propertiesText ?? item.properties} />
        </div>

        {(data.entries || item.description) && (
          <section className="rounded-md border border-stone-300 bg-stone-200 p-4">
            <p className="text-xs text-parchment/35 uppercase tracking-widest mb-2">Descrição</p>
            <p className="text-sm text-parchment/75 leading-relaxed whitespace-pre-wrap">
              {data.entries || item.description}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
