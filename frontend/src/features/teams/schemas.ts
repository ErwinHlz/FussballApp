import { z } from 'zod'

// Messages are i18n keys, translated in the view.
export const clubSchema = z.object({
  name: z
    .string({ required_error: 'validation.required' })
    .trim()
    .min(2, 'validation.minLength2')
    .max(80, 'validation.maxLength80'),
})

export const teamSchema = z.object({
  name: z
    .string({ required_error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .max(60, 'validation.maxLength60'),
  season: z.string().trim().max(20, 'validation.maxLength20').optional(),
})
