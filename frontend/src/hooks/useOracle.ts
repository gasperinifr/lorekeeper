import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { OracleMessage, OracleMode } from '@/types'

export function useOracleHistory(campaignId: string, mode: OracleMode) {
  return useQuery({
    queryKey: ['oracle-messages', campaignId, mode],
    queryFn: () => api.get<{ mode: OracleMode; messages: OracleMessage[] }>(`/campaigns/${campaignId}/ai/oracle?mode=${mode}`),
    enabled: !!campaignId,
  })
}

export function useSendOracleMessage(campaignId: string, mode: OracleMode) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (message: string) =>
      api.post<{ mode: OracleMode; answer: string; messages: OracleMessage[] }>(`/campaigns/${campaignId}/ai/oracle`, { message, mode }),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['oracle-messages', campaignId, data.mode] })
    },
  })
}

export function useClearOracleHistory(campaignId: string, mode: OracleMode) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`/campaigns/${campaignId}/ai/oracle?mode=${mode}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['oracle-messages', campaignId, mode] }),
  })
}
