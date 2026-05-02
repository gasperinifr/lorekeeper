import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Campaign } from '@/types'

const SCENARIO_TYPES = [
  'Alta Fantasia', 'Dark Fantasy', 'Político', 'Marítimo',
  'Dungeon Crawl', 'Horror', 'Steampunk', 'Sandbox', 'Outro',
]

export function CampaignCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', description: '', scenario_type: '',
    visibility: 'private', started_at: '',
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const c = await api.post<Campaign>('/campaigns', form)
      navigate(`/campaigns/${c.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 w-full max-w-[1400px] mx-auto">
      <h1 className="font-display text-2xl text-parchment mb-1">Nova Campanha</h1>
      <p className="text-parchment/40 text-sm mb-8">Preencha o básico — você pode expandir depois.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input label="Título *" value={form.title} onChange={set('title')} required placeholder="A Queda de Shadowfell" />

        <div className="flex flex-col gap-1">
          <label className="text-sm text-parchment/70 font-medium">Descrição</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={3}
            placeholder="Uma breve sinopse da campanha..."
            className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/40 focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-colors resize-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-parchment/70 font-medium">Tipo de cenário</label>
          <select
            value={form.scenario_type}
            onChange={set('scenario_type')}
            className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
          >
            <option value="">Selecionar...</option>
            {SCENARIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-parchment/70 font-medium">Visibilidade</label>
          <select
            value={form.visibility}
            onChange={set('visibility')}
            className="bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment focus:outline-none focus:border-gold/60"
          >
            <option value="private">Privada</option>
            <option value="unlisted">Não listada</option>
            <option value="public">Pública</option>
          </select>
        </div>

        <Input label="Data de início" type="date" value={form.started_at} onChange={set('started_at')} />

        {error && <p className="text-xs text-crimson-light">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')}>Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-1">Criar campanha</Button>
        </div>
      </form>
    </div>
  )
}