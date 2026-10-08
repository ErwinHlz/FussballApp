import { z } from 'zod'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { COMPETITIONS } from './logic'

// Messages are i18n keys, translated in the view.
const date = z
  .string({ required_error: 'validation.required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.required')
const time = z
  .string({ required_error: 'validation.required' })
  .regex(/^\d{2}:\d{2}$/, 'validation.required')
const optionalTime = z.union([z.literal(''), z.string().regex(/^\d{2}:\d{2}$/)]).optional()
const optionalText = (max: number) =>
  z.string().trim().max(max, `validation.maxLength${max}`).optional()
const duration = z
  .string({ required_error: 'validation.required' })
  .regex(/^\d+$/, 'validation.duration')
  .refine((v) => Number(v) >= 15 && Number(v) <= 600, 'validation.duration')
/** "none" or a number of hours before the start. */
const deadline = z.string()

export const trainingSchema = z.object({
  date,
  startTime: time,
  durationMin: duration,
  location: optionalText(120),
  notes: optionalText(2000),
  deadline,
})

export const seriesSchema = z
  .object({
    weekdays: z.array(z.string()).min(1, 'validation.weekdays'),
    startTime: time,
    durationMin: duration,
    location: optionalText(120),
    validFrom: date,
    validUntil: date,
    deadline,
  })
  .refine((v) => v.validUntil >= v.validFrom, {
    message: 'validation.dateRange',
    path: ['validUntil'],
  })
  .refine((v) => differenceInCalendarDays(parseISO(v.validUntil), parseISO(v.validFrom)) <= 366, {
    message: 'validation.seriesTooLong',
    path: ['validUntil'],
  })

export const matchSchema = z.object({
  opponent: z
    .string({ required_error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .max(80, 'validation.maxLength80'),
  venue: z.enum(['home', 'away']),
  competition: z.enum(COMPETITIONS),
  date,
  kickoffTime: time,
  meetTime: optionalTime,
  meetLocation: optionalText(120),
  location: optionalText(120),
  notes: optionalText(2000),
  deadline,
})

export function combineDateTime(date: string, time: string): Date {
  // "yyyy-MM-ddTHH:mm" without zone is parsed as local time.
  return new Date(`${date}T${time}`)
}

export function parseDeadline(value: string): number | null {
  return value === 'none' ? null : Number(value)
}
