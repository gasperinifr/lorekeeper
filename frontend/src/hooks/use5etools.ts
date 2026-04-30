import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface FiveEResult {
  total: number
  results: any[]
}

export function use5eCreatures(q: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams({ q, ...filters }).toString()
  return useQuery({
    queryKey: ['5e-creatures', q, filters],
    queryFn:  () => api.get<FiveEResult>(`/5e/creatures?${params}`),
    enabled:  q.length >= 2,
    staleTime: 1000 * 60 * 60,  // 1h — os dados raramente mudam
  })
}

export function use5eSpells(q: string, filters: Record<string, string> = {}) {
  const params = new URLSearchParams({ q, ...filters }).toString()
  return useQuery({
    queryKey: ['5e-spells', q, filters],
    queryFn:  () => api.get<FiveEResult>(`/5e/spells?${params}`),
    enabled:  q.length >= 2,
    staleTime: 1000 * 60 * 60,
  })
}

export function use5eItems(q: string) {
  return useQuery({
    queryKey: ['5e-items', q],
    queryFn:  () => api.get<FiveEResult>(`/5e/items?q=${encodeURIComponent(q)}`),
    enabled:  q.length >= 2,
    staleTime: 1000 * 60 * 60,
  })
}

export function useImport5e(campaignId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityType, entityData }: { entityType: string; entityData: any }) =>
      api.post(`/5e/import/${campaignId}`, { entityType, entityData }),
    onSuccess: (_, { entityType }) =>
      qc.invalidateQueries({ queryKey: ['entities', campaignId, entityType] }),
  })
}