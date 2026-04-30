import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Arc, Session } from '@/types'

export function useArcs(campaignId: string) {
  return useQuery({
    queryKey: ['arcs', campaignId],
    queryFn:  () => api.get<Arc[]>(`/campaigns/${campaignId}/arcs`),
    enabled:  !!campaignId,
  })
}

export function useArcDetail(campaignId: string, arcId: string) {
  return useQuery({
    queryKey: ['arc', campaignId, arcId],
    queryFn:  () => api.get<Arc>(`/campaigns/${campaignId}/arcs/${arcId}`),
    enabled:  !!arcId,
  })
}

export function useCampaignSessions(campaignId: string) {
  return useQuery({
    queryKey: ['sessions', campaignId],
    queryFn:  () => api.get<(Session & { arc_title?: string })[]>(`/campaigns/${campaignId}/sessions`),
    enabled:  !!campaignId,
  })
}

export function useCreateArc(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Arc>) => api.post<Arc>(`/campaigns/${campaignId}/arcs`, body),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['arcs', campaignId] }),
  })
}

export function useCreateSession(campaignId: string, arcId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Session>) =>
      api.post<Session>(`/campaigns/${campaignId}/arcs/${arcId}/sessions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arc', campaignId, arcId] })
      qc.invalidateQueries({ queryKey: ['arcs', campaignId] })
      qc.invalidateQueries({ queryKey: ['sessions', campaignId] })
    },
  })
}

export function useUpdateArc(campaignId: string, arcId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Arc>) =>
      api.patch<Arc>(`/campaigns/${campaignId}/arcs/${arcId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arcs', campaignId] })
      qc.invalidateQueries({ queryKey: ['arc',  campaignId, arcId] })
    },
  })
}
