import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

/** Remembers which team the user is currently looking at (per device). */
export const useActiveTeamStore = defineStore('activeTeam', () => {
  const activeTeamId = useLocalStorage<string | null>('rondo.activeTeamId', null)

  function setActiveTeam(teamId: string | null) {
    activeTeamId.value = teamId
  }

  return { activeTeamId, setActiveTeam }
})
