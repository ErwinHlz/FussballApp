import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/stores/auth'
import { eventKeys } from '@/features/events/composables/useEvents'
import { createAbsences, deleteAbsence, fetchMyAbsences, fetchTeamAbsences } from '../api'

export const absenceKeys = {
  all: ['absences'] as const,
  team: (teamId: string) => ['absences', 'team', teamId] as const,
  mine: (userId: string) => ['absences', 'mine', userId] as const,
}

export function useTeamAbsences(teamId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => absenceKeys.team(toValue(teamId) ?? '')),
    queryFn: () => fetchTeamAbsences(toValue(teamId)!),
    enabled: computed(() => !!toValue(teamId)),
  })
}

export function useMyAbsences() {
  const auth = useAuthStore()
  return useQuery({
    queryKey: computed(() => absenceKeys.mine(auth.userId ?? '')),
    queryFn: () => fetchMyAbsences(auth.userId!),
    enabled: computed(() => !!auth.userId),
  })
}

/** Absences change answers, so events are refreshed too. */
function useInvalidate() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: absenceKeys.all }),
      queryClient.invalidateQueries({ queryKey: eventKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
    ])
}

export function useCreateAbsences() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: createAbsences, onSuccess: invalidate })
}

export function useDeleteAbsence() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: deleteAbsence, onSuccess: invalidate })
}
