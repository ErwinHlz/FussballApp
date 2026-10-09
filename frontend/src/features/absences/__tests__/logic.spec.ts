import { describe, expect, it } from 'vitest'
import { absenceRange, isCurrent, lastDay } from '../logic'

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
