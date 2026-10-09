import { differenceInCalendarDays } from 'date-fns'
import type { SquadRole, TeamEvent } from '@/features/events/logic'
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

export type NominationState = SquadRole | 'notNominated' | 'pending'

/** pending = the coach has not nominated anyone yet. */
export function nominationState(
  event: Pick<TeamEvent, 'match_squad'>,
  memberId: string | null,
): NominationState {
  if (!event.match_squad.length) return 'pending'
  const entry = event.match_squad.find((s) => s.member_id === memberId)
  return entry?.role ?? 'notNominated'
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
