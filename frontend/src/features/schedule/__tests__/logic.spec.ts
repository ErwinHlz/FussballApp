import { describe, expect, it } from 'vitest'
import {
  bookingCovers,
  bookingsOn,
  freeParts,
  halfHours,
  occupant,
  openDates,
  possibleDurations,
  rangeFree,
  seasonEnd,
  teamShortName,
  timeStarted,
  weekDates,
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
  it('weeks start on Monday; only Monday to Friday can be booked', () => {
    expect(weekDates(new Date(2026, 9, 15))[0]).toBe('2026-10-12')
    expect(openDates(new Date(2026, 9, 15))).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ])
  })

  it('has half-hour rows from 15:00 to 20:30', () => {
    const rows = halfHours()
    expect(rows).toHaveLength(11)
    expect(rows[0]).toBe('15:00')
    expect(rows.at(-1)).toBe('20:00')
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
