import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import type { Database, Tables } from '@/types/database'

export type PitchPart = Database['public']['Enums']['pitch_part']
export type Pitch = Tables<'pitches'>
export type PitchSlot = Tables<'pitch_slots'>
export type SlotBooking = Tables<'slot_bookings'> & { exceptions: { date: string }[] }

/** A bookable or booked piece of a slot on one date. */
export type SlotCell = { part: PitchPart; booking: SlotBooking | null }

/** Dates are local calendar days as 'yyyy-MM-dd' (the club's wall-clock dates). */
export function isoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/** Monday to Sunday of the week that contains the date. */
export function weekDates(date: Date): string[] {
  const monday = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)))
}

export function weekdayOf(date: string): number {
  return parseISO(date).getDay()
}

/** Slots that take place on the date, by start time. */
export function slotsOn(slots: PitchSlot[], date: string): PitchSlot[] {
  const weekday = weekdayOf(date)
  return slots
    .filter((s) => s.weekday === weekday && s.valid_from <= date && date <= s.valid_until)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
}

/** True if the booking occupies its slot on the date. */
export function bookingCovers(booking: SlotBooking, date: string): boolean {
  return (
    booking.valid_from <= date &&
    date <= booking.valid_until &&
    !booking.exceptions.some((x) => x.date === date)
  )
}

/**
 * How a slot is shown on a date: the whole pitch (booked as a whole, not splittable, or still
 * completely free on a splittable pitch is shown as two free halves) or halves A and B.
 */
export function slotCells(
  slot: PitchSlot,
  pitch: Pick<Pitch, 'splittable'>,
  bookings: SlotBooking[],
  date: string,
): SlotCell[] {
  const active = bookings.filter((b) => b.slot_id === slot.id && bookingCovers(b, date))
  const full = active.find((b) => b.part === 'full')
  if (full || !pitch.splittable) return [{ part: 'full', booking: full ?? null }]
  return (['a', 'b'] as const).map((part) => ({
    part,
    booking: active.find((b) => b.part === part) ?? null,
  }))
}

/** Parts that can still be booked on the date (the whole pitch only if both halves are free). */
export function freeParts(cells: SlotCell[], splittable: boolean): PitchPart[] {
  if (cells.length === 1) return cells[0]!.booking ? [] : ['full']
  const free = cells.filter((c) => !c.booking).map((c) => c.part)
  return splittable && free.length === 2 ? ['full', ...free] : free
}

/** True if the slot has already started (its date and start time lie in the past). */
export function slotStarted(slot: Pick<PitchSlot, 'start_time'>, date: string, now = new Date()) {
  return parseISO(`${date}T${slot.start_time}`) <= now
}

/** Default season for new slots: today until the next 30 June. */
export function defaultSeason(today = new Date()): { from: string; until: string } {
  const year = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear()
  return { from: isoDate(today), until: `${year}-06-30` }
}

export function timeLabel(time: string): string {
  return time.slice(0, 5)
}

/** Minutes since midnight of a 'HH:mm[:ss]' time. */
export function minutesOf(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Hours the week calendar shows: from the earliest start to the latest end of the slots on the
 * dates (whole hours), at least the fallback range when nothing takes place.
 */
export function calendarHours(
  slots: PitchSlot[],
  dates: string[],
  fallback: [number, number] = [16, 21],
): { from: number; to: number } {
  const week = dates.flatMap((date) => slotsOn(slots, date))
  if (!week.length) return { from: fallback[0], to: fallback[1] }
  const from = Math.floor(Math.min(...week.map((s) => minutesOf(s.start_time))) / 60)
  const to = Math.ceil(Math.max(...week.map((s) => minutesOf(s.end_time))) / 60)
  return { from, to: Math.max(to, from + 1) }
}

/** Top offset and height of a slot in the calendar, in hours from the first shown hour. */
export function slotBox(slot: Pick<PitchSlot, 'start_time' | 'end_time'>, fromHour: number) {
  const start = minutesOf(slot.start_time)
  return {
    top: (start - fromHour * 60) / 60,
    height: (minutesOf(slot.end_time) - start) / 60,
  }
}
