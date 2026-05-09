import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { ChatMention, DiaryChannel, DiaryMessage, DiaryPlayer } from '@/types'

export function useDiaryMessages(campaignId: string, channel: DiaryChannel, playerId?: string) {
  const params = new URLSearchParams({ channel })
  if (channel === 'private' && playerId) params.set('player_id', playerId)

  return useQuery({
    queryKey: ['diary-messages', campaignId, channel, playerId ?? 'self'],
    queryFn: () => api.get<DiaryMessage[]>(`/campaigns/${campaignId}/diary/messages?${params}`),
    enabled: !!campaignId,
  })
}

export function useDiaryPlayers(campaignId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['diary-players', campaignId],
    queryFn: () => api.get<DiaryPlayer[]>(`/campaigns/${campaignId}/diary/players`),
    enabled: !!campaignId && enabled,
  })
}

export function useCreateDiaryMessage(campaignId: string, channel: DiaryChannel, playerId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { content?: string; image_url?: string; mentions?: ChatMention[]; channel: DiaryChannel; player_id?: string }) =>
      api.post<DiaryMessage>(`/campaigns/${campaignId}/diary/messages`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary-messages', campaignId, channel, playerId ?? 'self'] })
    },
  })
}

export function useUpdateDiaryMessage(campaignId: string, channel: DiaryChannel, playerId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch<DiaryMessage>(`/campaigns/${campaignId}/diary/messages/${messageId}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary-messages', campaignId, channel, playerId ?? 'self'] })
    },
  })
}

export function useDeleteDiaryMessage(campaignId: string, channel: DiaryChannel, playerId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) =>
      api.delete<void>(`/campaigns/${campaignId}/diary/messages/${messageId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary-messages', campaignId, channel, playerId ?? 'self'] })
    },
  })
}
