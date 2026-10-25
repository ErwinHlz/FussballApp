import { describe, expect, it } from 'vitest'
import { member } from '@/features/squad/__tests__/squad.spec'
import {
  deadlineOffset,
  placeSuggestions,
  shiftTime,
  activeFilterCount,
  attendAllCandidates,
  DEFAULT_EVENT_FILTER,
  filterEvents,
  canRespond,
  deadlineFromHours,
  generateMultiWeekdayOccurrences,
  generateSeriesOccurrences,
  responseState,
  splitEvents,
  squadCandidates,
  summarizeAttendance,
  unavailableNominees,
  unansweredEvents,
  type Attendance,
  type TeamEvent,
  groupByWeek,
  suggestDate,
  suggestDefaults,
} from '../logic'

function local(y: number, m: number, d: number, h = 0, min = 0) {
  return new Date(y, m - 1, d, h, min)
}

function event(overrides: Partial<TeamEvent>): TeamEvent {
  return {
    id: 'e',
    team_id: 't',
    type: 'training',
    series_id: null,
    starts_at: local(2030, 1, 10, 19).toISOString(),
    ends_at: null,
    meet_at: null,
    meet_location: null,
    location: null,
    notes: null,
    response_deadline: null,
    is_cancelled: false,
    cancel_reason: null,
    plan_status: 'draft',
    plan_published_at: null,
    created_by: null,
    reminder_sent_at: null,
    booking_id: null,
    pitch_id: null,
    pitch_part: null,
    title: null,
    opponent: null,
    is_home: null,
    competition: null,
    created_at: '',
    attendances: [],
    match_squad: [],
    ...overrides,
  }
}

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

describe('generateSeriesOccurrences', () => {
  it('creates every matching weekday in the range at the local start time', () => {
    // 2030-01-01 is a Tuesday.
    const dates = generateSeriesOccurrences({
      weekday: 2,
      startTime: '19:00',
      validFrom: '2030-01-01',
      validUntil: '2030-01-31',
    })
    expect(dates).toEqual([
      local(2030, 1, 1, 19),
      local(2030, 1, 8, 19),
      local(2030, 1, 15, 19),
      local(2030, 1, 22, 19),
      local(2030, 1, 29, 19),
    ])
  })

  it('starts at the first matching weekday after the start date', () => {
    const dates = generateSeriesOccurrences({
      weekday: 4, // Thursday
      startTime: '18:30',
      validFrom: '2030-01-01',
      validUntil: '2030-01-10',
    })
    expect(dates).toEqual([local(2030, 1, 3, 18, 30), local(2030, 1, 10, 18, 30)])
  })

  it('keeps the wall-clock time across daylight saving changes', () => {
    // Spans the end of March DST switch in Europe.
    const dates = generateSeriesOccurrences({
      weekday: 2,
      startTime: '19:00',
      validFrom: '2030-03-19',
      validUntil: '2030-04-02',
    })
    expect(dates.map((d) => `${d.getHours()}:${d.getMinutes()}`)).toEqual(['19:0', '19:0', '19:0'])
  })

  it('returns nothing for an empty or inverted range', () => {
    expect(
      generateSeriesOccurrences({
        weekday: 1,
        startTime: '19:00',
        validFrom: '2030-01-02',
        validUntil: '2030-01-06',
      }),
    ).toEqual([])
    expect(
      generateSeriesOccurrences({
        weekday: 1,
        startTime: '19:00',
        validFrom: '2030-02-01',
        validUntil: '2030-01-01',
      }),
    ).toEqual([])
  })

  it('handles several weekdays (Tue + Thu) as separate series, Monday first', () => {
    const series = generateMultiWeekdayOccurrences([4, 2], {
      startTime: '19:00',
      validFrom: '2030-01-01',
      validUntil: '2030-01-07',
    })
    expect(series.map((s) => [s.weekday, s.dates.length])).toEqual([
      [2, 1],
      [4, 1],
    ])
  })
})

