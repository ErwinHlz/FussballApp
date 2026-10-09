import { describe, expect, it } from 'vitest'
import { member } from '@/features/squad/__tests__/squad.spec'
import type { Attendance } from '@/features/events/logic'
import {
  durationFit,
  eventMinutes,
  itemMinutes,
  lateDeclines,
  moveItem,
  planTotalMinutes,
  type PlanItem,
} from '../logic'

const item = (duration: number | null, drillDuration: number | null) =>
  ({ duration_min: duration, drill: { duration_min: drillDuration } }) as Pick<
    PlanItem,
    'duration_min' | 'drill'
  >

function attendance(memberId: string, status: Attendance['status'], updatedAt: string): Attendance {
  return {
    id: memberId,
    event_id: 'e',
    member_id: memberId,
    status,
    reason: null,
    reason_note: null,
    updated_by: null,
    source_absence_id: null,
    updated_at: updatedAt,
    created_at: updatedAt,
  }
}

describe('plan duration', () => {
  it('uses the override, else the drill default, else 0', () => {
    expect(itemMinutes(item(25, 15))).toBe(25)
    expect(itemMinutes(item(null, 15))).toBe(15)
    expect(itemMinutes(item(null, null))).toBe(0)
    expect(planTotalMinutes([item(25, 15), item(null, 15), item(null, null)])).toBe(40)
  })

  it('compares the plan with the event length', () => {
    expect(
      eventMinutes({ starts_at: '2030-01-01T18:00:00Z', ends_at: '2030-01-01T19:30:00Z' }),
    ).toBe(90)
    expect(eventMinutes({ starts_at: '2030-01-01T18:00:00Z', ends_at: null })).toBeNull()
    expect(durationFit(95, 90)).toBe('over')
    expect(durationFit(90, 90)).toBe('fits')
    expect(durationFit(86, 90)).toBe('fits')
    expect(durationFit(60, 90)).toBe('under')
    expect(durationFit(60, null)).toBe('none')
  })
})

describe('moveItem', () => {
  it('moves up and down, ignores invalid moves', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})

describe('lateDeclines', () => {
  const members = [
    member({ id: 'm1', display_name: 'Early' }),
    member({ id: 'm2', display_name: 'Late' }),
  ]
  const attendances = [
    attendance('m1', 'no', '2030-01-01T10:00:00Z'),
    attendance('m2', 'no', '2030-01-02T10:00:00Z'),
  ]

  it('lists only declines after publishing', () => {
    const result = lateDeclines(
      { plan_status: 'published', plan_published_at: '2030-01-01T12:00:00Z' },
      attendances,
      members,
    )
    expect(result.map((r) => r.member.display_name)).toEqual(['Late'])
  })

  it('is empty for drafts', () => {
    expect(
      lateDeclines({ plan_status: 'draft', plan_published_at: null }, attendances, members),
    ).toEqual([])
  })
})
