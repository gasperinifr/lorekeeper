import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCampaign } from '@/hooks/useCampaign'
import { useEntityDetail } from '@/hooks/useEntities'
import type { EntityType } from '@/types'

const AppLayout = lazy(() => import('@/components/layout/AppLayout').then(m => ({ default: m.AppLayout })))
const Login = lazy(() => import('@/pages/auth/Login').then(m => ({ default: m.Login })))
const Register = lazy(() => import('@/pages/auth/Register').then(m => ({ default: m.Register })))
const CampaignList = lazy(() => import('@/pages/campaigns/CampaignList').then(m => ({ default: m.CampaignList })))
const CampaignCreate = lazy(() => import('@/pages/campaigns/CampaignCreate').then(m => ({ default: m.CampaignCreate })))
const CampaignOverview = lazy(() => import('@/pages/campaigns/CampaignOverview').then(m => ({ default: m.CampaignOverview })))
const CampaignSettings = lazy(() => import('@/pages/campaigns/CampaignSettings').then(m => ({ default: m.CampaignSettings })))
const EntityListPage = lazy(() => import('@/pages/campaigns/EntityListPage').then(m => ({ default: m.EntityListPage })))
const EntityDetailPage = lazy(() => import('@/pages/campaigns/EntityDetailPage').then(m => ({ default: m.EntityDetailPage })))
const LocationsPage = lazy(() => import('@/pages/campaigns/LocationsPage').then(m => ({ default: m.LocationsPage })))
const EntityForm = lazy(() => import('@/components/entity/EntityForm').then(m => ({ default: m.EntityForm })))
const ArcsPage = lazy(() => import('@/pages/campaigns/ArcsPage').then(m => ({ default: m.ArcsPage })))
const ArcDetailPage = lazy(() => import('@/pages/campaigns/ArcDetailPage').then(m => ({ default: m.ArcDetailPage })))
const SessionsPage = lazy(() => import('@/pages/campaigns/SessionsPage').then(m => ({ default: m.SessionsPage })))
const SessionDetailPage = lazy(() => import('@/pages/campaigns/SessionDetailPage').then(m => ({ default: m.SessionDetailPage })))
const ChroniclePage = lazy(() => import('@/pages/campaigns/ChroniclePage').then(m => ({ default: m.ChroniclePage })))
const RelationshipGraphPage = lazy(() => import('@/pages/campaigns/RelationshipGraphPage').then(m => ({ default: m.RelationshipGraphPage })))
const SearchPage = lazy(() => import('@/pages/campaigns/SearchPage').then(m => ({ default: m.SearchPage })))
const TavernaPage = lazy(() => import('@/pages/campaigns/TavernaPage').then(m => ({ default: m.TavernaPage })))
const DiaryPage = lazy(() => import('@/pages/campaigns/DiaryPage').then(m => ({ default: m.DiaryPage })))
const OraclePage = lazy(() => import('@/pages/campaigns/OraclePage').then(m => ({ default: m.OraclePage })))

function RouteLoading() {
  return <div className="p-8 text-parchment/30 text-sm">Carregando...</div>
}

function routeElement(element: JSX.Element) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>
}

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
  if (isLoading) return <RouteLoading />
  if (!['admin', 'editor'].includes(campaign?.role ?? '')) {
    return <Navigate to={`/campaigns/${campaignId}`} replace />
  }
  return children
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { data: campaign, isLoading } = useCampaign(campaignId!)
  if (isLoading) return <RouteLoading />
  if (campaign?.role !== 'admin') {
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
  return <EntityFormLoader campaignId={campaignId!} type={entityType!} entityId={entityId!} />
}

function EditLocationPage() {
  const { campaignId, entityId } = useParams<{ campaignId: string; entityId: string }>()
  return <EntityFormLoader campaignId={campaignId!} type="locations" entityId={entityId!} />
}

function EntityFormLoader({ campaignId, type, entityId }: {
  campaignId: string; type: EntityType; entityId: string
}) {
  const { data, isLoading } = useEntityDetail(campaignId, type, entityId)
  if (isLoading) return <RouteLoading />
  if (!data) return <div className="p-8 text-crimson-light text-sm">Entidade nao encontrada.</div>
  return <EntityForm campaignId={campaignId} type={type} initial={data} entityId={entityId} />
}

export const router = createBrowserRouter([
  { path: '/login', element: routeElement(<Login />) },
  { path: '/register', element: routeElement(<Register />) },
  {
    element: <Protected>{routeElement(<AppLayout />)}</Protected>,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: routeElement(<CampaignList />) },
      { path: '/campaigns/new', element: routeElement(<CampaignCreate />) },

      { path: '/campaigns/:campaignId', element: routeElement(<CampaignOverview />) },
      { path: '/campaigns/:campaignId/settings', element: <RequireAdmin>{routeElement(<CampaignSettings />)}</RequireAdmin> },

      { path: '/campaigns/:campaignId/locations', element: routeElement(<LocationsPage />) },
      { path: '/campaigns/:campaignId/locations/new', element: <RequireEditor>{routeElement(<CreateLocationPage />)}</RequireEditor> },
      { path: '/campaigns/:campaignId/locations/:entityId', element: routeElement(<EntityDetailPage entityTypeOverride="locations" />) },
      { path: '/campaigns/:campaignId/locations/:entityId/edit', element: <RequireEditor>{routeElement(<EditLocationPage />)}</RequireEditor> },

      { path: '/campaigns/:campaignId/arcs', element: routeElement(<ArcsPage />) },
      { path: '/campaigns/:campaignId/arcs/:arcId', element: routeElement(<ArcDetailPage />) },
      { path: '/campaigns/:campaignId/arcs/:arcId/sessions/:sessionId', element: routeElement(<SessionDetailPage />) },
      { path: '/campaigns/:campaignId/sessions', element: routeElement(<SessionsPage />) },
      { path: '/campaigns/:campaignId/chronicle', element: routeElement(<ChroniclePage />) },
      { path: '/campaigns/:campaignId/relationships', element: routeElement(<RelationshipGraphPage />) },

      { path: '/campaigns/:campaignId/search', element: routeElement(<SearchPage />) },
      { path: '/campaigns/:campaignId/taverna', element: routeElement(<TavernaPage />) },
      { path: '/campaigns/:campaignId/diary', element: routeElement(<DiaryPage />) },
      { path: '/campaigns/:campaignId/oracle', element: routeElement(<OraclePage />) },

      { path: '/campaigns/:campaignId/:entityType', element: routeElement(<EntityListPage />) },
      { path: '/campaigns/:campaignId/:entityType/new', element: <RequireEditor>{routeElement(<CreateEntityPage />)}</RequireEditor> },
      { path: '/campaigns/:campaignId/:entityType/:entityId', element: routeElement(<EntityDetailPage />) },
      { path: '/campaigns/:campaignId/:entityType/:entityId/edit', element: <RequireEditor>{routeElement(<EditEntityPage />)}</RequireEditor> },
    ],
  },
])
