import { describe, expect, it } from 'vitest'
import type { TeamEvent } from '@/features/events/logic'
import type { DrillGroups } from '@/features/groups/api'
import {
  coachTasks,
  myGroupsByDrill,
  nextEvent,
  relativeDay,
  stripDays,
  unassignedYes,
} from '../logic'

const local = (d: number, h = 19) => new Date(2030, 0, d, h, 0)

function event(id: string, startsAt: Date, overrides: Partial<TeamEvent> = {}): TeamEvent {
  return {
    id,
    starts_at: startsAt.toISOString(),
    ends_at: null,
    is_cancelled: false,
    match_squad: [],
    attendances: [],
    ...overrides,
  } as TeamEvent
}

describe('nextEvent', () => {
  const now = local(10, 12)

  it('picks the earliest upcoming event, skipping cancelled and finished ones', () => {
    const result = nextEvent(
      [
        event('later', local(14)),
        event('cancelled', local(11), { is_cancelled: true }),
        event('done', local(9)),
        event('next', local(12)),
      ],
      now,
    )
    expect(result?.id).toBe('next')
  })

  it('keeps a running event as next', () => {
    expect(nextEvent([event('running', local(10, 11))], now)?.id).toBe('running')
  })

  it('returns null without upcoming events', () => {
    expect(nextEvent([], now)).toBeNull()
  })
})

describe('relativeDay', () => {
  const now = local(10, 8)
  it.each([
    [local(10, 19), 'today'],
    [local(11, 19), 'tomorrow'],
    [local(13, 19), 'inDays'],
    [local(20, 19), 'date'],
  ])('%s -> %s', (date, kind) => {
    expect(relativeDay(date.toISOString(), now).kind).toBe(kind)
  })
})

describe('myGroupsByDrill', () => {
  it('finds the own group per drill', () => {
    const drills: DrillGroups[] = [
      {
        id: 'ed1',
        position: 1,
        drill: { id: 'd1', title: 'Rondo' },
        groups: [
          { id: 'g1', name: 'Rot', color: 'red', created_at: '', member_ids: ['me'] },
          { id: 'g2', name: 'Blau', color: 'blue', created_at: '', member_ids: ['x'] },
        ],
      },
      { id: 'ed2', position: 2, drill: { id: 'd2', title: 'Spiel' }, groups: [] },
    ]
    const map = myGroupsByDrill(drills, 'me')
    expect(map.get('ed1')?.color).toBe('red')
    expect(map.has('ed2')).toBe(false)
    expect(myGroupsByDrill(drills, null).size).toBe(0)
  })
})

describe('stripDays', () => {
  it('starts today and covers the next seven days, also on a Sunday', () => {
    // Sunday, 25 October 2026: the next training on Tuesday must be in the strip.
    const days = stripDays(new Date(2026, 9, 25, 9))
    expect(days).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ])
  })

  it('runs across the end of a month on a Saturday', () => {
    expect(stripDays(new Date(2026, 9, 31, 23))).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ])
  })
})

describe('coachTasks', () => {
  // Saturday 10 January 2030, noon.
  const now = local(10, 12)
  const players = ['p1', 'p2', 'p3', 'p4']
  const yes = (id: string) => ({ member_id: id, status: 'yes' }) as TeamEvent['attendances'][number]

  it('lists the plan of a training soon, a match without squad and missing answers', () => {
    const tasks = coachTasks(
      [
        event('match', local(14), { type: 'match', match_squad: [] }),
        event('training', local(11), { type: 'training', plan_status: 'draft' }),
        event('later', local(20), { type: 'training', plan_status: 'draft' }),
        event('done', local(12, 19), {
          type: 'training',
          plan_status: 'published',
          attendances: players.map(yes),
        }),
      ],
      players,
      now,
    )
    expect(tasks.map((t) => `${t.kind}:${t.event.id}`)).toEqual([
      'plan:training',
      'answers:training',
      'squad:match',
      'answers:match',
    ])
    expect(tasks.find((t) => t.kind === 'answers')).toMatchObject({ count: 4 })
  })

  it('skips cancelled events, picked squads and events past the deadline', () => {
    const tasks = coachTasks(
      [
        event('cancelled', local(11), {
          type: 'training',
          plan_status: 'draft',
          is_cancelled: true,
        }),
        event('picked', local(13), {
          type: 'match',
          match_squad: [{ member_id: 'p1' }] as TeamEvent['match_squad'],
          response_deadline: local(10, 11).toISOString(),
        }),
      ],
      players,
      now,
    )
    expect(tasks).toEqual([])
  })
})

describe('unassignedYes', () => {
  it('finds players who said yes but miss in a drill with groups', () => {
    const drills = [
      { id: 'd1', position: 1, drill: { id: 'x', title: 'Warm-up' }, groups: [] },
      {
        id: 'd2',
        position: 2,
        drill: { id: 'y', title: 'Rondo' },
        groups: [{ id: 'g', name: 'Rot', color: 'red', created_at: '', member_ids: ['p1'] }],
      },
    ] as DrillGroups[]
    const attendances = [
      { member_id: 'p1', status: 'yes' },
      { member_id: 'p2', status: 'yes' },
      { member_id: 'p3', status: 'maybe' },
    ] as TeamEvent['attendances']
    expect(unassignedYes(drills, attendances)).toEqual(['p2'])
  })
})
