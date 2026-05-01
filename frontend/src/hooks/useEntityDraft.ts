import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { EntityType } from '@/types'

interface DraftParams {
  entity_type: EntityType
  name: string
  hint?: string
}

export function useEntityDraft(campaignId: string) {
  const mutation = useMutation({
    mutationFn: (params: DraftParams) =>
      api.post<Record<string, any>>(`/campaigns/${campaignId}/ai/entity-draft`, params),
  })

  return {
    generate: mutation.mutateAsync,
    isPending: mutation.isPending,
  }
}
