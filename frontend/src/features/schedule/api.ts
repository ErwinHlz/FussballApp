import { supabase } from '@/lib/supabase'
import type { Pitch, PitchMatch, PitchPart, SlotBooking } from './logic'

export type ClubTeamName = { id: string; name: string }
export type BookResult = { booking_id: string; booked: number; skipped: number }

export async function fetchPitches(clubId: string): Promise<Pitch[]> {
  const { data, error } = await supabase
    .from('pitches')
    .select('*')
    .eq('club_id', clubId)
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data
}

/** Bookings that touch the date range, with their released dates. */
export async function fetchBookings(
  clubId: string,
  from: string,
  until: string,
): Promise<SlotBooking[]> {
  const { data, error } = await supabase
    .from('slot_bookings')
    .select('*, exceptions:slot_booking_exceptions(date)')
    .eq('club_id', clubId)
    .lte('valid_from', until)
    .gte('valid_until', from)
  if (error) throw error
  return data
}

/** One booking (pitch, part and times of a booked training). */
export async function fetchBooking(bookingId: string): Promise<SlotBooking> {
  const { data, error } = await supabase
    .from('slot_bookings')
    .select('*, exceptions:slot_booking_exceptions(date)')
    .eq('id', bookingId)
    .single()
  if (error) throw error
  return data
}

/** Home matches on the club's pitches with the kick-off between the dates (also other teams). */
export async function fetchPitchMatches(
  clubId: string,
  from: string,
  until: string,
): Promise<PitchMatch[]> {
  const { data, error } = await supabase.rpc('club_pitch_matches', {
    p_club_id: clubId,
    p_from: from,
    p_until: until,
  })
  if (error) throw error
  return data
}

export async function fetchClubTeamNames(clubId: string): Promise<ClubTeamName[]> {
  const { data, error } = await supabase.rpc('club_team_names', { p_club_id: clubId })
  if (error) throw error
  return data
}

export async function createPitch(input: {
  clubId: string
  name: string
  splittable: boolean
}): Promise<void> {
  const { error } = await supabase
    .from('pitches')
    .insert({ club_id: input.clubId, name: input.name.trim(), splittable: input.splittable })
  if (error) throw error
}

export async function deletePitch(pitchId: string): Promise<void> {
  const { error } = await supabase.from('pitches').delete().eq('id', pitchId)
  if (error) throw error
}

/**
 * Books the part of the pitch from start to end on the weekday of `from`: until = from books
 * one date, until = null every week until the end of the season.
 */
export async function bookPitch(input: {
  pitchId: string
  teamId: string
  part: PitchPart
  start: string
  end: string
  from: string
  until: string | null
  /** Response deadline of the created trainings, hours before the start. */
  deadlineHours?: number | null
}): Promise<BookResult> {
  const { data, error } = await supabase.rpc('book_pitch', {
    p_pitch_id: input.pitchId,
    p_team_id: input.teamId,
    p_part: input.part,
    p_start: input.start,
    p_end: input.end,
    p_from: input.from,
    ...(input.until ? { p_until: input.until } : {}),
    ...(input.deadlineHours != null ? { p_deadline_hours: input.deadlineHours } : {}),
  })
  if (error) throw error
  return data as BookResult
}

/** Enters a training created without the schedule (or all upcoming ones of its series). */
export async function attachEventsToPitch(input: {
  eventId: string
  pitchId: string
  part: PitchPart
  wholeSeries: boolean
}): Promise<BookResult> {
  const { data, error } = await supabase.rpc('attach_events_to_pitch', {
    p_event_id: input.eventId,
    p_pitch_id: input.pitchId,
    p_part: input.part,
    p_whole_series: input.wholeSeries,
  })
  if (error) throw error
  return data as BookResult
}

/** The first training a booking created (to open it after booking from the event form). */
export async function firstEventOfBooking(bookingId: string): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('booking_id', bookingId)
    .order('starts_at')
    .limit(1)
    .single()
  if (error) throw error
  return data.id
}

export async function releaseSlotDate(input: { bookingId: string; date: string }): Promise<void> {
  const { error } = await supabase.rpc('release_slot_date', {
    p_booking_id: input.bookingId,
    p_date: input.date,
  })
  if (error) throw error
}

export async function endSlotBooking(input: { bookingId: string; from: string }): Promise<void> {
  const { error } = await supabase.rpc('end_slot_booking', {
    p_booking_id: input.bookingId,
    p_from: input.from,
  })
  if (error) throw error
}

/** Hint the database sends with a refused request, e.g. 'slot_taken' or 'not_bookable'. */
export function scheduleErrorHint(error: unknown): string | null {
  return (error as { hint?: string } | null)?.hint ?? null
}
