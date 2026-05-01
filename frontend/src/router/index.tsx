import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { useAuth }            from '@/contexts/AuthContext'
import { AppLayout }          from '@/components/layout/AppLayout'
import { Login }              from '@/pages/auth/Login'
import { Register }           from '@/pages/auth/Register'
import { CampaignList }       from '@/pages/campaigns/CampaignList'
import { CampaignCreate }     from '@/pages/campaigns/CampaignCreate'
import { CampaignOverview }   from '@/pages/campaigns/CampaignOverview'
import { CampaignSettings }   from '@/pages/campaigns/CampaignSettings'
import { EntityListPage }     from '@/pages/campaigns/EntityListPage'
import { EntityDetailPage }   from '@/pages/campaigns/EntityDetailPage'
import { LocationsPage }      from '@/pages/campaigns/LocationsPage'
import { EntityForm }         from '@/components/entity/EntityForm'
import { ArcsPage }           from '@/pages/campaigns/ArcsPage'
import { ArcDetailPage }      from '@/pages/campaigns/ArcDetailPage'
import { SessionsPage }       from '@/pages/campaigns/SessionsPage'
import { SessionDetailPage }  from '@/pages/campaigns/SessionDetailPage'
import { ChroniclePage }      from '@/pages/campaigns/ChroniclePage'
import { RelationshipGraphPage } from '@/pages/campaigns/RelationshipGraphPage'
import { SearchPage }         from '@/pages/campaigns/SearchPage'
import { TavernaPage }        from '@/pages/campaigns/TavernaPage'
import { OraclePage }         from '@/pages/campaigns/OraclePage'
import { useCampaign }        from '@/hooks/useCampaign'
import { useEntityDetail }    from '@/hooks/useEntities'
import type { EntityType }    from '@/types'  

function Protected({ children }: { children: JSX.Element }) {
  const { token, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-parchment/40 text-sm">
      Carregando...
    </div>
  )
  return token ? children : <Navigate to="/login" replace />
}

function CreateEntityPage() {
  const { campaignId, entityType } = useParams<{ campaignId: string; entityType: EntityType }>()
  return <EntityForm campaignId={campaignId!} type={entityType!} />
}

function RequireEditor({ children }: { children: JSX.Element }) {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { data: campaign, isLoading } = useCampaign(campaignId!)
  if (isLoading) return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>
  if (!['admin', 'editor'].includes(campaign?.role ?? '')) {
    return <Navigate to={`/campaigns/${campaignId}`} replace />
  }
  return children
}

function CreateLocationPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  return <EntityForm campaignId={campaignId!} type="locations" />
}

function EditEntityPage() {
  const { campaignId, entityType, entityId } = useParams<{
    campaignId: string; entityType: EntityType; entityId: string
  }>()
  // Carrega dados iniciais via hook dentro do EntityForm não é prático,
  // então fazemos um pequeno wrapper que busca antes de renderizar
  return <EntityFormLoader campaignId={campaignId!} type={entityType!} entityId={entityId!} />
}

function EditLocationPage() {
  const { campaignId, entityId } = useParams<{ campaignId: string; entityId: string }>()
  return <EntityFormLoader campaignId={campaignId!} type="locations" entityId={entityId!} />
}

function EntityFormLoader({ campaignId, type, entityId }: {
  campaignId: string; type: EntityType; entityId: string
}) {
  // useEntityDetail está disponível via hook — importamos inline para manter o router limpo
  const { data, isLoading } = useEntityDetail(campaignId, type, entityId)
  if (isLoading) return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>
  if (!data) return <div className="p-8 text-crimson-light text-sm">Entidade não encontrada.</div>
  return <EntityForm campaignId={campaignId} type={type} initial={data} entityId={entityId} />
}

export const router = createBrowserRouter([
  { path: '/login',    element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    element: <Protected><AppLayout /></Protected>,
    children: [
      { path: '/',              element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard',     element: <CampaignList /> },
      { path: '/campaigns/new', element: <CampaignCreate /> },

      // Overview e settings da campanha
      { path: '/campaigns/:campaignId',          element: <CampaignOverview /> },
      { path: '/campaigns/:campaignId/settings', element: <RequireEditor><CampaignSettings /></RequireEditor> },

      // Locais com página própria (tree view)
      { path: '/campaigns/:campaignId/locations',           element: <LocationsPage /> },
      { path: '/campaigns/:campaignId/locations/new',       element: <RequireEditor><CreateLocationPage /></RequireEditor> },
      { path: '/campaigns/:campaignId/locations/:entityId', element: <EntityDetailPage entityTypeOverride="locations" /> },
      { path: '/campaigns/:campaignId/locations/:entityId/edit', element: <RequireEditor><EditLocationPage /></RequireEditor> },

      // Narrativa
      { path: '/campaigns/:campaignId/arcs',                                        element: <ArcsPage /> },
      { path: '/campaigns/:campaignId/arcs/:arcId',                                 element: <ArcDetailPage /> },
      { path: '/campaigns/:campaignId/arcs/:arcId/sessions/:sessionId',             element: <SessionDetailPage /> },
      { path: '/campaigns/:campaignId/sessions',                                    element: <SessionsPage /> },
      { path: '/campaigns/:campaignId/chronicle',                                   element: <ChroniclePage /> },
      { path: '/campaigns/:campaignId/relationships',                               element: <RelationshipGraphPage /> },

      // Entidades genéricas
      { path: '/campaigns/:campaignId/:entityType',               element: <EntityListPage /> },
      { path: '/campaigns/:campaignId/:entityType/new',           element: <RequireEditor><CreateEntityPage /></RequireEditor> },
      { path: '/campaigns/:campaignId/:entityType/:entityId',     element: <EntityDetailPage /> },
      { path: '/campaigns/:campaignId/:entityType/:entityId/edit',element: <RequireEditor><EditEntityPage /></RequireEditor> },

      // Busca
      { path: '/campaigns/:campaignId/search', element: <SearchPage /> },
      { path: '/campaigns/:campaignId/taverna', element: <TavernaPage /> },
      { path: '/campaigns/:campaignId/oracle', element: <OraclePage /> },
    ],
  },
])
