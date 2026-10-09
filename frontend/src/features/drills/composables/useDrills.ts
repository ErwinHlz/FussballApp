import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  copyDrill,
  createDrill,
  deleteDrill,
  fetchDrill,
  fetchDrills,
  updateDrill,
  updateDrillAnimation,
  type DrillInput,
} from '../api'
import type { Json } from '@/types/database'

export const drillKeys = {
  all: ['drills'] as const,
  list: (teamId: string) => ['drills', 'list', teamId] as const,
  detail: (drillId: string) => ['drills', 'detail', drillId] as const,
}

export function useDrills(teamId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => drillKeys.list(toValue(teamId) ?? '')),
    queryFn: () => fetchDrills(toValue(teamId)!),
    enabled: computed(() => !!toValue(teamId)),
    // The library rarely changes.
    staleTime: 5 * 60_000,
  })
}

export function useDrill(drillId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => drillKeys.detail(toValue(drillId))),
    queryFn: () => fetchDrill(toValue(drillId)),
  })
}

function useInvalidateDrills() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: drillKeys.all })
}

export function useCreateDrill(teamId: MaybeRefOrGetter<string | null>) {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: (input: DrillInput) => createDrill(toValue(teamId)!, input),
    onSuccess: invalidate,
  })
}

export function useUpdateDrill() {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: ({ drillId, input }: { drillId: string; input: DrillInput }) =>
      updateDrill(drillId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteDrill() {
  const invalidate = useInvalidateDrills()
  return useMutation({ mutationFn: deleteDrill, onSuccess: invalidate })
}

export function useCopyDrill() {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: ({ drillId, teamId }: { drillId: string; teamId: string }) =>
      copyDrill(drillId, teamId),
    onSuccess: invalidate,
  })
}

export function useSaveDrillAnimation() {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: ({ drillId, animation }: { drillId: string; animation: Json | null }) =>
      updateDrillAnimation(drillId, animation),
    onSuccess: invalidate,
  })
}
