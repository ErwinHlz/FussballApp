import { z } from 'zod'

// Messages are i18n keys, translated in the view.
export const MIN_PASSWORD_LENGTH = 8

const email = z
  .string({ required_error: 'validation.required' })
  .trim()
  .min(1, 'validation.required')
  .email('validation.email')

const newPassword = z
  .string({ required_error: 'validation.required' })
  .min(MIN_PASSWORD_LENGTH, 'validation.passwordMin')
  .max(72, 'validation.passwordMax')

const displayName = z
  .string({ required_error: 'validation.required' })
  .trim()
  .min(2, 'validation.minLength2')
  .max(60, 'validation.maxLength60')

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: 'validation.required' }).min(1, 'validation.required'),
})

export const registerSchema = z
  .object({
    displayName,
    email,
    password: newPassword,
    passwordConfirm: z.string({ required_error: 'validation.required' }),
    // Privacy policy read and age 16+ or parental consent (Art. 8 GDPR).
    consent: z.literal(true, {
      errorMap: () => ({ message: 'validation.consent' }),
    }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirm'],
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    passwordConfirm: z.string({ required_error: 'validation.required' }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirm'],
  })

export const profileSchema = z.object({ displayName })
