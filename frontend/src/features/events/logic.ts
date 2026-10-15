import {
  addDays,
  addHours,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns'
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
    // Coaches who did not answer are not "missing" players.
    if (!attendance && member.role === 'coach') continue
    summary[attendance?.status ?? 'none'].push({ member, attendance })
  }
  return summary
}

/** Only events within this many days trigger the in-app reminder. */
export const REMINDER_DAYS = 7

/** Open events in the next days the member has not answered yet (in-app reminder). */
export function unansweredEvents(
  events: TeamEvent[],
  memberId: string | null,
  now: Date = new Date(),
  horizonDays: number = REMINDER_DAYS,
): TeamEvent[] {
  if (!memberId) return []
  const horizon = addHours(now, horizonDays * 24)
  return events.filter(
    (e) =>
      new Date(e.starts_at) <= horizon &&
      responseState(e, now) === 'open' &&
      !e.attendances.some((a) => a.member_id === memberId),
  )
}

export type EventTypeFilter = 'all' | Database['public']['Enums']['event_type']
export type EventFilter = { type: EventTypeFilter; onlyUnanswered: boolean }
export const DEFAULT_EVENT_FILTER: EventFilter = { type: 'all', onlyUnanswered: false }

/** Number of active filter options (shown on the filter button). */
export function activeFilterCount(filter: EventFilter): number {
  return (filter.type !== 'all' ? 1 : 0) + (filter.onlyUnanswered ? 1 : 0)
}

/** Events matching the filter; "unanswered" means without an answer of this member. */
export function filterEvents(
  events: TeamEvent[],
  filter: EventFilter,
  memberId: string | null,
): TeamEvent[] {
  return events.filter(
    (e) =>
      (filter.type === 'all' || e.type === filter.type) &&
      (!filter.onlyUnanswered || !memberId || !e.attendances.some((a) => a.member_id === memberId)),
  )
}

/** Dates "attend all" answers: open for answers and not answered by the member yet. */
export function attendAllCandidates(
  events: TeamEvent[],
  memberId: string | null,
  now: Date = new Date(),
): TeamEvent[] {
  if (!memberId) return []
  return events.filter(
    (e) => responseState(e, now) === 'open' && !e.attendances.some((a) => a.member_id === memberId),
  )
}

export type WeekGroup<T> = {
  /** Monday of the week, local date yyyy-MM-dd. */
  key: string
  start: Date
  end: Date
  /** This week, next week or any later/earlier week (shown with its dates). */
  kind: 'thisWeek' | 'nextWeek' | 'week'
  events: T[]
}

/** Groups events (already sorted) by calendar week, Monday to Sunday, in local time. */
export function groupByWeek<T extends Pick<EventRow, 'starts_at'>>(
  events: T[],
  now: Date = new Date(),
): WeekGroup<T>[] {
  const thisWeek = startOfWeek(now, { weekStartsOn: 1 }).getTime()
  const nextWeek = addDays(new Date(thisWeek), 7).getTime()
  const groups = new Map<string, WeekGroup<T>>()
  for (const event of events) {
    const start = startOfWeek(new Date(event.starts_at), { weekStartsOn: 1 })
    const key = format(start, 'yyyy-MM-dd')
    let group = groups.get(key)
    if (!group) {
      const kind =
        start.getTime() === thisWeek
          ? 'thisWeek'
          : start.getTime() === nextWeek
            ? 'nextWeek'
            : 'week'
      group = { key, start, end: addDays(start, 6), kind, events: [] }
      groups.set(key, group)
    }
    group.events.push(event)
  }
  return [...groups.values()]
}

// ---------------------------------------------------------------------------
// Quick create: defaults taken over from the last event of the same type
// ---------------------------------------------------------------------------

export type CreateDefaults = {
  /** Local start time "HH:mm". */
  time: string
  durationMin: number
  location: string | null
  deadlineHours: number | null
  /** Matches: meeting time as minutes before kick-off, and place. */
  meetOffsetMin: number | null
  meetLocation: string | null
  /** Weekday of the last event (0 = Sunday), to suggest the next date. */
  weekday: number | null
}

const FALLBACK_DEFAULTS: Record<'training' | 'match' | 'event', CreateDefaults> = {
  training: {
    time: '19:00',
    durationMin: 90,
    location: null,
    deadlineHours: null,
    meetOffsetMin: null,
    meetLocation: null,
    weekday: null,
  },
  match: {
    time: '15:00',
    durationMin: 90,
    location: null,
    deadlineHours: null,
    meetOffsetMin: null,
    meetLocation: null,
    weekday: null,
  },
  event: {
    time: '19:00',
    durationMin: 120,
    location: null,
    deadlineHours: null,
    meetOffsetMin: null,
    meetLocation: null,
    weekday: null,
  },
}

/** Takes time, length, place and deadline from the most recently created event of the type. */
export function suggestDefaults(
  events: Pick<
    EventRow,
    | 'type'
    | 'created_at'
    | 'starts_at'
    | 'ends_at'
    | 'location'
    | 'response_deadline'
    | 'meet_at'
    | 'meet_location'
    | 'is_cancelled'
  >[],
  type: 'training' | 'match' | 'event',
): CreateDefaults {
  const last = events
    .filter((e) => e.type === type && !e.is_cancelled)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (!last) return { ...FALLBACK_DEFAULTS[type] }
  const starts = new Date(last.starts_at)
  const minutes = (later: string) =>
    Math.round((new Date(later).getTime() - starts.getTime()) / 60000)
  return {
    time: format(starts, 'HH:mm'),
    durationMin: last.ends_at ? minutes(last.ends_at) : FALLBACK_DEFAULTS[type].durationMin,
    location: last.location,
    deadlineHours: last.response_deadline
      ? Math.round(-minutes(last.response_deadline) / 60)
      : null,
    meetOffsetMin: last.meet_at ? -minutes(last.meet_at) : null,
    meetLocation: last.meet_location,
    weekday: starts.getDay(),
  }
}

/** Next date (from tomorrow on) on the given weekday; tomorrow without a weekday. */
export function suggestDate(weekday: number | null, now: Date = new Date()): string {
  const tomorrow = addDays(now, 1)
  if (weekday === null) return format(tomorrow, 'yyyy-MM-dd')
  const offset = (weekday - tomorrow.getDay() + 7) % 7
  return format(addDays(tomorrow, offset), 'yyyy-MM-dd')
}
