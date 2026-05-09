import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { EntityType } from '@/types'

export interface PropagationSuggestion {
  target_type: EntityType
  target_id: string
  target_name: string
  field: string
  value: unknown
  reason: string
}

interface SuggestParams {
  entity_type: EntityType
  entity_id: string
  name: string
  description?: string
  data?: Record<string, unknown>
}

export function useSuggestPropagations(campaignId: string) {
  return useMutation({
    mutationFn: (params: SuggestParams) =>
      api.post<{ propagations: PropagationSuggestion[] }>(
        `/campaigns/${campaignId}/ai/suggest-propagations`,
        params
      ),
  })
}

export function useApplyPropagation(campaignId: string) {
  return useMutation({
    mutationFn: (body: {
      target_type: string
      target_id: string
      field: string
      value: unknown
    }) => api.post<{ ok: boolean }>(`/campaigns/${campaignId}/ai/apply-propagation`, body),
  })
}
