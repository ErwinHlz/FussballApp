import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { eventKeys } from '@/features/events/composables/useEvents'
import {
  bookPitch,
  createPitch,
  deletePitch,
  endSlotBooking,
  fetchBookings,
  fetchClubTeamNames,
  fetchPitches,
  releaseSlotDate,
} from '../api'

export const scheduleKeys = {
  all: (clubId: string) => ['schedule', clubId] as const,
  pitches: (clubId: string) => ['schedule', clubId, 'pitches'] as const,
  bookings: (clubId: string, from: string, until: string) =>
    ['schedule', clubId, 'bookings', from, until] as const,
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
