import { z } from 'zod'

// Messages are i18n keys, translated in the view.

export const pitchSchema = z.object({
  name: z
    .string({ required_error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .max(60, 'validation.maxLength60'),
  splittable: z.boolean(),
})
