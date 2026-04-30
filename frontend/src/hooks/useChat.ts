import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { ChatMention, ChatMessage } from '@/types'

export function useChatMessages(campaignId: string) {
  return useQuery({
    queryKey: ['chat-messages', campaignId],
    queryFn: () => api.get<ChatMessage[]>(`/campaigns/${campaignId}/chat/messages`),
    enabled: !!campaignId,
    refetchInterval: 5000,
  })
}

export function useCreateChatMessage(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { content?: string; image_url?: string; mentions?: ChatMention[] }) =>
      api.post<ChatMessage>(`/campaigns/${campaignId}/chat/messages`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-messages', campaignId] }),
  })
}

export function useDeleteChatMessage(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) => api.delete(`/campaigns/${campaignId}/chat/messages/${messageId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-messages', campaignId] }),
  })
}