describe('response deadline', () => {
  const now = local(2030, 1, 9, 12)

  it('is open before the deadline and before the start', () => {
    expect(
      responseState(event({ response_deadline: local(2030, 1, 9, 18).toISOString() }), now),
    ).toBe('open')
    expect(responseState(event({}), now)).toBe('open')
  })

  it('locks after the deadline for players but not for coaches', () => {
    const e = event({ response_deadline: local(2030, 1, 9, 10).toISOString() })
    expect(responseState(e, now)).toBe('deadlinePassed')
    expect(canRespond(e, false, now)).toBe(false)
    expect(canRespond(e, true, now)).toBe(true)
  })

  it('locks when the event has started (no deadline set)', () => {
    expect(responseState(event({}), local(2030, 1, 10, 19, 1))).toBe('started')
  })

  it('locks cancelled events for everyone', () => {
    const e = event({ is_cancelled: true })
    expect(canRespond(e, false, now)).toBe(false)
    expect(canRespond(e, true, now)).toBe(false)
  })

  it('computes the deadline from hours before the start', () => {
    expect(deadlineFromHours(local(2030, 1, 10, 19), 24)).toEqual(local(2030, 1, 9, 19))
    expect(deadlineFromHours(local(2030, 1, 10, 19), null)).toBeNull()
  })
})

describe('lists and summaries', () => {
  it('splits upcoming (ascending) and past (most recent first)', () => {
    const now = local(2030, 1, 10, 20) // during the 19:00 training (ends 21:00 by default)
    const { upcoming, past } = splitEvents(
      [
        event({ id: 'later', starts_at: local(2030, 1, 12, 19).toISOString() }),
        event({ id: 'running', starts_at: local(2030, 1, 10, 19).toISOString() }),
        event({ id: 'old', starts_at: local(2030, 1, 1, 19).toISOString() }),
        event({ id: 'older', starts_at: local(2029, 12, 1, 19).toISOString() }),
      ],
      now,
    )
    expect(upcoming.map((e) => e.id)).toEqual(['running', 'later'])
    expect(past.map((e) => e.id)).toEqual(['old', 'older'])
  })

  it('groups members by answer, unanswered included', () => {
    const members = [member({ id: 'a' }), member({ id: 'b' }), member({ id: 'c' })]
    const summary = summarizeAttendance(members, [attendance('a', 'yes'), attendance('c', 'no')])
    expect(summary.yes.map((e) => e.member.id)).toEqual(['a'])
    expect(summary.no.map((e) => e.member.id)).toEqual(['c'])
    expect(summary.none.map((e) => e.member.id)).toEqual(['b'])
  })

  it('does not count coaches without an answer as missing', () => {
    const members = [member({ id: 'p' }), member({ id: 'c', role: 'coach' })]
    expect(summarizeAttendance(members, []).none.map((e) => e.member.id)).toEqual(['p'])
    expect(summarizeAttendance(members, [attendance('c', 'yes')]).yes).toHaveLength(1)
  })

  it('reminds only about events within the next 7 days', () => {
    const now = local(2030, 1, 1, 12)
    const soon = event({ id: 'soon', starts_at: local(2030, 1, 7, 19).toISOString() })
    const later = event({ id: 'later', starts_at: local(2030, 1, 20, 19).toISOString() })
    expect(unansweredEvents([soon, later], 'me', now).map((e) => e.id)).toEqual(['soon'])
  })

  it('lists open events the player has not answered', () => {
    const now = local(2030, 1, 9, 12)
    const events = [
      event({ id: 'answered', attendances: [attendance('me', 'yes')] }),
      event({ id: 'open' }),
      event({ id: 'cancelled', is_cancelled: true }),
    ]
    expect(unansweredEvents(events, 'me', now).map((e) => e.id)).toEqual(['open'])
    expect(unansweredEvents(events, null, now)).toEqual([])
  })
})

