import { z } from 'zod'

// Messages are i18n keys, translated in the view.
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .email('validation.email'),
})

export const profileSchema = z.object({
  displayName: z
    .string({ required_error: 'validation.required' })
    .trim()
    .min(2, 'validation.minLength2')
    .max(60, 'validation.maxLength60'),
})

export type LoginForm = z.infer<typeof loginSchema>
export type ProfileForm = z.infer<typeof profileSchema>
