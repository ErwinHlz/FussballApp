import { describe, expect, it } from 'vitest'
import {
  bookableTime,
  bookingCovers,
  bookingProblem,
  bookingsOn,
  freeParts,
  halfHours,
  matchesOn,
  occupant,
  overlaps,
  pitchFromLocation,
  placeLabel,
  possibleDurations,
  rangeFree,
  seasonEnd,
  teamShortName,
  timeStarted,
  weekDates,
  type PitchMatch,
  type SlotBooking,
} from '../logic'

// 2026-10-13 is a Tuesday (weekday 2).
const booking = (patch: Partial<SlotBooking> = {}): SlotBooking => ({
  id: 'b1',
  club_id: 'c',
  pitch_id: 'p',
  team_id: 't1',
  part: 'a',
  weekday: 2,
  start_time: '17:00:00',
  end_time: '18:30:00',
  valid_from: '2026-10-01',
  valid_until: '2027-06-30',
  created_by: null,
  created_at: '',
  exceptions: [],
  ...patch,
})

describe('week and rows', () => {
  it('shows Monday to Sunday; on a Sunday that is the running week', () => {
    expect(weekDates(new Date(2026, 9, 15))).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ])
    expect(weekDates(new Date(2026, 9, 25))[6]).toBe('2026-10-25')
  })

  it('books only Monday to Friday between 15:00 and 20:30', () => {
    expect(bookableTime('2026-10-16', '15:00')).toBe(true)
    expect(bookableTime('2026-10-16', '20:00')).toBe(true)
    expect(bookableTime('2026-10-16', '20:30')).toBe(false)
    expect(bookableTime('2026-10-16', '14:30')).toBe(false)
    expect(bookableTime('2026-10-17', '16:00')).toBe(false)
    expect(bookableTime('2026-10-18', '16:00')).toBe(false)
  })

  it('has half-hour rows from 15:00 to 20:30', () => {
    const rows = halfHours()
    expect(rows).toHaveLength(11)
    expect(rows[0]).toBe('15:00')
    expect(rows.at(-1)).toBe('20:00')
  })

  it('widens the rows for a match in the morning or late evening', () => {
    const rows = halfHours([
      { part: 'full', start_time: '10:30', end_time: '13:00' },
      { part: 'a', start_time: '20:00', end_time: '22:00' },
    ])
    expect(rows[0]).toBe('10:30')
    expect(rows.at(-1)).toBe('21:30')
  })
})

describe('bookings on a day', () => {
  it('covers its weekday inside the range, except released dates', () => {
    expect(bookingCovers(booking(), '2026-10-13')).toBe(true)
    expect(bookingCovers(booking(), '2026-10-14')).toBe(false)
    expect(bookingCovers(booking({ exceptions: [{ date: '2026-10-13' }] }), '2026-10-13')).toBe(
      false,
    )
    expect(bookingsOn([booking(), booking({ pitch_id: 'q' })], 'p', '2026-10-13')).toHaveLength(1)
  })

  it('finds who holds a half hour; the whole pitch blocks both halves', () => {
    const day = [
      booking(),
      booking({ id: 'b2', part: 'full', start_time: '19:00:00', end_time: '20:00:00' }),
    ]
    expect(occupant(day, 'a', '17:30')?.id).toBe('b1')
    expect(occupant(day, 'b', '17:30')).toBeNull()
    expect(occupant(day, 'a', '18:30')).toBeNull()
    expect(occupant(day, 'b', '19:30')?.id).toBe('b2')
  })
})