describe('event filters', () => {
  const now = new Date('2026-10-09T10:00:00Z')
  const answered = {
    id: 'a',
    event_id: 'x',
    member_id: 'me',
    status: 'yes',
    reason: null,
    reason_note: null,
    updated_at: now.toISOString(),
    updated_by: null,
    source_absence_id: null,
  } as TeamEvent['attendances'][number]
  const events = [
    event({ id: 't1', type: 'training', starts_at: '2026-10-12T16:00:00Z' }),
    event({ id: 'm1', type: 'match', opponent: 'FC', starts_at: '2026-10-13T13:00:00Z' }),
    event({ id: 'e1', type: 'event', title: 'Teamabend', starts_at: '2026-12-01T18:00:00Z' }),
    event({
      id: 't2',
      type: 'training',
      starts_at: '2026-10-14T16:00:00Z',
      attendances: [answered],
    }),
    event({ id: 'closed', type: 'training', starts_at: '2026-10-09T09:00:00Z' }),
  ]

  it('filters by type and by own answer', () => {
    expect(
      filterEvents(events, { type: 'training', onlyUnanswered: false }, 'me').map((e) => e.id),
    ).toEqual(['t1', 't2', 'closed'])
    expect(
      filterEvents(events, { type: 'all', onlyUnanswered: true }, 'me').map((e) => e.id),
    ).toEqual(['t1', 'm1', 'e1', 'closed'])
    expect(activeFilterCount({ type: 'event', onlyUnanswered: true })).toBe(2)
    expect(activeFilterCount(DEFAULT_EVENT_FILTER)).toBe(0)
  })

  it('answers all open dates without an answer, also far ahead', () => {
    expect(attendAllCandidates(events, 'me', now).map((e) => e.id)).toEqual(['t1', 'm1', 'e1'])
    expect(attendAllCandidates(events, null, now)).toEqual([])
  })
})

describe('groupByWeek', () => {
  // Thursday, 15 October 2026, local time.
  const now = new Date(2026, 9, 15, 12)
  const at = (month: number, day: number, hour = 18) => ({
    starts_at: new Date(2026, month, day, hour).toISOString(),
  })

  it('groups Monday to Sunday and names this and next week', () => {
    const events = [at(9, 16), at(9, 18, 15), at(9, 19), at(9, 27), at(10, 3)]
    const groups = groupByWeek(events, now)

    expect(groups.map((g) => [g.key, g.kind, g.events.length])).toEqual([
      ['2026-10-12', 'thisWeek', 2],
      ['2026-10-19', 'nextWeek', 1],
      ['2026-10-26', 'week', 1],
      ['2026-11-02', 'week', 1],
    ])
    expect(groups[2]!.end.getDate()).toBe(1)
  })

  it('puts a Sunday evening into the week that started on Monday', () => {
    const groups = groupByWeek([at(9, 18, 23)], now)
    expect(groups[0]!.key).toBe('2026-10-12')
  })
})

