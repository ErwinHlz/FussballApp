import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRealtimeInvalidate } from '@/lib/realtime'
import { useAuthStore } from '@/stores/auth'
import { useTeamMembers } from '@/features/teams/composables/useTeams'
import {
  createEvent,
  createTrainingSeries,
  deleteEvent,
  fetchEvent,
  fetchTeamEvents,
  setAttendance,
  setMatchSquad,
  updateEvent,
  withdrawAttendance,
  type AttendanceRequest,
  type EventInput,
} from '../api'
import type { Attendance, SquadRole, TeamEvent } from '../logic'

export const eventKeys = {
  all: ['events'] as const,
  team: (teamId: string) => ['events', 'team', teamId] as const,
  detail: (eventId: string) => ['events', 'detail', eventId] as const,
}

export function useTeamEvents(teamId: MaybeRefOrGetter<string | null>) {
  const key = computed(() => eventKeys.team(toValue(teamId) ?? ''))
  const enabled = computed(() => !!toValue(teamId))

  useRealtimeInvalidate(
    [
      { table: 'events', filter: () => `team_id=eq.${toValue(teamId)}` },
      { table: 'attendances' },
      { table: 'match_squad' },
    ],
    key,
    enabled,
  )

  return useQuery({
    queryKey: key,
    queryFn: () => fetchTeamEvents(toValue(teamId)!),
    enabled,
  })
}

export function useEvent(eventId: MaybeRefOrGetter<string>) {
  const key = computed(() => eventKeys.detail(toValue(eventId)))

  // Live overview for coaches: answers and nominations update without reload.
  useRealtimeInvalidate(
    [
      { table: 'events', filter: () => `id=eq.${toValue(eventId)}` },
      { table: 'attendances', filter: () => `event_id=eq.${toValue(eventId)}` },
      { table: 'match_squad', filter: () => `event_id=eq.${toValue(eventId)}` },
    ],
    key,
  )

  return useQuery({ queryKey: key, queryFn: () => fetchEvent(toValue(eventId)) })
}

/** The current user's squad entry in the team (null for club admins who are not in the squad). */
export function useMyMember(teamId: MaybeRefOrGetter<string | null>) {
  const auth = useAuthStore()
  const members = useTeamMembers(teamId)
  const myMember = computed(
    () => members.data.value?.find((m) => m.user_id !== null && m.user_id === auth.userId) ?? null,
  )
  return { members, myMember }
}

function useInvalidateEvents() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: eventKeys.all })
}

export function useCreateEvent(teamId: MaybeRefOrGetter<string | null>) {
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: (input: EventInput) => createEvent(toValue(teamId)!, input),
    onSuccess: invalidate,
  })
}

export function useCreateSeries() {
  const invalidate = useInvalidateEvents()
  return useMutation({ mutationFn: createTrainingSeries, onSuccess: invalidate })
}

export function useUpdateEvent() {
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: ({
      eventId,
      patch,
    }: {
      eventId: string
      patch: Parameters<typeof updateEvent>[1]
    }) => updateEvent(eventId, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteEvent() {
  const invalidate = useInvalidateEvents()
  return useMutation({ mutationFn: deleteEvent, onSuccess: invalidate })
}

/** Applies an answer locally so the buttons react instantly; rolls back on error. */
function applyAttendance(event: TeamEvent, input: AttendanceRequest): TeamEvent {
  const existing = event.attendances.find((a) => a.member_id === input.memberId)
  const optimistic: Attendance = {
    id: existing?.id ?? `optimistic-${input.memberId}`,
    event_id: input.eventId,
    member_id: input.memberId,
    status: input.status,
    reason: input.status === 'no' ? (input.reason ?? null) : null,
    reason_note: input.status === 'no' ? (input.reasonNote ?? null) : null,
    updated_by: existing?.updated_by ?? null,
    // An own change turns an automatic (absence) answer into a manual one.
    source_absence_id: null,
    updated_at: new Date().toISOString(),
    created_at: existing?.created_at ?? new Date().toISOString(),
  }
  return {
    ...event,
    attendances: [...event.attendances.filter((a) => a.member_id !== input.memberId), optimistic],
  }
}

export function useSetAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setAttendance,
    // Answers are sent one after another: two quick taps must reach the server in order,
    // otherwise the earlier answer could win.
    scope: { id: 'attendance' },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: eventKeys.all })
      const snapshot = queryClient.getQueriesData<TeamEvent | TeamEvent[]>({
        queryKey: eventKeys.all,
      })
      queryClient.setQueriesData<TeamEvent | TeamEvent[]>({ queryKey: eventKeys.all }, (data) => {
        if (!data) return data
        if (Array.isArray(data)) {
          return data.map((e) => (e.id === input.eventId ? applyAttendance(e, input) : e))
        }
        return data.id === input.eventId ? applyAttendance(data, input) : data
      })
      return { snapshot }
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

/** Removes an answer again (undo of a first decline); same queue as setting answers. */
export function useWithdrawAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: withdrawAttendance,
    scope: { id: 'attendance' },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: eventKeys.all })
      const snapshot = queryClient.getQueriesData<TeamEvent | TeamEvent[]>({
        queryKey: eventKeys.all,
      })
      const without = (e: TeamEvent): TeamEvent =>
        e.id === input.eventId
          ? { ...e, attendances: e.attendances.filter((a) => a.member_id !== input.memberId) }
          : e
      queryClient.setQueriesData<TeamEvent | TeamEvent[]>({ queryKey: eventKeys.all }, (data) =>
        !data ? data : Array.isArray(data) ? data.map(without) : without(data),
      )
      return { snapshot }
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

export function useSetMatchSquad() {
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: ({
      eventId,
      entries,
    }: {
      eventId: string
      entries: { member_id: string; role: SquadRole }[]
    }) => setMatchSquad(eventId, entries),
    onSuccess: invalidate,
  })
}

/** Says yes to several dates at once; returns how many answers were saved. */
export function useAttendAll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { eventIds: string[]; memberId: string }) => {
      const results = await Promise.allSettled(
        input.eventIds.map((eventId) =>
          setAttendance({ eventId, memberId: input.memberId, status: 'yes' }),
        ),
      )
      const saved = results.filter((r) => r.status === 'fulfilled').length
      // Dates that closed in the meantime are skipped; only a total failure is an error.
      if (saved === 0 && input.eventIds.length > 0) throw new Error('no answer saved')
      return { saved, skipped: input.eventIds.length - saved }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: eventKeys.all }),
  })
}
