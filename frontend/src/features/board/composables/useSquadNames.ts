import { computed, type MaybeRefOrGetter } from 'vue'
import { useTeamMembers } from '@/features/teams/composables/useTeams'

/** Player names of a team as suggestions for board labels (first names, max 16 characters). */
export function useSquadNames(teamId: MaybeRefOrGetter<string | null>) {
  const members = useTeamMembers(teamId)
  return computed(() =>
    (members.data.value ?? [])
      .filter((m) => m.role === 'player')
      .map((m) => m.display_name.split(' ')[0]!.slice(0, 16))
      .filter((name, i, all) => name && all.indexOf(name) === i),
  )
}
