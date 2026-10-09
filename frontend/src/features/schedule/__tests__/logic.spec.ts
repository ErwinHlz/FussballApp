import { describe, expect, it } from 'vitest'
import {
  bookingCovers,
  defaultSeason,
  freeParts,
  slotCells,
  slotStarted,
  slotsOn,
  weekDates,
  type PitchSlot,
  type SlotBooking,
} from '../logic'

// 2026-10-13 is a Tuesday (weekday 2).
const slot = (patch: Partial<PitchSlot> = {}): PitchSlot => ({
  id: 's1',
  club_id: 'c',
  pitch_id: 'p',
  weekday: 2,
  start_time: '17:00:00',
  end_time: '18:30:00',
  valid_from: '2026-09-01',
  valid_until: '2027-06-30',
  created_at: '',
  ...patch,
})

const booking = (patch: Partial<SlotBooking> = {}): SlotBooking => ({
  id: 'b1',
  club_id: 'c',
  slot_id: 's1',
  team_id: 't1',
  part: 'a',
  valid_from: '2026-10-06',
  valid_until: '2027-06-29',
  created_by: null,
  created_at: '',
  exceptions: [],
  ...patch,
})

describe('weekDates', () => {
  it('runs from Monday to Sunday', () => {
    expect(weekDates(new Date(2026, 9, 15))).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ])
  })
})

describe('slotsOn', () => {
  it('returns the slots of the weekday inside their season, by time', () => {
    const late = slot({ id: 'late', start_time: '19:00:00' })
    const other = slot({ id: 'mon', weekday: 1 })
    const ended = slot({ id: 'old', valid_until: '2026-10-01' })
    expect(slotsOn([late, slot(), other, ended], '2026-10-13').map((s) => s.id)).toEqual([
      's1',
      'late',
    ])
  })
})

describe('bookingCovers', () => {
  it('respects the range and released dates', () => {
    const b = booking({ exceptions: [{ date: '2026-10-20' }] })
    expect(bookingCovers(b, '2026-10-13')).toBe(true)
    expect(bookingCovers(b, '2026-10-20')).toBe(false)
    expect(bookingCovers(b, '2026-09-29')).toBe(false)
  })
})

describe('slotCells', () => {
  it('shows two halves on a splittable pitch', () => {
    const cells = slotCells(slot(), { splittable: true }, [booking()], '2026-10-13')
    expect(cells.map((c) => [c.part, c.booking?.team_id ?? null])).toEqual([
      ['a', 't1'],
      ['b', null],
    ])
    expect(freeParts(cells, true)).toEqual(['b'])
  })

  it('shows one cell for a full booking', () => {
    const cells = slotCells(slot(), { splittable: true }, [booking({ part: 'full' })], '2026-10-13')
    expect(cells).toHaveLength(1)
    expect(freeParts(cells, true)).toEqual([])
  })

  it('offers the whole pitch and both halves when nothing is booked', () => {
    const cells = slotCells(slot(), { splittable: true }, [], '2026-10-13')
    expect(freeParts(cells, true)).toEqual(['full', 'a', 'b'])
  })

  it('shows one cell for pitches that cannot be split', () => {
    const cells = slotCells(slot(), { splittable: false }, [], '2026-10-13')
    expect(cells).toEqual([{ part: 'full', booking: null }])
    expect(freeParts(cells, false)).toEqual(['full'])
  })

  it('ignores released dates and other slots', () => {
    const released = booking({ exceptions: [{ date: '2026-10-13' }] })
    const elsewhere = booking({ id: 'b2', slot_id: 'other', part: 'b' })
    const cells = slotCells(slot(), { splittable: true }, [released, elsewhere], '2026-10-13')
    expect(cells.every((c) => c.booking === null)).toBe(true)
  })
})

describe('slotStarted', () => {
  it('compares the local start time', () => {
    const now = new Date(2026, 9, 13, 17, 30)
    expect(slotStarted(slot(), '2026-10-13', now)).toBe(true)
    expect(slotStarted(slot({ start_time: '18:00:00' }), '2026-10-13', now)).toBe(false)
  })
})

describe('defaultSeason', () => {
  it('ends on the next 30 June', () => {
    expect(defaultSeason(new Date(2026, 9, 9))).toEqual({ from: '2026-10-09', until: '2027-06-30' })
    expect(defaultSeason(new Date(2027, 2, 1))).toEqual({ from: '2027-03-01', until: '2027-06-30' })
  })
})
