import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { CampaignEvent, PropagationConsequence } from '@/types'

export function useEvents(campaignId: string) {
  return useQuery({
    queryKey: ['events', campaignId],
    queryFn:  () => api.get<CampaignEvent[]>(`/campaigns/${campaignId}/events`),
    enabled:  !!campaignId,
  })
}

export function useEventDetail(campaignId: string, eventId: string) {
  return useQuery({
    queryKey: ['event', campaignId, eventId],
    queryFn:  () => api.get<CampaignEvent>(`/campaigns/${campaignId}/events/${eventId}`),
    enabled:  !!eventId,
  })
}

export function useCreateEvent(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<CampaignEvent>(`/campaigns/${campaignId}/events`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', campaignId] })
      qc.invalidateQueries({ queryKey: ['entity', campaignId] })
      qc.invalidateQueries({ queryKey: ['arcs', campaignId] })
      qc.invalidateQueries({ queryKey: ['sessions', campaignId] })
    },
  })
}

export function useUpdateEvent(campaignId: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<CampaignEvent>(`/campaigns/${campaignId}/events/${eventId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', campaignId] })
      qc.invalidateQueries({ queryKey: ['event', campaignId, eventId] })
      qc.invalidateQueries({ queryKey: ['entity', campaignId] })
      qc.invalidateQueries({ queryKey: ['arcs', campaignId] })
      qc.invalidateQueries({ queryKey: ['sessions', campaignId] })
    },
  })
}

export function useDeleteEvent(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) =>
      api.delete<void>(`/campaigns/${campaignId}/events/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', campaignId] })
      qc.invalidateQueries({ queryKey: ['entity', campaignId] })
      qc.invalidateQueries({ queryKey: ['arcs', campaignId] })
      qc.invalidateQueries({ queryKey: ['sessions', campaignId] })
    },
  })
}

export function useAddEventLink(campaignId: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { entity_type: string; entity_id: string; role?: string }) =>
      api.post<unknown>(`/campaigns/${campaignId}/events/${eventId}/links`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', campaignId, eventId] })
      qc.invalidateQueries({ queryKey: ['events', campaignId] })
      qc.invalidateQueries({ queryKey: ['entity', campaignId] })
      qc.invalidateQueries({ queryKey: ['links', campaignId] })
    },
  })
}

export function useRemoveEventLink(campaignId: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linkId: string) =>
      api.delete<void>(`/campaigns/${campaignId}/events/${eventId}/links/${linkId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', campaignId, eventId] })
      qc.invalidateQueries({ queryKey: ['events', campaignId] })
      qc.invalidateQueries({ queryKey: ['entity', campaignId] })
      qc.invalidateQueries({ queryKey: ['links', campaignId] })
    },
  })
}

export function usePropagateEvent(campaignId: string, eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (consequences: PropagationConsequence[]) =>
      api.post<{ applied: PropagationConsequence[] }>(
        `/campaigns/${campaignId}/events/${eventId}/propagate`,
        { consequences }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities', campaignId] })
      qc.invalidateQueries({ queryKey: ['event', campaignId, eventId] })
    },
  })
}
