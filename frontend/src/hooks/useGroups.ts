import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Group } from '@/types'

export function useGroups(campaignId: string) {
  return useQuery({
    queryKey: ['entities', campaignId, 'groups'],
    queryFn:  () => api.get<Group[]>(`/campaigns/${campaignId}/groups`),
    enabled:  !!campaignId,
  })
}

export function useGroupDetail(campaignId: string, groupId: string) {
  return useQuery({
    queryKey: ['entity', campaignId, 'groups', groupId],
    queryFn:  () => api.get<Group>(`/campaigns/${campaignId}/groups/${groupId}`),
    enabled:  !!groupId,
  })
}

export function useAddGroupMember(campaignId: string, groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { npc_id?: string; character_id?: string; role?: string; is_secret?: boolean }) =>
      api.post<unknown>(`/campaigns/${campaignId}/groups/${groupId}/members`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entity', campaignId, 'groups', groupId] })
      qc.invalidateQueries({ queryKey: ['entities', campaignId, 'groups'] })
    },
  })
}

export function useRemoveGroupMember(campaignId: string, groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) =>
      api.delete<void>(`/campaigns/${campaignId}/groups/${groupId}/members/${memberId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entity', campaignId, 'groups', groupId] })
      qc.invalidateQueries({ queryKey: ['entities', campaignId, 'groups'] })
    },
  })
}
