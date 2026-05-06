import { Link, useParams, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  BookOpen, Map, Users, Sword, Bug, Scroll,
  GitBranch, Calendar, Search, Settings, ChevronLeft,
  Skull, Home, LogOut, MessageSquare, Network, Sparkles,
  BookMarked,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCampaign } from '@/hooks/useCampaign'

const WORLD_SECTIONS = [
  { label: 'Personagens',  icon: Users,    path: 'characters' },
  { label: 'NPCs',         icon: Skull,    path: 'npcs' },
  { label: 'Locais',       icon: Map,      path: 'locations' },
  { label: 'Itens',        icon: Sword,    path: 'items' },
  { label: 'Magias',       icon: BookOpen, path: 'spells' },
  { label: 'Criaturas',    icon: Bug,      path: 'creatures' },
  { label: 'Notas',        icon: Scroll,   path: 'notes' },
]

const NARRATIVE_SECTIONS = [
  { label: 'Arcos & Atos', icon: GitBranch, path: 'arcs' },
  { label: 'Sessões',      icon: Calendar,  path: 'sessions' },
  { label: 'Crônica',      icon: BookMarked, path: 'chronicle' },
]

function NavItem({ to, icon: Icon, label, exact = false }: { to: string; icon: React.ElementType; label: string; exact?: boolean }) {
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
  const { user, logout } = useAuth()
  const { data: campaign } = useCampaign(campaignId ?? '')
  const canEdit = ['admin', 'editor'].includes(campaign?.role ?? '')

  return (
    <aside className="w-60 h-screen shrink-0 bg-stone-100 border-r border-stone-300 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-stone-300">
        <Link to="/dashboard" className="font-display text-lg text-gold tracking-wide hover:text-gold-light transition-colors">
          Lorekeeper
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {/* Sem campanha selecionada */}
        {!campaignId && (
          <NavItem to="/dashboard" icon={Home} label="Campanhas" />
        )}

        {/* Com campanha selecionada */}
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

      {/* Usuário */}
      <div className="px-4 py-3 border-t border-stone-300 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-gold/30 flex items-center justify-center text-gold text-xs font-bold">
          {user?.username[0].toUpperCase()}
        </div>
        <span className="text-sm text-parchment/70 flex-1 truncate">{user?.username}</span>
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
    </aside>
  )
}
