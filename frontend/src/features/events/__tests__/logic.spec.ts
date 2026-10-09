import { describe, expect, it } from 'vitest'
import { member } from '@/features/squad/__tests__/squad.spec'
import {
  canRespond,
  deadlineFromHours,
  generateMultiWeekdayOccurrences,
  generateSeriesOccurrences,
  responseState,
  splitEvents,
  summarizeAttendance,
  unansweredEvents,
  type Attendance,
  type TeamEvent,
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
