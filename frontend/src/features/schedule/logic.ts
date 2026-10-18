import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import type { Database, Tables } from '@/types/database'

export type PitchPart = Database['public']['Enums']['pitch_part']
export type Pitch = Tables<'pitches'>
export type SlotBooking = Tables<'slot_bookings'> & { exceptions: { date: string }[] }
/** Lane of the calendar: a half of a splittable pitch, or the whole pitch. */
export type Lane = PitchPart

// Bookable time (same rule as private.bookable_range in the database).
export const OPEN_FROM = '15:00'
export const OPEN_UNTIL = '20:30'
export const STEP_MIN = 30
/** Monday to Friday (0 = Sunday, as JS getDay). */
export const OPEN_WEEKDAYS = [1, 2, 3, 4, 5]

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

/** The bookable days (Monday to Friday) of the week that contains the date. */
export function openDates(date: Date): string[] {
  return weekDates(date).filter((d) => OPEN_WEEKDAYS.includes(weekdayOf(d)))
}

export function weekdayOf(date: string): number {
  return parseISO(date).getDay()
}

/** Minutes since midnight of a 'HH:mm[:ss]' time. */
export function minutesOf(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

/** 'HH:mm' of minutes since midnight. */
export function timeOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function timeLabel(time: string): string {
  return time.slice(0, 5)
}

/** Start times of the rows: 15:00, 15:30 … 20:00. */
export function halfHours(): string[] {
  const rows: string[] = []
  for (let m = minutesOf(OPEN_FROM); m < minutesOf(OPEN_UNTIL); m += STEP_MIN) rows.push(timeOf(m))
  return rows
}

/** True if the booking occupies the pitch on the date. */
export function bookingCovers(booking: SlotBooking, date: string): boolean {
  return (
    booking.weekday === weekdayOf(date) &&
    booking.valid_from <= date &&
    date <= booking.valid_until &&
    !booking.exceptions.some((x) => x.date === date)
  )
}

/** Bookings of a pitch on a date, by start time. */
export function bookingsOn(bookings: SlotBooking[], pitchId: string, date: string): SlotBooking[] {
  return bookings
    .filter((b) => b.pitch_id === pitchId && bookingCovers(b, date))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
}

/** Parts that conflict: the whole pitch with everything, a half with itself and the whole. */
export function partsClash(a: PitchPart, b: PitchPart): boolean {
  return a === 'full' || b === 'full' || a === b
}

/** The booking that holds the lane during the half hour starting at `time`, if any. */
export function occupant(day: SlotBooking[], lane: Lane, time: string): SlotBooking | null {
  const m = minutesOf(time)
  return (
    day.find(
      (b) => partsClash(b.part, lane) && minutesOf(b.start_time) <= m && m < minutesOf(b.end_time),
    ) ?? null
  )
}

/** True if the part is free from start to end on that day. */
export function rangeFree(day: SlotBooking[], part: PitchPart, start: string, end: string) {
  const s = minutesOf(start)
  const e = minutesOf(end)
  return !day.some(
    (b) => partsClash(b.part, part) && minutesOf(b.start_time) < e && s < minutesOf(b.end_time),
  )
}

/** Lengths (in minutes) a booking from `start` can have for the part: up to the next booking. */
export function possibleDurations(day: SlotBooking[], part: PitchPart, start: string): number[] {
  const s = minutesOf(start)
  const durations: number[] = []
  for (let e = s + STEP_MIN; e <= minutesOf(OPEN_UNTIL); e += STEP_MIN) {
    if (!rangeFree(day, part, start, timeOf(e))) break
    durations.push(e - s)
  }
  return durations
}

/** Parts of the pitch that are free for the whole range (whole pitch only if both halves are). */
export function freeParts(
  day: SlotBooking[],
  splittable: boolean,
  start: string,
  end: string,
): PitchPart[] {
  const parts: PitchPart[] = splittable ? ['full', 'a', 'b'] : ['full']
  return parts.filter((part) => rangeFree(day, part, start, end))
}

/** True if the half hour has already started. */
export function timeStarted(time: string, date: string, now = new Date()): boolean {
  return parseISO(`${date}T${timeLabel(time)}`) <= now
}

/** Default season end: the next 30 June. */
export function seasonEnd(from: string): string {
  const date = parseISO(from)
  const year = date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear()
  return `${year}-06-30`
}

/** Short label of a team for small calendar blocks: "U17" stays, "Damen" becomes "DAM". */
export function teamShortName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 4) return trimmed
  const first = trimmed.split(/\s+/)[0]!
  if (first.length <= 4 && /\d/.test(first)) return first
  return trimmed.slice(0, 3).toLocaleUpperCase('de')
}

/** Pitch and part chosen for a training; pitchId null = another place (free text). */
export type PitchChoice = { pitchId: string | null; part: PitchPart }

/** "Kunstrasen · A": the place a booked training gets (same as in the database). */
export function placeLabel(pitch: Pick<Pitch, 'name'>, part: PitchPart): string {
  return part === 'full' ? pitch.name : `${pitch.name} · ${part.toUpperCase()}`
}

/** Pitch and part of an earlier training's place, if it was one of the club's pitches. */
export function pitchFromLocation(
  pitches: Pick<Pitch, 'id' | 'name' | 'splittable'>[],
  location: string | null | undefined,
): PitchChoice | null {
  if (!location) return null
  for (const pitch of pitches) {
    if (location === pitch.name) return { pitchId: pitch.id, part: 'full' }
    if (pitch.splittable && location === `${pitch.name} · A`)
      return { pitchId: pitch.id, part: 'a' }
    if (pitch.splittable && location === `${pitch.name} · B`)
      return { pitchId: pitch.id, part: 'b' }
  }
  return null
}

/**
 * Why a training at that time cannot go into the schedule, or null if it can: only Monday to
 * Friday ('weekday'), within 15:00–20:30 ('time'), in half hours ('step').
 */
export function bookingProblem(
  weekday: number,
  start: string,
  durationMin: number,
): 'weekday' | 'time' | 'step' | null {
  if (!OPEN_WEEKDAYS.includes(weekday)) return 'weekday'
  const s = minutesOf(start)
  const e = s + durationMin
  if (s % STEP_MIN || durationMin % STEP_MIN || durationMin <= 0) return 'step'
  if (s < minutesOf(OPEN_FROM) || e > minutesOf(OPEN_UNTIL)) return 'time'
  return null
}
