import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Session } from '@/types'

export function useSessionDetail(campaignId: string, arcId: string, sessionId: string) {
  return useQuery({
    queryKey: ['session', campaignId, arcId, sessionId],
    queryFn:  () => api.get<any>(`/campaigns/${campaignId}/arcs/${arcId}/sessions/${sessionId}`),
    enabled:  !!sessionId,
  })
}

export function useUpdateSession(campaignId: string, arcId: string, sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Session>) =>
      api.patch<Session>(`/campaigns/${campaignId}/arcs/${arcId}/sessions/${sessionId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session',  campaignId, arcId, sessionId] })
      qc.invalidateQueries({ queryKey: ['arc',      campaignId, arcId] })
    },
  })
}

export function useCreateEncounter(campaignId: string, arcId: string, sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; description?: string; difficulty?: string; visibility?: string }) =>
      api.post(`/campaigns/${campaignId}/arcs/${arcId}/sessions/${sessionId}/encounters`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['session', campaignId, arcId, sessionId] }),
  })
}

export function useUpdateEncounter(campaignId: string, arcId: string, sessionId: string, encId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/campaigns/${campaignId}/arcs/${arcId}/sessions/${sessionId}/encounters/${encId}`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['session', campaignId, arcId, sessionId] }),
  })
}
