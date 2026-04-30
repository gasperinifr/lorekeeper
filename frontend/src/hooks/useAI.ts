import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'

export function useGenerateNPC(campaignId: string) {
  return useMutation({
    mutationFn: (hint: string) =>
      api.post<any>(`/campaigns/${campaignId}/ai/npc`, { hint }),
  })
}

export function useGenerateLocation(campaignId: string) {
  return useMutation({
    mutationFn: (input: string | { hint: string; parent_id?: string }) =>
      api.post<any>(
        `/campaigns/${campaignId}/ai/location`,
        typeof input === 'string' ? { hint: input } : input
      ),
  })
}

export function useSummarizeSession(campaignId: string) {
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<{ summary: string }>(`/campaigns/${campaignId}/ai/session-summary`, { sessionId }),
  })
}

export function useSuggestEncounter(campaignId: string) {
  return useMutation({
    mutationFn: (opts: { difficulty?: string; location?: string; theme?: string }) =>
      api.post<any>(`/campaigns/${campaignId}/ai/encounter`, opts),
  })
}

export function useExpandNote(campaignId: string) {
  return useMutation({
    mutationFn: (note: { title: string; content: string }) =>
      api.post<{ expanded: string }>(`/campaigns/${campaignId}/ai/expand-note`, note),
  })
}
