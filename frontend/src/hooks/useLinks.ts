import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { EntityLink } from '@/types'

export function useCreateLink(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<EntityLink, 'id'>) =>
      api.post<EntityLink>(`/campaigns/${campaignId}/links`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entity', campaignId] })
      qc.invalidateQueries({ queryKey: ['arc', campaignId] })
      qc.invalidateQueries({ queryKey: ['session', campaignId] })
      qc.invalidateQueries({ queryKey: ['sessions', campaignId] })
    },
  })
}

export function useDeleteLink(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linkId: string) => api.delete(`/campaigns/${campaignId}/links/${linkId}`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['entity', campaignId] })
      qc.invalidateQueries({ queryKey: ['arc', campaignId] })
      qc.invalidateQueries({ queryKey: ['session', campaignId] })
      qc.invalidateQueries({ queryKey: ['sessions', campaignId] })
    },
  })
}
