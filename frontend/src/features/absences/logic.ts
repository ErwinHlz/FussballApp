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

type Mergeable = {
  id: string
  starts_at: string
  ends_at: string
  reason: string
  note: string | null
  member: { id: string; user_id: string | null }
}

/**
 * One entry per person and period: "I'm away" creates an absence for every own squad entry
 * (one per team), which belong together. `ids` holds all of them (to delete them together).
 */
export function mergeAbsences<T extends Mergeable>(absences: T[]): (T & { ids: string[] })[] {
  const merged = new Map<string, T & { ids: string[] }>()
  for (const a of absences) {
    const key = [a.member.user_id ?? a.member.id, a.starts_at, a.ends_at, a.reason, a.note].join(
      '|',
    )
    const existing = merged.get(key)
    if (existing) existing.ids.push(a.id)
    else merged.set(key, { ...a, ids: [a.id] })
  }
  return [...merged.values()]
}

/** Whether the absence is happening right now. */
export function isCurrent(a: { starts_at: string; ends_at: string }, now: Date = new Date()) {
  return new Date(a.starts_at) <= now && now < new Date(a.ends_at)
}
