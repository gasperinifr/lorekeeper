import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Search, Download, Sword, Package, BookOpen, ChevronDown } from 'lucide-react'
import { use5eCreatures, use5eSpells, use5eItems, useImport5e } from '@/hooks/use5etools'
import { Button } from '@/components/ui/Button'
import { clsx } from 'clsx'

type Tab = 'creatures' | 'spells' | 'items'

interface Props {
  campaignId: string
  initialTab?: Tab
  lockedTab?: boolean
  onClose: () => void
}

const CR_OPTIONS = ['1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24']
const LEVEL_OPTIONS = ['0','1','2','3','4','5','6','7','8','9']

function CreatureCard({ item, onImport, importing }: { item: any; onImport: () => void; importing: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-stone-200 border border-stone-300 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-parchment">{item.name}</p>
          <p className="text-xs text-parchment/40">
            {[item.type, item.cr ? `CR ${item.cr}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-parchment/30 hover:text-parchment transition-colors p-1">
          <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} />
        </button>
        <Button size="sm" onClick={onImport} loading={importing}>
          <Download size={12} /> Importar
        </Button>
      </div>
      {open && item.data && (
        <div className="px-4 pb-3 border-t border-stone-300 pt-2 grid grid-cols-3 gap-2 text-xs text-parchment/60">
          {item.data.hp   && <span>HP: {item.data.hp}</span>}
          {item.data.ac   && <span>CA: {item.data.ac}</span>}
          {item.data.str  && <span>FOR {item.data.str} · DES {item.data.dex} · CON {item.data.con}</span>}
        </div>
      )}
    </div>
  )
}

function GenericCard({ item, onImport, importing }: { item: any; onImport: () => void; importing: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-stone-200 border border-stone-300 rounded-lg px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-parchment truncate">{item.name}</p>
        <p className="text-xs text-parchment/40 truncate">
          {[item.school ?? item.rarity, item.level !== undefined ? `Nível ${item.level}` : null, item.type]
            .filter(Boolean).join(' · ')}
        </p>
      </div>
      <Button size="sm" onClick={onImport} loading={importing}>
        <Download size={12} /> Importar
      </Button>
    </div>
  )
}

export function FiveEBrowser({ campaignId, initialTab = 'creatures', lockedTab = false, onClose }: Props) {
  const navigate = useNavigate()
  const [tab, setTab]   = useState<Tab>(initialTab)
  const [q, setQ]       = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState<string | null>(null)

  const creatures = use5eCreatures(tab === 'creatures' ? q : '', tab === 'creatures' ? filters : {})
  const spells    = use5eSpells(tab === 'spells' ? q : '', tab === 'spells' ? filters : {})
  const items     = use5eItems(tab === 'items' ? q : '')
  const importMut = useImport5e(campaignId)

  const currentData = tab === 'creatures' ? creatures : tab === 'spells' ? spells : items
  const results = currentData.data?.results ?? []
  const error = currentData.error instanceof Error ? currentData.error.message : ''

  const doImport = async (item: any) => {
    const key = item.source_key
    setImporting(key)
    try {
      const imported: any = await importMut.mutateAsync({ entityType: tab, entityData: item })
      onClose()
      navigate(`/campaigns/${campaignId}/${tab}/${imported.id}`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setImporting(null)
    }
  }

  const setFilter = (k: string, v: string) =>
    setFilters(f => v ? { ...f, [k]: v } : Object.fromEntries(Object.entries(f).filter(([key]) => key !== k)))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-stone-100 border border-stone-300 rounded-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-300">
          <div>
            <h2 className="font-display text-lg text-parchment">Catálogo 5etools</h2>
            <p className="text-xs text-parchment/40 mt-0.5">
              Importe {tab === 'creatures' ? 'criaturas' : tab === 'spells' ? 'magias' : 'itens'} para sua campanha
            </p>
          </div>
          <button onClick={onClose} className="text-parchment/30 hover:text-parchment transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        {!lockedTab && <div className="flex border-b border-stone-300 px-4">
          {([['creatures','Criaturas', Sword],['spells','Magias', BookOpen],['items','Itens', Package]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setQ(''); setFilters({}) }}
              className={clsx(
                'flex items-center gap-1.5 text-sm px-4 py-3 border-b-2 transition-colors',
                tab === key
                  ? 'border-gold text-gold'
                  : 'border-transparent text-parchment/40 hover:text-parchment'
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>}

        {/* Busca e filtros */}
        <div className="px-6 py-4 border-b border-stone-300 flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-parchment/30" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={`Buscar ${tab === 'creatures' ? 'criaturas' : tab === 'spells' ? 'magias' : 'itens'}...`}
              className="w-full bg-stone-200 border border-stone-300 rounded-lg px-3 py-2 pl-8 text-sm text-parchment placeholder-parchment/30 focus:outline-none focus:border-gold/50"
            />
          </div>

          {/* Filtros por tab */}
          {tab === 'creatures' && (
            <div className="flex gap-2">
              <select
                onChange={e => setFilter('cr', e.target.value)}
                className="bg-stone-200 border border-stone-300 rounded px-2 py-1.5 text-xs text-parchment focus:outline-none flex-1"
              >
                <option value="">Qualquer CR</option>
                {CR_OPTIONS.map(c => <option key={c} value={c}>CR {c}</option>)}
              </select>
              <select
                onChange={e => setFilter('type', e.target.value)}
                className="bg-stone-200 border border-stone-300 rounded px-2 py-1.5 text-xs text-parchment focus:outline-none flex-1"
              >
                <option value="">Qualquer tipo</option>
                {['humanoid','beast','undead','fiend','dragon','monstrosity','elemental','construct','celestial','fey','aberration','giant','plant','ooze'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}
          {tab === 'spells' && (
            <div className="flex gap-2">
              <select
                onChange={e => setFilter('level', e.target.value)}
                className="bg-stone-200 border border-stone-300 rounded px-2 py-1.5 text-xs text-parchment focus:outline-none flex-1"
              >
                <option value="">Qualquer nível</option>
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l === '0' ? 'Truque (0)' : `Nível ${l}`}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
          {q.length < 2 && (
            <p className="text-parchment/30 text-sm text-center py-8">
              Digite ao menos 2 caracteres para buscar.
            </p>
          )}
          {currentData.isLoading && (
            <p className="text-parchment/30 text-sm text-center py-8">Buscando...</p>
          )}
          {error && (
            <p className="text-crimson-light bg-crimson/10 border border-crimson/20 rounded px-4 py-3 text-sm">
              {error}
            </p>
          )}
          {!error && !currentData.isLoading && q.length >= 2 && results.length === 0 && (
            <p className="text-parchment/30 text-sm text-center py-8">Nenhum resultado.</p>
          )}
          {results.map((item: any) =>
            tab === 'creatures' ? (
              <CreatureCard
                key={item.source_key}
                item={item}
                onImport={() => doImport(item)}
                importing={importing === item.source_key}
              />
            ) : (
              <GenericCard
                key={item.source_key}
                item={item}
                onImport={() => doImport(item)}
                importing={importing === item.source_key}
              />
            )
          )}
          {currentData.data && results.length < currentData.data.total && (
            <p className="text-xs text-parchment/30 text-center py-2">
              Mostrando 50 de {currentData.data.total}. Refine a busca para ver mais.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
