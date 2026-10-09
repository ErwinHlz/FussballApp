import { differenceInCalendarDays, parseISO } from 'date-fns'
import { z } from 'zod'

// Messages are i18n keys, translated in the view.
const time = z
  .string({ required_error: 'validation.required' })
  .regex(/^\d{2}:\d{2}$/, 'validation.required')
const date = z
  .string({ required_error: 'validation.required' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.required')

export const pitchSchema = z.object({
  name: z
    .string({ required_error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .max(60, 'validation.maxLength60'),
  splittable: z.boolean(),
})

const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))

export const slotSchema = z
  .object({
    weekdays: z.array(z.string()).min(1, 'validation.weekdays'),
    startTime: time,
    endTime: time,
    validFrom: date,
    validUntil: date,
  })
  .refine((v) => minutes(v.endTime) - minutes(v.startTime) >= 15, {
    message: 'validation.endAfterStart',
    path: ['endTime'],
  })
  .refine((v) => v.validUntil >= v.validFrom, {
    message: 'validation.dateRange',
    path: ['validUntil'],
  })
  .refine((v) => differenceInCalendarDays(parseISO(v.validUntil), parseISO(v.validFrom)) <= 400, {
    message: 'validation.seriesTooLong',
    path: ['validUntil'],
  })
