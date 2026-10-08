import type { TeamMember } from '@/features/teams/api'
import type { Attendance } from '@/features/events/logic'
import { POSITIONS } from '@/features/squad/squad'

export const BIB_COLORS = ['red', 'blue', 'yellow', 'green', 'orange', 'white'] as const
export type BibColor = (typeof BIB_COLORS)[number]

export type DraftGroup = { key: string; name: string; color: BibColor; memberIds: string[] }
export type AvailablePlayer = { member: TeamMember; maybe: boolean }

let keyCounter = 0
export const newGroupKey = () => `g${++keyCounter}`

/** Players who said yes or maybe (maybe is marked); declined and unanswered are hidden. */
export function availablePlayers(
  members: TeamMember[],
  attendances: Attendance[],
): AvailablePlayer[] {
  const status = new Map(attendances.map((a) => [a.member_id, a.status]))
  return members
    .filter((m) => m.role === 'player')
    .filter((m) => status.get(m.id) === 'yes' || status.get(m.id) === 'maybe')
    .map((member) => ({ member, maybe: status.get(member.id) === 'maybe' }))
    .sort((a, b) => a.member.display_name.localeCompare(b.member.display_name, 'de'))
}

export function nextColor(groups: Pick<DraftGroup, 'color'>[]): BibColor {
  const used = new Set(groups.map((g) => g.color))
  return BIB_COLORS.find((c) => !used.has(c)) ?? BIB_COLORS[groups.length % BIB_COLORS.length]!
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

function withMembers(groups: DraftGroup[], buckets: string[][]): DraftGroup[] {
  return groups.map((g, i) => ({ ...g, memberIds: buckets[i] ?? [] }))
}

/** Random, evenly sized groups (sizes differ by at most one). */
export function distributeRandom(
  memberIds: string[],
  groups: DraftGroup[],
  random: () => number = Math.random,
): DraftGroup[] {
  if (!groups.length) return groups
  const buckets: string[][] = groups.map(() => [])
  shuffle(memberIds, random).forEach((id, i) => buckets[i % groups.length]!.push(id))
  return withMembers(groups, buckets)
}

/** Position rank of a member: first listed position in GK, DF, MF, FW order; none last. */
function positionRank(member: TeamMember): number {
  const ranks = member.positions
    .map((p) => POSITIONS.indexOf(p as (typeof POSITIONS)[number]))
    .filter((r) => r >= 0)
  return ranks.length ? Math.min(...ranks) : POSITIONS.length
}

/**
 * Balances positions: players are sorted by position (keepers first) and dealt out in a
 * snake order (1-2-3-3-2-1 …), so every group gets a similar mix and similar size.
 */
export function distributeByPosition(
  members: TeamMember[],
  groups: DraftGroup[],
  random: () => number = Math.random,
): DraftGroup[] {
  if (!groups.length) return groups
  const ordered = shuffle(members, random).sort((a, b) => positionRank(a) - positionRank(b))
  const buckets: string[][] = groups.map(() => [])
  ordered.forEach((member, i) => {
    const round = Math.floor(i / groups.length)
    const offset = i % groups.length
    const index = round % 2 === 0 ? offset : groups.length - 1 - offset
    buckets[index]!.push(member.id)
  })
  return withMembers(groups, buckets)
}

/** Same groups as another drill, limited to players who are still available. */
export function copyGroups(previous: DraftGroup[], availableIds: string[]): DraftGroup[] {
  const available = new Set(availableIds)
  return previous.map((g) => ({
    key: newGroupKey(),
    name: g.name,
    color: g.color,
    memberIds: g.memberIds.filter((id) => available.has(id)),
  }))
}

export function assignedIds(groups: DraftGroup[]): Set<string> {
  return new Set(groups.flatMap((g) => g.memberIds))
}

export type GroupWarnings = {
  /** Said yes but is in no group. */
  unassigned: string[]
  /** In a group but declined (or withdrew the answer) after being assigned. */
  declinedButAssigned: string[]
}

export function groupWarnings(groups: DraftGroup[], attendances: Attendance[]): GroupWarnings {
  const status = new Map(attendances.map((a) => [a.member_id, a.status]))
  const assigned = assignedIds(groups)
  return {
    unassigned: [...status.entries()]
      .filter(([id, s]) => s === 'yes' && !assigned.has(id))
      .map(([id]) => id),
    declinedButAssigned: [...assigned].filter((id) => {
      const s = status.get(id)
      return s !== 'yes' && s !== 'maybe'
    }),
  }
}
