import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { EntityType, RelationType } from '@/types'

export interface LinkSuggestion {
  target_id: string
  target_type: EntityType
  target_name?: string
  relation_type: RelationType
  relation_label?: string
  confidence?: number
}

interface SuggestParams {
  entity_type: EntityType
  entity_id: string
  name: string
  description?: string
  data?: Record<string, unknown>
}

export function useSuggestLinks(campaignId: string) {
  const mutation = useMutation({
    mutationFn: (params: SuggestParams) =>
      api.post<{ suggestions: LinkSuggestion[] }>(`/campaigns/${campaignId}/ai/suggest-links`, params),
  })

  return {
    suggest: async (params: SuggestParams) => {
      const result = await mutation.mutateAsync(params)
      return result.suggestions ?? []
    },
    isPending: mutation.isPending,
  }
}
