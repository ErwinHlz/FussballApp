import { describe, expect, it } from 'vitest'
import { absenceRange, isCurrent, lastDay, mergeAbsences } from '../logic'

describe('absenceRange', () => {
  it('covers whole local days, the last day included', () => {
    expect(absenceRange('2026-08-01', '2026-08-14')).toEqual({
      startsAt: new Date(2026, 7, 1),
      endsAt: new Date(2026, 7, 15),
    })
  })

  it('allows a single day', () => {
    expect(absenceRange('2026-08-01', '2026-08-01')?.endsAt).toEqual(new Date(2026, 7, 2))
  })

  it('rejects inverted or invalid ranges', () => {
    expect(absenceRange('2026-08-10', '2026-08-01')).toBeNull()
    expect(absenceRange('', '2026-08-01')).toBeNull()
  })
})

describe('display helpers', () => {
  it('shows the last day of the absence', () => {
    expect(lastDay(new Date(2026, 7, 15).toISOString())).toEqual(new Date(2026, 7, 14))
  })

  it('knows whether an absence is running', () => {
    const a = {
      starts_at: new Date(2026, 7, 1).toISOString(),
      ends_at: new Date(2026, 7, 15).toISOString(),
    }
    expect(isCurrent(a, new Date(2026, 7, 5))).toBe(true)
    expect(isCurrent(a, new Date(2026, 7, 15))).toBe(false)
  })
})

describe('mergeAbsences', () => {
  const absence = (
    id: string,
    memberId: string,
    userId: string | null,
    startsAt = '2026-08-01',
  ) => ({
    id,
    starts_at: startsAt,
    ends_at: '2026-08-15',
    reason: 'vacation',
    note: null,
    member: { id: memberId, user_id: userId },
  })

  it('shows one entry for the same period across the own teams', () => {
    const merged = mergeAbsences([absence('a1', 'm1', 'u1'), absence('a2', 'm2', 'u1')])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.ids).toEqual(['a1', 'a2'])
  })

  it('keeps different people and periods apart', () => {
    const merged = mergeAbsences([
      absence('a1', 'm1', 'u1'),
      absence('a2', 'm2', 'u2'),
      absence('a3', 'm3', null),
      absence('a4', 'm4', null),
      absence('a5', 'm1', 'u1', '2026-08-02'),
    ])
    expect(merged.map((a) => a.ids)).toEqual([['a1'], ['a2'], ['a3'], ['a4'], ['a5']])
  })
})
