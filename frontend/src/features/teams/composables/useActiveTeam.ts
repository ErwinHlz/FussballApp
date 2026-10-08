import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useActiveTeamStore } from '@/stores/activeTeam'
import type { MyTeam } from '../api'
import { useMyTeams } from './useTeams'

/** Picks the remembered team if the user still belongs to it, otherwise the first one. */
export function resolveActiveTeam(teams: MyTeam[], rememberedId: string | null): MyTeam | null {
  return teams.find((t) => t.team_id === rememberedId) ?? teams[0] ?? null
}

export function useActiveTeam() {
  const store = useActiveTeamStore()
  const { activeTeamId } = storeToRefs(store)
  const myTeams = useMyTeams()

  const activeTeam = computed(() => resolveActiveTeam(myTeams.data.value ?? [], activeTeamId.value))
  const isCoach = computed(
    () =>
      !!activeTeam.value &&
      (activeTeam.value.team_role === 'coach' || activeTeam.value.is_club_admin),
  )

  return { myTeams, activeTeam, isCoach, setActiveTeam: store.setActiveTeam }
}
