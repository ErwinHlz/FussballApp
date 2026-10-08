import { describe, expect, it } from 'vitest'
import type { TeamMember } from '@/features/teams/api'
import { filterSquad, linkCandidates, sortSquad } from '../squad'
import { parseShirtNumber } from '../schemas'

export function member(overrides: Partial<TeamMember>): TeamMember {
  return {
    id: overrides.display_name ?? 'id',
    team_id: 'team',
    user_id: null,
    role: 'player',
    display_name: 'Player',
    shirt_number: null,
    positions: [],
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('sortSquad', () => {
  it('sorts by shirt number, players without number last, then by name', () => {
    const sorted = sortSquad([
      member({ display_name: 'Zoe' }),
      member({ display_name: 'Ben', shirt_number: 10 }),
      member({ display_name: 'Ada' }),
      member({ display_name: 'Cem', shirt_number: 1 }),
    ])
    expect(sorted.map((m) => m.display_name)).toEqual(['Cem', 'Ben', 'Ada', 'Zoe'])
  })
})

describe('filterSquad', () => {
  const squad = [
    member({ display_name: 'Keeper', positions: ['GK'] }),
    member({ display_name: 'Hurt', positions: ['DF', 'MF'], status: 'injured' }),
    member({ display_name: 'Away', positions: ['FW'], status: 'inactive' }),
  ]

  it('returns everyone without filters', () => {
    expect(filterSquad(squad, { status: 'all', position: 'all' })).toHaveLength(3)
  })

  it('filters by status and position combined', () => {
    expect(
      filterSquad(squad, { status: 'injured', position: 'all' }).map((m) => m.display_name),
    ).toEqual(['Hurt'])
    expect(
      filterSquad(squad, { status: 'all', position: 'MF' }).map((m) => m.display_name),
    ).toEqual(['Hurt'])
    expect(filterSquad(squad, { status: 'active', position: 'MF' })).toEqual([])
  })
})

describe('linkCandidates', () => {
  it('offers joined accounts except the current user', () => {
    const squad = [
      member({ display_name: 'Manual' }),
      member({ display_name: 'Joined', user_id: 'u1' }),
      member({ display_name: 'Me', user_id: 'me', role: 'coach' }),
    ]
    expect(linkCandidates(squad, 'me').map((m) => m.display_name)).toEqual(['Joined'])
  })
})

describe('parseShirtNumber', () => {
  it('turns empty input into null', () => {
    expect(parseShirtNumber('')).toBeNull()
    expect(parseShirtNumber(undefined)).toBeNull()
    expect(parseShirtNumber('07')).toBe(7)
  })
})