describe('booking a range', () => {
  const day = [booking()] // half A 17:00–18:30

  it('offers durations up to the next booking or 20:30', () => {
    expect(possibleDurations(day, 'a', '16:00')).toEqual([30, 60])
    expect(possibleDurations(day, 'b', '19:30')).toEqual([30, 60])
    expect(possibleDurations(day, 'full', '17:00')).toEqual([])
  })

  it('offers the parts that are free for the whole range', () => {
    expect(freeParts(day, true, '17:00', '18:00')).toEqual(['b'])
    expect(freeParts(day, true, '18:30', '20:00')).toEqual(['full', 'a', 'b'])
    expect(freeParts(day, false, '15:00', '16:00')).toEqual(['full'])
    expect(rangeFree(day, 'a', '18:30', '19:00')).toBe(true)
  })

  it('knows the season end and past times', () => {
    expect(seasonEnd('2026-10-13')).toBe('2027-06-30')
    expect(seasonEnd('2027-03-01')).toBe('2027-06-30')
    expect(timeStarted('17:00', '2026-10-13', new Date(2026, 9, 13, 17, 5))).toBe(true)
    expect(timeStarted('17:30', '2026-10-13', new Date(2026, 9, 13, 17, 5))).toBe(false)
  })
})

describe('team short names', () => {
  it('shortens team names for small blocks', () => {
    expect(teamShortName('U17')).toBe('U17')
    expect(teamShortName('Damen')).toBe('DAM')
    expect(teamShortName('U19 II')).toBe('U19')
    expect(teamShortName('Herren 2')).toBe('HER')
  })
})

describe('pitch for a training', () => {
  const pitches = [
    { id: 'p1', name: 'Kunstrasen', splittable: true },
    { id: 'p2', name: 'Rasen', splittable: false },
  ]

  it('labels the place like the database and reads it back', () => {
    expect(placeLabel(pitches[0]!, 'a')).toBe('Kunstrasen · A')
    expect(placeLabel(pitches[1]!, 'full')).toBe('Rasen')
    expect(pitchFromLocation(pitches, 'Kunstrasen · B')).toEqual({ pitchId: 'p1', part: 'b' })
    expect(pitchFromLocation(pitches, 'Rasen')).toEqual({ pitchId: 'p2', part: 'full' })
    expect(pitchFromLocation(pitches, 'Sportpark')).toBeNull()
  })

  it('tells why a time cannot go into the schedule', () => {
    expect(bookingProblem(2, '17:00', 90)).toBeNull()
    expect(bookingProblem(6, '17:00', 90)).toBe('weekday')
    expect(bookingProblem(2, '19:30', 90)).toBe('time')
    expect(bookingProblem(2, '14:30', 60)).toBe('time')
    expect(bookingProblem(2, '17:15', 60)).toBe('step')
    expect(bookingProblem(2, '17:00', 75)).toBe('step')
  })
})

describe('home matches', () => {
  const local = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString()
  const match = (patch: Partial<PitchMatch> = {}): PitchMatch => ({
    id: 'm1',
    team_id: 't1',
    pitch_id: 'p',
    pitch_part: 'a',
    opponent: 'FC Gast',
    starts_at: local(17, 11),
    occupied_from: local(17, 10, 15),
    occupied_until: local(17, 13),
    ...patch,
  })

  it('places a match on its pitch and day in whole half hours', () => {
    const day = matchesOn([match(), match({ id: 'm2', pitch_id: 'q' })], 'p', '2026-10-17')
    expect(day.map((m) => [m.match.id, m.part, m.start_time, m.end_time])).toEqual([
      ['m1', 'a', '10:00', '13:00'],
    ])
    expect(matchesOn([match()], 'p', '2026-10-18')).toEqual([])
  })

  it('holds the lane like a booking and clashes with trainings on the same part', () => {
    const [m] = matchesOn([match()], 'p', '2026-10-17')
    expect(occupant([m!], 'a', '12:30')?.match.id).toBe('m1')
    expect(occupant([m!], 'b', '12:30')).toBeNull()
    const training = { part: 'full' as const, start_time: '12:30', end_time: '14:00' }
    expect(overlaps(m!, training)).toBe(true)
    expect(overlaps(m!, { ...training, start_time: '13:00' })).toBe(false)
    expect(possibleDurations([m!], 'full', '09:00')).toEqual([30, 60])
  })
})
