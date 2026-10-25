import { addDays, differenceInCalendarDays, format } from 'date-fns'
import type { TeamEvent } from '@/features/events/logic'
import { eventEnd } from '@/features/events/logic'
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
