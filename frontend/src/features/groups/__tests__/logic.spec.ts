import { describe, expect, it } from 'vitest'
import { member } from '@/features/squad/__tests__/squad.spec'
import type { Attendance } from '@/features/events/logic'
import {
  availablePlayers,
  copyGroups,
  distributeByPosition,
  distributeRandom,
  groupWarnings,
  nextColor,
  type DraftGroup,
} from '../logic'

function attendance(memberId: string, status: Attendance['status']): Attendance {
  return {
    id: memberId,
    event_id: 'e',
    member_id: memberId,
    status,
    reason: null,
    reason_note: null,
    updated_by: null,
    source_absence_id: null,
    updated_at: '',
    created_at: '',
  }
}

const group = (key: string, color: DraftGroup['color'], memberIds: string[] = []): DraftGroup => ({
  key,
  name: key,
  color,
  memberIds,
})

// Deterministic "random" for reproducible tests.
function seeded(seed = 42) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

describe('availablePlayers', () => {
  it('offers yes and maybe (marked), hides no, unanswered and coaches', () => {
    const members = [
      member({ id: 'y', display_name: 'Yara' }),
      member({ id: 'm', display_name: 'Max' }),
      member({ id: 'n', display_name: 'Nina' }),
      member({ id: 'u', display_name: 'Udo' }),
      member({ id: 'c', display_name: 'Coach', role: 'coach' }),
    ]
    const result = availablePlayers(members, [
      attendance('y', 'yes'),
      attendance('m', 'maybe'),
      attendance('n', 'no'),
      attendance('c', 'yes'),
    ])
    expect(result.map((p) => [p.member.id, p.maybe])).toEqual([
      ['m', true],
      ['y', false],
    ])
  })
})

describe('distribution', () => {
  const ids = Array.from({ length: 11 }, (_, i) => `p${i}`)

  it('random: every player exactly once, sizes differ by at most one', () => {
    const groups = distributeRandom(
      ids,
      [group('a', 'red'), group('b', 'blue'), group('c', 'green')],
      seeded(),
    )
    const sizes = groups.map((g) => g.memberIds.length)
    expect(sizes.reduce((a, b) => a + b)).toBe(11)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    expect(new Set(groups.flatMap((g) => g.memberIds)).size).toBe(11)
  })

  it('random: keeps group names and colors', () => {
    const groups = distributeRandom(ids, [group('a', 'red'), group('b', 'blue')], seeded())
    expect(groups.map((g) => g.color)).toEqual(['red', 'blue'])
  })

  it('by position: keepers and positions are spread evenly', () => {
    const players = [
      member({ id: 'gk1', positions: ['GK'] }),
      member({ id: 'gk2', positions: ['GK'] }),
      member({ id: 'df1', positions: ['DF'] }),
      member({ id: 'df2', positions: ['DF'] }),
      member({ id: 'mf1', positions: ['MF'] }),
      member({ id: 'mf2', positions: ['MF', 'FW'] }),
      member({ id: 'fw1', positions: ['FW'] }),
      member({ id: 'fw2', positions: ['FW'] }),
    ]
    const groups = distributeByPosition(players, [group('a', 'red'), group('b', 'blue')], seeded())
    for (const g of groups) {
      expect(g.memberIds.filter((id) => id.startsWith('gk'))).toHaveLength(1)
      expect(g.memberIds.filter((id) => id.startsWith('df'))).toHaveLength(1)
      expect(g.memberIds).toHaveLength(4)
    }
  })

  it('handles no groups gracefully', () => {
    expect(distributeRandom(ids, [])).toEqual([])
  })
})

describe('copyGroups', () => {
  it('copies names and colors, keeps only available players', () => {
    const copied = copyGroups(
      [group('Rot', 'red', ['a', 'gone']), group('Blau', 'blue', ['b'])],
      ['a', 'b'],
    )
    expect(copied.map((g) => [g.name, g.color, g.memberIds])).toEqual([
      ['Rot', 'red', ['a']],
      ['Blau', 'blue', ['b']],
    ])
  })
})

describe('groupWarnings and colors', () => {
  it('finds unassigned yes players and assigned players who declined', () => {
    const groups = [group('a', 'red', ['in', 'declined'])]
    const warnings = groupWarnings(groups, [
      attendance('in', 'yes'),
      attendance('out', 'yes'),
      attendance('maybe', 'maybe'),
      attendance('declined', 'no'),
    ])
    expect(warnings).toEqual({ unassigned: ['out'], declinedButAssigned: ['declined'] })
  })

  it('picks the next unused bib color', () => {
    expect(nextColor([])).toBe('red')
    expect(nextColor([{ color: 'red' }, { color: 'yellow' }])).toBe('blue')
  })
})
