import { addDays, addHours, differenceInCalendarDays, parseISO } from 'date-fns'
import type { Database, Tables } from '@/types/database'
import type { TeamMember } from '@/features/teams/api'

export type EventRow = Tables<'events'>
export type Attendance = Tables<'attendances'>
export type MatchSquadEntry = Tables<'match_squad'>
export type AttendanceStatus = Database['public']['Enums']['attendance_status']
export type SquadRole = Database['public']['Enums']['squad_role']
export type TeamEvent = EventRow & { attendances: Attendance[]; match_squad: MatchSquadEntry[] }

export const DECLINE_REASONS = ['injured', 'sick', 'work', 'vacation', 'other'] as const
export type DeclineReason = (typeof DECLINE_REASONS)[number]
export const COMPETITIONS = ['league', 'cup', 'friendly'] as const
export type Competition = (typeof COMPETITIONS)[number]
export const SQUAD_ROLES = ['starter', 'bench', 'reserve'] as const
export const DEADLINE_HOURS = [2, 6, 12, 24, 48] as const

/** Events of past days stay "upcoming" until they are over (or 2h after start). */
const DEFAULT_EVENT_LENGTH_HOURS = 2
const MAX_SERIES_DATES = 200

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export type SeriesInput = {
  weekday: number // 0 = Sunday (Date#getDay)
  startTime: string // "HH:mm", local time
  validFrom: string // "yyyy-MM-dd"
  validUntil: string // "yyyy-MM-dd"
}

/**
 * All start times of a weekly series in the user's local time zone.
 * Using local wall-clock time keeps 19:00 at 19:00 across daylight saving changes.
 */
export function generateSeriesOccurrences(input: SeriesInput): Date[] {
  const [hours, minutes] = input.startTime.split(':').map(Number)
  const from = parseISO(input.validFrom)
  const until = parseISO(input.validUntil)
  if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime()) || until < from) return []

  const offset = (input.weekday - from.getDay() + 7) % 7
  const result: Date[] = []
  for (let day = addDays(from, offset); day <= until; day = addDays(day, 7)) {
    result.push(
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours ?? 0, minutes ?? 0, 0, 0),
    )
    if (result.length > MAX_SERIES_DATES) break
  }
  return result
}

/** Occurrences of several weekdays (one series each), sorted chronologically. */
export function generateMultiWeekdayOccurrences(
  weekdays: number[],
  base: Omit<SeriesInput, 'weekday'>,
): { weekday: number; dates: Date[] }[] {
  return [...weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // Monday first
    .map((weekday) => ({ weekday, dates: generateSeriesOccurrences({ ...base, weekday }) }))
}

export function seriesTooLong(validFrom: string, validUntil: string): boolean {
  return differenceInCalendarDays(parseISO(validUntil), parseISO(validFrom)) > 366
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export type ResponseState = 'open' | 'deadlinePassed' | 'started' | 'cancelled'

/** Mirrors the database rule `event_open_for_responses`. */
export function responseState(
  event: Pick<EventRow, 'is_cancelled' | 'response_deadline' | 'starts_at'>,
  now: Date = new Date(),
): ResponseState {
  if (event.is_cancelled) return 'cancelled'
  if (event.response_deadline && now >= new Date(event.response_deadline)) return 'deadlinePassed'
  if (now >= new Date(event.starts_at)) return 'started'
  return 'open'
}

/** Players may answer while the event is open; coaches always (except cancelled events). */
export function canRespond(
  event: Pick<EventRow, 'is_cancelled' | 'response_deadline' | 'starts_at'>,
  isCoach: boolean,
  now: Date = new Date(),
): boolean {
  const state = responseState(event, now)
  return state === 'open' || (isCoach && state !== 'cancelled')
}

export function deadlineFromHours(startsAt: Date, hours: number | null): Date | null {
  return hours === null ? null : addHours(startsAt, -hours)
}

// ---------------------------------------------------------------------------
// Lists and summaries
// ---------------------------------------------------------------------------

export function eventEnd(event: Pick<EventRow, 'starts_at' | 'ends_at'>): Date {
  return event.ends_at
    ? new Date(event.ends_at)
    : addHours(new Date(event.starts_at), DEFAULT_EVENT_LENGTH_HOURS)
}

export function splitEvents<T extends Pick<EventRow, 'starts_at' | 'ends_at'>>(
  events: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const sorted = [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  return {
    upcoming: sorted.filter((e) => eventEnd(e) > now),
    past: sorted.filter((e) => eventEnd(e) <= now).reverse(),
  }
}

export type AttendanceGroup = AttendanceStatus | 'none'
export type AttendanceSummary = Record<
  AttendanceGroup,
  { member: TeamMember; attendance: Attendance | null }[]
>

export function summarizeAttendance(
  members: TeamMember[],
  attendances: Attendance[],
): AttendanceSummary {
  const byMember = new Map(attendances.map((a) => [a.member_id, a]))
  const summary: AttendanceSummary = { yes: [], maybe: [], no: [], none: [] }
  for (const member of members) {
    const attendance = byMember.get(member.id) ?? null
    summary[attendance?.status ?? 'none'].push({ member, attendance })
  }
  return summary
}

/** Upcoming, open events the member has not answered yet (for the in-app reminder). */
export function unansweredEvents(
  events: TeamEvent[],
  memberId: string | null,
  now: Date = new Date(),
): TeamEvent[] {
  if (!memberId) return []
  return events.filter(
    (e) => responseState(e, now) === 'open' && !e.attendances.some((a) => a.member_id === memberId),
  )
}
