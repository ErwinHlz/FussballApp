import { computed, type MaybeRefOrGetter } from 'vue'
import { useTeamMembers } from '@/features/teams/composables/useTeams'

/** A squad player as the tactics board shows them: short name and jersey number. */
export type SquadPlayer = { id: string; name: string; number?: string }

/**
 * Players of a team for the board's squad bar and name suggestions. Names are first names
 * (max 16 characters); players sharing a first name get their last name's initial.
 * Inactive players are left out.
 */
export function useBoardSquad(teamId: MaybeRefOrGetter<string | null>) {
  const members = useTeamMembers(teamId)
  return computed<SquadPlayer[]>(() => {
    const players = (members.data.value ?? []).filter(
      (m) => m.role === 'player' && m.status !== 'inactive',
    )
    const first = (name: string) => name.trim().split(/\s+/)[0] ?? ''
    const count = new Map<string, number>()
    for (const m of players)
      count.set(first(m.display_name), (count.get(first(m.display_name)) ?? 0) + 1)
    return players
      .map((m) => {
        const parts = m.display_name.trim().split(/\s+/)
        const short = first(m.display_name)
        const name = (
          count.get(short)! > 1 && parts.length > 1 ? `${short} ${parts.at(-1)![0]}.` : short
        ).slice(0, 16)
        return {
          id: m.id,
          name,
          number: m.shirt_number != null ? String(m.shirt_number).slice(0, 3) : undefined,
        }
      })
      .filter((p) => p.name)
  })
}
