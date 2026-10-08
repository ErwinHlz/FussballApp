import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRealtimeInvalidate } from '@/lib/realtime'
import { eventKeys } from '@/features/events/composables/useEvents'
import {
  addPlanDrill,
  copyPlan,
  fetchPlan,
  fetchPlannedTrainings,
  fetchUpcomingTrainings,
  removePlanItem,
  reorderPlan,
  setPlanStatus,
  updatePlanItem,
} from '../api'
import type { PlanItem } from '../logic'

export const planKeys = {
  all: ['plans'] as const,
  plan: (eventId: string) => ['plans', 'event', eventId] as const,
  trainings: (teamId: string) => ['plans', 'trainings', teamId] as const,
  planned: (teamId: string) => ['plans', 'planned', teamId] as const,
}

export function usePlan(
  eventId: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const key = computed(() => planKeys.plan(toValue(eventId)))
  // Co-coaches editing at the same time see each other's changes.
  useRealtimeInvalidate(
    [{ table: 'event_drills', filter: () => `event_id=eq.${toValue(eventId)}` }],
    key,
    enabled,
  )
  return useQuery({
    queryKey: key,
    queryFn: () => fetchPlan(toValue(eventId)),
    enabled: computed(() => toValue(enabled)),
  })
}

export function useUpcomingTrainings(teamId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => planKeys.trainings(toValue(teamId) ?? '')),
    queryFn: () => fetchUpcomingTrainings(toValue(teamId)!),
    enabled: computed(() => !!toValue(teamId)),
  })
}

export function usePlannedTrainings(
  teamId: MaybeRefOrGetter<string | null>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery({
    queryKey: computed(() => planKeys.planned(toValue(teamId) ?? '')),
    queryFn: () => fetchPlannedTrainings(toValue(teamId)!),
    enabled: computed(() => !!toValue(teamId) && toValue(enabled)),
  })
}

function useInvalidatePlans() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: planKeys.all }),
      queryClient.invalidateQueries({ queryKey: eventKeys.all }),
    ])
}

export function useAddPlanDrill() {
  const invalidate = useInvalidatePlans()
  return useMutation({ mutationFn: addPlanDrill, onSuccess: invalidate })
}

export function useUpdatePlanItem() {
  const invalidate = useInvalidatePlans()
  return useMutation({
    mutationFn: ({
      itemId,
      patch,
    }: {
      itemId: string
      patch: Parameters<typeof updatePlanItem>[1]
    }) => updatePlanItem(itemId, patch),
    onSuccess: invalidate,
  })
}

export function useRemovePlanItem() {
  const invalidate = useInvalidatePlans()
  return useMutation({ mutationFn: removePlanItem, onSuccess: invalidate })
}

/** Reorders optimistically so dragging feels instant. */
export function useReorderPlan(eventId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const key = () => planKeys.plan(toValue(eventId))
  return useMutation({
    mutationFn: (items: PlanItem[]) =>
      reorderPlan(
        toValue(eventId),
        items.map((i) => i.id),
      ),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: key() })
      const previous = queryClient.getQueryData<PlanItem[]>(key())
      queryClient.setQueryData<PlanItem[]>(
        key(),
        items.map((item, index) => ({ ...item, position: index + 1 })),
      )
      return { previous }
    },
    onError: (_e, _items, context) => queryClient.setQueryData(key(), context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key() }),
  })
}

export function useCopyPlan() {
  const invalidate = useInvalidatePlans()
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      copyPlan(sourceId, targetId),
    onSuccess: invalidate,
  })
}

export function useSetPlanStatus() {
  const invalidate = useInvalidatePlans()
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: 'draft' | 'published' }) =>
      setPlanStatus(eventId, status),
    onSuccess: invalidate,
  })
}
