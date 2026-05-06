import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Users, Lock, Globe, KeyRound } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import type { Campaign } from '@/types'

const STATUS_LABEL = { active: 'Ativa', paused: 'Pausada', completed: 'Concluída' }
const STATUS_COLOR = { active: 'text-gold', paused: 'text-parchment/50', completed: 'text-parchment/30' }

export function CampaignList() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [joinCode, setJoinCode]   = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining]     = useState(false)

  useEffect(() => {
    api.get<Campaign[]>('/campaigns')
      .then(setCampaigns)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const joinByCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoinError('')
    setJoining(true)
    try {
      const result = await api.post<{ campaign_id: string }>('/campaigns/join', { code: joinCode })
      navigate(`/campaigns/${result.campaign_id}`)
    } catch (err: any) {
      setJoinError(err.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <div className="p-8 text-parchment/40 text-sm">Carregando campanhas...</div>
  if (error)   return <div className="p-8 text-crimson-light text-sm">{error}</div>

  return (
    <div className="p-8 w-full max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-parchment">Suas Campanhas</h1>
          <p className="text-parchment/40 text-sm mt-1">
            {campaigns.length === 0 ? 'Nenhuma campanha ainda.' : `${campaigns.length} campanha${campaigns.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link to="/campaigns/new">
          <Button size="md">
            <Plus size={16} /> Nova campanha
          </Button>
        </Link>
      </div>

      <form onSubmit={joinByCode} className="bg-stone-100 border border-stone-300 rounded-xl p-4 mb-8 flex flex-col gap-3">
        <p className="text-sm text-parchment/60 font-medium flex items-center gap-2">
          <KeyRound size={14} /> Entrar com código de convite
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="LK-ABCD-1234"
            className="flex-1 bg-stone-200 border border-stone-300 rounded px-3 py-2 text-sm text-parchment placeholder-parchment/35 focus:outline-none focus:border-gold/60"
          />
          <Button type="submit" size="sm" loading={joining}>
            Entrar
          </Button>
        </div>
        {joinError && <p className="text-xs text-crimson-light">{joinError}</p>}
      </form>

      {/* Lista */}
      {campaigns.length === 0 ? (
        <div className="border border-dashed border-stone-300 rounded-xl p-12 text-center">
          <BookOpen size={32} className="mx-auto text-parchment/20 mb-3" />
          <p className="text-parchment/40 text-sm">Crie sua primeira campanha para começar.</p>
          <Link to="/campaigns/new" className="mt-4 inline-block">
            <Button variant="ghost" size="sm"><Plus size={14} /> Criar agora</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map(c => (
            <Link key={c.id} to={`/campaigns/${c.id}`}>
              <div className="bg-stone-100 border border-stone-300 rounded-xl p-5 hover:border-gold/40 transition-colors group">
                {/* Cover placeholder */}
                <div className="aspect-video rounded bg-stone-200 mb-4 flex items-center justify-center overflow-hidden">
                  {c.cover_image_url
                    ? <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-contain" />
                    : <BookOpen size={28} className="text-parchment/20" />
                  }
                </div>

                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-base text-parchment group-hover:text-gold transition-colors leading-tight">
                    {c.title}
                  </h2>
                  {c.visibility === 'private'
                    ? <Lock size={13} className="text-parchment/30 mt-0.5 shrink-0" />
                    : <Globe size={13} className="text-parchment/30 mt-0.5 shrink-0" />
                  }
                </div>

                {c.scenario_type && (
                  <p className="text-xs text-parchment/40 mt-0.5">{c.scenario_type}</p>
                )}

                <div className="flex items-center gap-4 mt-3 text-xs text-parchment/40">
                  <span className={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</span>
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {c.member_count ?? 1}
                  </span>
                  <span className="capitalize">{c.role}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
