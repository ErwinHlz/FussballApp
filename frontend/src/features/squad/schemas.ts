import { z } from 'zod'
import { MEMBER_STATUSES, POSITIONS } from './squad'

// Messages are i18n keys, translated in the view.
export const memberSchema = z.object({
  displayName: z
    .string({ required_error: 'validation.required' })
    .trim()
    .min(1, 'validation.required')
    .max(60, 'validation.maxLength60'),
  // Kept as string because it comes from a text input; empty = no number.
  shirtNumber: z
    .string()
    .trim()
    .regex(/^\d{0,2}$/, 'validation.shirtNumber')
    .optional(),
  positions: z.array(z.enum(POSITIONS)),
  status: z.enum(MEMBER_STATUSES),
  role: z.enum(['coach', 'player']),
})

export type MemberForm = z.infer<typeof memberSchema>

export function parseShirtNumber(value: string | undefined): number | null {
  return value ? Number(value) : null
}
