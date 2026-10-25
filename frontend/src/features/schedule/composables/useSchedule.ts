import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { format } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { eventKeys } from '@/features/events/composables/useEvents'
import {
  attachEventsToPitch,
  bookPitch,
  createPitch,
  deletePitch,
  endSlotBooking,
  fetchBooking,
  fetchBookings,
  fetchClubTeamNames,
  fetchPitches,
  fetchPitchMatches,
  releaseSlotDate,
} from '../api'
import { matchesOn, overlaps, type PitchMatch } from '../logic'

export const scheduleKeys = {
  all: (clubId: string) => ['schedule', clubId] as const,
  pitches: (clubId: string) => ['schedule', clubId, 'pitches'] as const,
  bookings: (clubId: string, from: string, until: string) =>
    ['schedule', clubId, 'bookings', from, until] as const,
  matches: (clubId: string, from: string, until: string) =>
    ['schedule', clubId, 'matches', from, until] as const,
  teamNames: (clubId: string) => ['schedule', clubId, 'team-names'] as const,
}

export function usePitches(clubId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => scheduleKeys.pitches(toValue(clubId))),
    queryFn: () => fetchPitches(toValue(clubId)),
    enabled: computed(() => !!toValue(clubId)),
  })
}

export function useBookings(
  clubId: MaybeRefOrGetter<string>,
  from: MaybeRefOrGetter<string>,
  until: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: computed(() => scheduleKeys.bookings(toValue(clubId), toValue(from), toValue(until))),
    queryFn: () => fetchBookings(toValue(clubId), toValue(from), toValue(until)),
    enabled: computed(() => !!toValue(clubId)),
  })
}

export function usePitchMatches(
  clubId: MaybeRefOrGetter<string>,
  from: MaybeRefOrGetter<string>,
  until: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: computed(() => scheduleKeys.matches(toValue(clubId), toValue(from), toValue(until))),
    queryFn: () => fetchPitchMatches(toValue(clubId), toValue(from), toValue(until)),
    enabled: computed(() => !!toValue(clubId)),
  })
}

/**
 * Home matches that overlap a booked training on its part of the pitch (warning for the coach).
 * Only for trainings in the schedule; empty otherwise.
 */
export function useTrainingMatchConflicts(
  clubId: MaybeRefOrGetter<string>,
  training: MaybeRefOrGetter<{
    booking_id: string | null
    starts_at: string
    ends_at: string | null
  } | null>,
) {
  const bookingId = computed(() => toValue(training)?.booking_id ?? null)
  const date = computed(() => {
    const event = toValue(training)
    return event ? format(new Date(event.starts_at), 'yyyy-MM-dd') : ''
  })
  const booking = useQuery({
    queryKey: computed(() => [...scheduleKeys.all(toValue(clubId)), 'booking', bookingId.value]),
    queryFn: () => fetchBooking(bookingId.value!),
    enabled: computed(() => !!bookingId.value && !!toValue(clubId)),
  })
  const matches = useQuery({
    queryKey: computed(() => scheduleKeys.matches(toValue(clubId), date.value, date.value)),
    queryFn: () => fetchPitchMatches(toValue(clubId), date.value, date.value),
    enabled: computed(() => !!bookingId.value && !!toValue(clubId) && !!date.value),
  })
  return computed<PitchMatch[]>(() => {
    const b = booking.data.value
    if (!b || !date.value) return []
    return matchesOn(matches.data.value ?? [], b.pitch_id, date.value)
      .filter((m) => overlaps(m, b))
      .map((m) => m.match)
  })
}

export function useClubTeamNames(clubId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => scheduleKeys.teamNames(toValue(clubId))),
    queryFn: () => fetchClubTeamNames(toValue(clubId)),
    enabled: computed(() => !!toValue(clubId)),
    staleTime: 5 * 60_000,
  })
}

/** Mutations of the schedule refresh the whole plan; bookings also change team events. */
function useScheduleMutation<TInput, TResult>(
  clubId: MaybeRefOrGetter<string>,
  mutationFn: (input: TInput) => Promise<TResult>,
  touchesEvents = false,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all(toValue(clubId)) })
      if (touchesEvents) await queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

export const useCreatePitch = (clubId: MaybeRefOrGetter<string>) =>
  useScheduleMutation(clubId, createPitch)
export const useDeletePitch = (clubId: MaybeRefOrGetter<string>) =>
  useScheduleMutation(clubId, deletePitch, true)
export const useBookPitch = (clubId: MaybeRefOrGetter<string>) =>
  useScheduleMutation(clubId, bookPitch, true)
export const useReleaseSlotDate = (clubId: MaybeRefOrGetter<string>) =>
  useScheduleMutation(clubId, releaseSlotDate, true)
export const useEndSlotBooking = (clubId: MaybeRefOrGetter<string>) =>
  useScheduleMutation(clubId, endSlotBooking, true)
export const useAttachEvents = (clubId: MaybeRefOrGetter<string>) =>
  useScheduleMutation(clubId, attachEventsToPitch, true)
