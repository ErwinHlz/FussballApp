import type { Database } from '@/types/database'
import type { TeamMember } from '@/features/teams/api'

export const POSITIONS = ['GK', 'DF', 'MF', 'FW'] as const
export type Position = (typeof POSITIONS)[number]

export const MEMBER_STATUSES = ['active', 'injured', 'inactive'] as const
export type MemberStatus = Database['public']['Enums']['member_status']

export type SquadFilter = {
  status: MemberStatus | 'all'
  position: Position | 'all'
}

/** Players first sorted by shirt number (missing numbers last), then by name. */
export function sortSquad(members: TeamMember[]): TeamMember[] {
  return [...members].sort((a, b) => {
    const numberA = a.shirt_number ?? Number.POSITIVE_INFINITY
    const numberB = b.shirt_number ?? Number.POSITIVE_INFINITY
    if (numberA !== numberB) return numberA - numberB
    return a.display_name.localeCompare(b.display_name)
  })
}

export function filterSquad(members: TeamMember[], filter: SquadFilter): TeamMember[] {
  return members.filter(
    (m) =>
      (filter.status === 'all' || m.status === filter.status) &&
      (filter.position === 'all' || m.positions.includes(filter.position)),
  )
}

/** Account entries a manual player can be linked with: joined players, not the coach themself. */
export function linkCandidates(members: TeamMember[], currentUserId: string | null): TeamMember[] {
  return members.filter((m) => m.user_id !== null && m.user_id !== currentUserId)
}