describe('quick create defaults', () => {
  const event = (overrides: Record<string, unknown>) =>
    ({
      type: 'training',
      is_cancelled: false,
      created_at: '2026-10-01T10:00:00Z',
      starts_at: new Date(2026, 9, 13, 18, 30).toISOString(),
      ends_at: new Date(2026, 9, 13, 20, 0).toISOString(),
      location: 'Sportpark, Platz 2',
      response_deadline: new Date(2026, 9, 13, 16, 30).toISOString(),
      meet_at: null,
      meet_location: null,
      ...overrides,
    }) as Parameters<typeof suggestDefaults>[0][number]

  it('takes time, length, place and deadline from the last created event of the type', () => {
    const older = event({ created_at: '2026-09-01T10:00:00Z', location: 'Alt' })
    const match = event({ type: 'match', created_at: '2026-10-05T10:00:00Z' })
    expect(suggestDefaults([older, event({}), match], 'training')).toEqual({
      time: '18:30',
      durationMin: 90,
      location: 'Sportpark, Platz 2',
      deadlineHours: 2,
      meetOffsetMin: null,
      meetLocation: null,
      weekday: 2,
    })
  })

  it('remembers how long before kick-off a match team meets', () => {
    const match = event({
      type: 'match',
      starts_at: new Date(2026, 9, 18, 15).toISOString(),
      ends_at: null,
      meet_at: new Date(2026, 9, 18, 13, 45).toISOString(),
      meet_location: 'Vereinsheim',
      response_deadline: null,
    })
    const defaults = suggestDefaults([match], 'match')
    expect(defaults.meetOffsetMin).toBe(75)
    expect(defaults.meetLocation).toBe('Vereinsheim')
    expect(defaults.deadlineHours).toBeNull()
  })

  it('falls back to sensible values without earlier events', () => {
    expect(suggestDefaults([], 'match').time).toBe('15:00')
    expect(suggestDefaults([event({ is_cancelled: true })], 'training').location).toBeNull()
  })

  it('suggests the next date on the same weekday, starting tomorrow', () => {
    const thursday = new Date(2026, 9, 15, 12)
    expect(suggestDate(2, thursday)).toBe('2026-10-20')
    expect(suggestDate(5, thursday)).toBe('2026-10-16')
    expect(suggestDate(4, thursday)).toBe('2026-10-22')
    expect(suggestDate(null, thursday)).toBe('2026-10-16')
  })
})

describe('placeSuggestions', () => {
  it('lists event and meeting places, newest first, without duplicates', () => {
    const events = [
      { starts_at: '2026-10-01T18:00:00Z', location: 'Sportpark', meet_location: null },
      { starts_at: '2026-10-10T13:00:00Z', location: 'Waldstadion', meet_location: 'Vereinsheim' },
      { starts_at: '2026-10-05T18:00:00Z', location: ' sportpark ', meet_location: '' },
    ]
    expect(placeSuggestions(events)).toEqual(['Waldstadion', 'Vereinsheim', 'sportpark'])
  })
})

describe('shiftTime', () => {
  it('moves a time and wraps around midnight', () => {
    expect(shiftTime('15:00', -75)).toBe('13:45')
    expect(shiftTime('00:30', -60)).toBe('23:30')
  })
})

describe('deadlineOffset', () => {
  it('shows whole days as days', () => {
    expect(deadlineOffset(48)).toEqual({ unit: 'days', n: 2 })
    expect(deadlineOffset(24)).toEqual({ unit: 'days', n: 1 })
    expect(deadlineOffset(6)).toEqual({ unit: 'hours', n: 6 })
    expect(deadlineOffset(30)).toEqual({ unit: 'hours', n: 30 })
  })
})

describe('squadCandidates', () => {
  const players = [
    member({ id: 'p1', shirt_number: 1 }),
    member({ id: 'p2', shirt_number: 2 }),
    member({ id: 'p3', shirt_number: 3 }),
    member({ id: 'p4', shirt_number: 4 }),
    member({ id: 'p5', shirt_number: 5 }),
    member({ id: 'c', role: 'coach', shirt_number: null }),
  ]
  const answers = [attendance('p2', 'yes'), attendance('p3', 'no'), attendance('p4', 'maybe')]

  it('offers yes and maybe, keeps nominated players and puts unavailable ones last', () => {
    const nominated = new Set(['p1', 'p3'])
    const result = squadCandidates(players, answers, nominated)
    expect(result.map((c) => [c.member.id, c.status])).toEqual([
      ['p2', 'yes'],
      ['p4', 'maybe'],
      ['p1', null],
      ['p3', 'no'],
    ])
    expect(unavailableNominees(result, nominated).map((c) => c.member.id)).toEqual(['p1', 'p3'])
  })

  it('has no warning when every nominee said yes or maybe', () => {
    const nominated = new Set(['p2', 'p4'])
    expect(unavailableNominees(squadCandidates(players, answers, nominated), nominated)).toEqual([])
  })
})
