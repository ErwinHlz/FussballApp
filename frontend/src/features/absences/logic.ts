import { addDays, parseISO } from 'date-fns'

/**
 * Turns the date inputs "from" and "to" (inclusive, local days) into a time range:
 * from 00:00 of the first day until 00:00 of the day after the last day.
 */
export function absenceRange(from: string, to: string): { startsAt: Date; endsAt: Date } | null {
  const start = parseISO(from)
  const end = parseISO(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  return { startsAt: start, endsAt: addDays(end, 1) }
}

/** The last day of an absence for display (ends_at is exclusive midnight). */
export function lastDay(endsAt: string): Date {
  return addDays(new Date(endsAt), -1)
}

/** Whether the absence is happening right now. */
export function isCurrent(a: { starts_at: string; ends_at: string }, now: Date = new Date()) {
  return new Date(a.starts_at) <= now && now < new Date(a.ends_at)
}
