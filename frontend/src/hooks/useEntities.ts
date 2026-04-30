import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { EntityType } from '@/types'

export function useEntityList(campaignId: string, type: EntityType, enabled = true) {
  return useQuery({
    queryKey: ['entities', campaignId, type],
    queryFn:  () => api.get<any[]>(`/campaigns/${campaignId}/${type}`),
    enabled:  !!campaignId && enabled,
  })
}

export function useEntityDetail(campaignId: string, type: EntityType, id: string) {
  return useQuery({
    queryKey: ['entity', campaignId, type, id],
    queryFn:  () => api.get<any>(`/campaigns/${campaignId}/${type}/${id}`),
    enabled:  !!id,
  })
}

export function useCreateEntity(campaignId: string, type: EntityType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<any>(`/campaigns/${campaignId}/${type}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities', campaignId, type] })
      if (type === 'locations') qc.invalidateQueries({ queryKey: ['locations-tree', campaignId] })
    },
  })
}

export function useUpdateEntity(campaignId: string, type: EntityType, id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<any>(`/campaigns/${campaignId}/${type}/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities', campaignId, type] })
      qc.invalidateQueries({ queryKey: ['entity',   campaignId, type, id] })
      if (type === 'locations') qc.invalidateQueries({ queryKey: ['locations-tree', campaignId] })
    },
  })
}

export function useDeleteEntity(campaignId: string, type: EntityType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${campaignId}/${type}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entities', campaignId, type] })
      if (type === 'locations') qc.invalidateQueries({ queryKey: ['locations-tree', campaignId] })
    },
  })
}
