import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRealtimeInvalidate } from '@/lib/realtime'
import { fetchEventGroups, saveDrillGroups } from '../api'
import type { DraftGroup } from '../logic'

export const groupKeys = {
  all: ['groups'] as const,
  event: (eventId: string) => ['groups', 'event', eventId] as const,
}

export function useEventGroups(
  eventId: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const key = computed(() => groupKeys.event(toValue(eventId)))
  // Groups have no event_id column; any change re-fetches (RLS limits what arrives).
  useRealtimeInvalidate([{ table: 'drill_groups' }, { table: 'group_assignments' }], key, enabled)
  return useQuery({
    queryKey: key,
    queryFn: () => fetchEventGroups(toValue(eventId)),
    enabled: computed(() => toValue(enabled)),
  })
}

export function useSaveDrillGroups(eventId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ eventDrillId, groups }: { eventDrillId: string; groups: DraftGroup[] }) =>
      saveDrillGroups(eventDrillId, groups),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.event(toValue(eventId)) }),
  })
}
