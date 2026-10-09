import { supabase } from '@/lib/supabase'
import type { Pitch, PitchPart, PitchSlot, SlotBooking } from './logic'

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

export async function fetchSlots(clubId: string): Promise<PitchSlot[]> {
  const { data, error } = await supabase
    .from('pitch_slots')
    .select('*')
    .eq('club_id', clubId)
    .order('weekday')
    .order('start_time')
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

/** One slot per weekday. */
export async function createSlots(input: {
  clubId: string
  pitchId: string
  weekdays: number[]
  startTime: string
  endTime: string
  validFrom: string
  validUntil: string
}): Promise<void> {
  const { error } = await supabase.from('pitch_slots').insert(
    input.weekdays.map((weekday) => ({
      club_id: input.clubId,
      pitch_id: input.pitchId,
      weekday,
      start_time: input.startTime,
      end_time: input.endTime,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
    })),
  )
  if (error) throw error
}

export async function deleteSlot(slotId: string): Promise<void> {
  const { error } = await supabase.from('pitch_slots').delete().eq('id', slotId)
  if (error) throw error
}

/** until = from books one date, until = null books every week until the end of the season. */
export async function bookSlot(input: {
  slotId: string
  teamId: string
  part: PitchPart
  from: string
  until: string | null
}): Promise<BookResult> {
  const { data, error } = await supabase.rpc('book_slot', {
    p_slot_id: input.slotId,
    p_team_id: input.teamId,
    p_part: input.part,
    p_from: input.from,
    ...(input.until ? { p_until: input.until } : {}),
  })
  if (error) throw error
  return data as BookResult
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

/** Hint the database sends with a refused request, e.g. 'slot_taken' or 'slot_overlap'. */
export function scheduleErrorHint(error: unknown): string | null {
  return (error as { hint?: string } | null)?.hint ?? null
}
