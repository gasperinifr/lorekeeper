import { ElementType, FormEvent, useEffect, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  BookOpen, Map, Users, Sword, Bug, Scroll,
  GitBranch, Calendar, Search, Settings, ChevronLeft,
  Skull, Home, LogOut, MessageSquare, Network, Sparkles,
  BookMarked, Pencil, X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCampaign } from '@/hooks/useCampaign'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const WORLD_SECTIONS = [
  { label: 'Personagens', icon: Users, path: 'characters' },
  { label: 'NPCs', icon: Skull, path: 'npcs' },
  { label: 'Locais', icon: Map, path: 'locations' },
  { label: 'Itens', icon: Sword, path: 'items' },
  { label: 'Magias', icon: BookOpen, path: 'spells' },
  { label: 'Criaturas', icon: Bug, path: 'creatures' },
  { label: 'Notas', icon: Scroll, path: 'notes' },
]

const NARRATIVE_SECTIONS = [
  { label: 'Arcos & Atos', icon: GitBranch, path: 'arcs' },
  { label: 'Sessões', icon: Calendar, path: 'sessions' },
  { label: 'Crônica', icon: BookMarked, path: 'chronicle' },
]

function NavItem({ to, icon: Icon, label, exact = false }: { to: string; icon: ElementType; label: string; exact?: boolean }) {
  const loc = useLocation()
  const active = exact ? loc.pathname === to : loc.pathname.includes(to)
  return (
    <Link
      to={to}
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors',
        active
          ? 'bg-gold/20 text-gold font-medium'
          : 'text-parchment/60 hover:text-parchment hover:bg-stone-200'
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  )
}

export function Sidebar() {
  const { campaignId } = useParams()
  const { user, logout, updateUsername } = useAuth()
  const { data: campaign } = useCampaign(campaignId ?? '')
  const canEdit = ['admin', 'editor'].includes(campaign?.role ?? '')
  const [profileOpen, setProfileOpen] = useState(false)
  const [username, setUsername] = useState(user?.username ?? '')
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    setUsername(user?.username ?? '')
  }, [user?.username])

  const submitProfile = async (event: FormEvent) => {
    event.preventDefault()
    setProfileError('')
    setProfileSaved(false)

    try {
      setProfileSaving(true)
      await updateUsername(username)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2200)
    } catch (err: any) {
      setProfileError(err.message)
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <aside className="w-60 h-screen shrink-0 bg-stone-100 border-r border-stone-300 flex flex-col">
      <div className="h-[68px] px-4 border-b border-stone-300 flex items-center justify-center">
        <Link to="/dashboard" className="lk-logo inline-flex h-9 items-center justify-center text-center text-gold hover:text-gold-light transition-colors">
          Lorekeeper
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {!campaignId && (
          <NavItem to="/dashboard" icon={Home} label="Campanhas" />
        )}

        {campaignId && (
          <>
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-xs text-parchment/40 hover:text-parchment/70 mb-3 transition-colors"
            >
              <ChevronLeft size={14} /> Todas as campanhas
            </Link>

            <NavItem to={`/campaigns/${campaignId}`} icon={Home} label="Início" exact />
            <NavItem to={`/campaigns/${campaignId}/search`} icon={Search} label="Buscar" />
            <NavItem to={`/campaigns/${campaignId}/taverna`} icon={MessageSquare} label="Taverna" />
            <NavItem to={`/campaigns/${campaignId}/oracle`} icon={Sparkles} label="Oráculo" />
            <NavItem to={`/campaigns/${campaignId}/relationships`} icon={Network} label="Relações" />

            <div className="mt-3 mb-1 px-3 text-xs font-medium text-parchment/30 uppercase tracking-widest">
              Mundo
            </div>
            {WORLD_SECTIONS.map(s => (
              <NavItem key={s.path} to={`/campaigns/${campaignId}/${s.path}`} icon={s.icon} label={s.label} />
            ))}

            <div className="mt-4 mb-1 px-3 text-xs font-medium text-parchment/30 uppercase tracking-widest">
              Narrativa
            </div>
            {NARRATIVE_SECTIONS.map(s => (
              <NavItem key={s.path} to={`/campaigns/${campaignId}/${s.path}`} icon={s.icon} label={s.label} />
            ))}

            {canEdit && (
              <>
                <div className="mt-4 mb-1 px-3 text-xs font-medium text-parchment/30 uppercase tracking-widest">
                  Campanha
                </div>
                <NavItem to={`/campaigns/${campaignId}/settings`} icon={Settings} label="Configurações" />
              </>
            )}
          </>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-stone-300 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="min-w-0 flex-1 flex items-center gap-3 text-left group"
          title="Editar perfil"
        >
          <span className="w-7 h-7 rounded-full bg-gold/30 flex items-center justify-center text-gold text-xs font-bold shrink-0">
            {user?.username[0].toUpperCase()}
          </span>
          <span className="text-sm text-parchment/70 flex-1 truncate group-hover:text-gold transition-colors">{user?.username}</span>
          <Pencil size={13} className="text-parchment/25 group-hover:text-gold transition-colors shrink-0" />
        </button>
        {campaignId && canEdit && (
          <Link
            to={`/campaigns/${campaignId}/settings`}
            className="text-parchment/30 hover:text-gold transition-colors"
            title="Configurações da campanha"
          >
            <Settings size={15} />
          </Link>
        )}
        <button onClick={logout} className="text-parchment/30 hover:text-crimson transition-colors" title="Sair">
          <LogOut size={15} />
        </button>
      </div>

      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4">
          <form onSubmit={submitProfile} className="w-full max-w-sm rounded-xl border border-stone-300 bg-stone-100 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-lg text-parchment">Perfil</h2>
                <p className="text-xs text-parchment/35 mt-1">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="text-parchment/35 hover:text-parchment transition-colors"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <Input
              label="Nome de usuário"
              value={username}
              onChange={event => setUsername(event.target.value)}
              minLength={3}
              maxLength={50}
              required
              error={profileError}
            />

            <div className="flex justify-end gap-2 mt-5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setProfileOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" loading={profileSaving} disabled={username.trim() === user?.username}>
                {profileSaved ? 'Salvo' : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </aside>
  )
}
