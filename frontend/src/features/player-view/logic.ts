import { addDays, differenceInCalendarDays, format } from 'date-fns'
import type { TeamEvent } from '@/features/events/logic'
import { eventEnd, responseState } from '@/features/events/logic'
import type { DrillGroups, SavedGroup } from '@/features/groups/api'

/** The next event that is not over and not cancelled. */
export function nextEvent(events: TeamEvent[], now: Date = new Date()): TeamEvent | null {
  return (
    [...events]
      .filter((e) => !e.is_cancelled && eventEnd(e) > now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null
  )
}

/**
 * Local dates (yyyy-MM-dd) of the week strip: today and the six days after it. A rolling week
 * keeps the next event in view on weekends, when the calendar week is almost over.
 */
export function stripDays(now: Date = new Date()): string[] {
  return Array.from({ length: 7 }, (_, i) => format(addDays(now, i), 'yyyy-MM-dd'))
}

export type RelativeDay = 'today' | 'tomorrow' | 'inDays' | 'date'

export function relativeDay(
  iso: string,
  now: Date = new Date(),
): { kind: RelativeDay; days: number } {
  const days = differenceInCalendarDays(new Date(iso), now)
  if (days <= 0) return { kind: 'today', days: 0 }
  if (days === 1) return { kind: 'tomorrow', days }
  if (days < 7) return { kind: 'inDays', days }
  return { kind: 'date', days }
}

/** For each drill of the training: the group the member is in (if any). */
export function myGroupsByDrill(
  drills: DrillGroups[],
  memberId: string | null,
): Map<string, SavedGroup> {
  const result = new Map<string, SavedGroup>()
  if (!memberId) return result
  for (const ed of drills) {
    const group = ed.groups.find((g) => g.member_ids.includes(memberId))
    if (group) result.set(ed.id, group)
  }
  return result
}

/** Days ahead in which a training without a published plan becomes a task for the coach. */
export const PLAN_TASK_DAYS = 3
/** Days ahead in which a match without a squad or missing answers become tasks. */
export const SOON_TASK_DAYS = 7
/** From this many players without an answer, the event is a task ("chase the answers"). */
export const MISSING_ANSWERS_TASK = 3

export type CoachTask =
  | { kind: 'plan'; event: TeamEvent }
  | { kind: 'squad'; event: TeamEvent }
  | { kind: 'answers'; event: TeamEvent; count: number }

/**
 * What the coach still has to do for the coming days, by date: publish the plan of a training
 * soon, pick the squad of a match, chase missing answers (only while players can still answer).
 */
export function coachTasks(
  events: TeamEvent[],
  playerIds: string[],
  now: Date = new Date(),
): CoachTask[] {
  const players = new Set(playerIds)
  const within = (e: TeamEvent, days: number) =>
    new Date(e.starts_at) > now && differenceInCalendarDays(new Date(e.starts_at), now) < days
  const tasks: CoachTask[] = []
  for (const event of [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    if (event.is_cancelled) continue
    if (
      event.type === 'training' &&
      event.plan_status !== 'published' &&
      within(event, PLAN_TASK_DAYS)
    )
      tasks.push({ kind: 'plan', event })
    if (event.type === 'match' && !event.match_squad.length && within(event, SOON_TASK_DAYS))
      tasks.push({ kind: 'squad', event })
    if (within(event, SOON_TASK_DAYS) && responseState(event, now) === 'open') {
      const answered = new Set(event.attendances.map((a) => a.member_id))
      const count = [...players].filter((id) => !answered.has(id)).length
      if (count >= MISSING_ANSWERS_TASK) tasks.push({ kind: 'answers', event, count })
    }
  }
  return tasks
}

/** Players who said yes but are missing in a drill that has groups (a task for the coach). */
export function unassignedYes(
  drills: DrillGroups[],
  attendances: TeamEvent['attendances'],
): string[] {
  const withGroups = drills.filter((d) => d.groups.length)
  return attendances
    .filter((a) => a.status === 'yes')
    .map((a) => a.member_id)
    .filter((id) => withGroups.some((d) => !d.groups.some((g) => g.member_ids.includes(id))))
}
