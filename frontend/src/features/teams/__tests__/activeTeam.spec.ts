import { describe, expect, it } from 'vitest'
import type { MyTeam } from '../api'
import { resolveActiveTeam } from '../composables/useActiveTeam'

function team(id: string): MyTeam {
  return {
    team_id: id,
    team_name: `Team ${id}`,
    team_season: null as unknown as string,
    club_id: 'club',
    club_name: 'Club',
    team_role: 'player',
    is_club_admin: false,
  }
}

describe('resolveActiveTeam', () => {
  const teams = [team('a'), team('b')]

  it('uses the remembered team', () => {
    expect(resolveActiveTeam(teams, 'b')?.team_id).toBe('b')
  })

  it('falls back to the first team if the remembered one is gone', () => {
    expect(resolveActiveTeam(teams, 'removed')?.team_id).toBe('a')
    expect(resolveActiveTeam(teams, null)?.team_id).toBe('a')
  })

  it('returns null without teams', () => {
    expect(resolveActiveTeam([], 'a')).toBeNull()
  })
})
