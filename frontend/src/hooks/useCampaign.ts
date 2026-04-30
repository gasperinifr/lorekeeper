import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Campaign } from '@/types'

export function useCampaign(campaignId: string) {
  return useQuery({
    queryKey: ['campaign', campaignId],
    queryFn:  () => api.get<Campaign>(`/campaigns/${campaignId}`),
    enabled:  !!campaignId,
  })
}

export function useUpdateCampaign(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<Campaign>) =>
      api.patch<Campaign>(`/campaigns/${campaignId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', campaignId] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useInviteMember(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; role: string; play_role?: string }) =>
      api.post(`/campaigns/${campaignId}/members`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  })
}

export function useUpdateMember(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId: string; role?: string; play_role?: string }) => {
      const { userId, ...payload } = body
      return api.patch(`/campaigns/${campaignId}/members/${userId}`, payload)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  })
}

export function useCreateInvite(campaignId: string) {
  return useMutation({
    mutationFn: (body: { email?: string; role: string; play_role?: string }) =>
      api.post<{ code: string; invited_email?: string; role: string; play_role: string; expires_at: string }>(`/campaigns/${campaignId}/invites`, body),
  })
}

export function useJoinCampaignByCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { code: string }) =>
      api.post<{ campaign_id: string; title: string; role: string }>('/campaigns/join', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}
