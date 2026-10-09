import { describe, expect, it } from 'vitest'
import {
  formatHours,
  percent,
  rangeFor,
  reasonList,
  seasonStart,
  sortPlayers,
  teamSummary,
  type MemberStats,
  type TrainingPoint,
} from '../logic'

function stats(
  name: string,
  yes: number,
  total: number,
  overrides: Partial<MemberStats> = {},
): MemberStats {
  return {
    member_id: name,
    display_name: name,
    role: 'player',
    user_id: null as unknown as string,
    trainings_total: total,
    trainings_yes: yes,
    trainings_maybe: 0,
    trainings_no: 0,
    training_minutes: yes * 90,
    matches_total: 2,
    matches_yes: 1,
    starter: 0,
    bench: 0,
    reserve: 0,
    events_total: total + 2,
    answered: yes,
    decline_reasons: {},
    ...overrides,
  }
}

describe('ranges', () => {
  it('starts the season on July 1', () => {
    expect(seasonStart(new Date(2026, 9, 9))).toEqual(new Date(2026, 6, 1))
    expect(seasonStart(new Date(2027, 2, 1))).toEqual(new Date(2026, 6, 1))
    expect(seasonStart(new Date(2026, 6, 1))).toEqual(new Date(2026, 6, 1))
  })

  it('builds the last 30 days', () => {
    const now = new Date(2026, 9, 31)
    expect(rangeFor('last30', now).from).toEqual(new Date(2026, 9, 1))
  })
})

describe('numbers', () => {
  it('computes percentages and hours', () => {
    expect(percent(2, 3)).toBe(67)
    expect(percent(0, 0)).toBeNull()
    expect(formatHours(750, 'de')).toBe('12,5')
    expect(formatHours(120, 'en')).toBe('2')
  })
})

describe('teamSummary', () => {
  it('averages participation over trainings', () => {
    const points: TrainingPoint[] = [
      { event_id: 'a', starts_at: '', yes_count: 8, maybe_count: 0, no_count: 2, players: 10 },
      { event_id: 'b', starts_at: '', yes_count: 4, maybe_count: 0, no_count: 6, players: 10 },
    ]
    expect(teamSummary(points, [stats('A', 1, 2)])).toEqual({
      trainings: 2,
      attendanceRate: 60,
      averagePlayers: 6,
      matches: 2,
    })
    expect(teamSummary([], []).attendanceRate).toBeNull()
  })
})

describe('sortPlayers', () => {
  const members = [
    stats('Zoe', 5, 10),
    stats('Anna', 9, 10),
    stats('Neu', 0, 0),
    stats('Coach', 10, 10, { role: 'coach' }),
  ]

  it('ranks players by participation, without coaches, no data last', () => {
    expect(sortPlayers(members, 'rate').map((m) => m.display_name)).toEqual(['Anna', 'Zoe', 'Neu'])
  })

  it('sorts by name', () => {
    expect(sortPlayers(members, 'name').map((m) => m.display_name)).toEqual(['Anna', 'Neu', 'Zoe'])
  })
})

describe('reasonList', () => {
  it('sorts decline reasons by frequency', () => {
    expect(reasonList({ sick: 1, work: 3 })).toEqual([
      { reason: 'work', count: 3 },
      { reason: 'sick', count: 1 },
    ])
    expect(reasonList(null)).toEqual([])
  })
})
