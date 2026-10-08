import { z } from 'zod'
import { DRILL_CATEGORIES, parseYouTubeId } from './logic'

// Messages are i18n keys, translated in the view. Numbers come from text inputs.
const optionalCount = (max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= max), message)
    .optional()

export const drillSchema = z
  .object({
    title: z
      .string({ required_error: 'validation.required' })
      .trim()
      .min(2, 'validation.minLength2')
      .max(80, 'validation.maxLength80'),
    description: z.string().max(4000, 'validation.maxLength4000').optional(),
    category: z.enum(DRILL_CATEGORIES),
    durationMin: optionalCount(180, 'validation.drillDuration'),
    minPlayers: optionalCount(40, 'validation.players'),
    maxPlayers: optionalCount(40, 'validation.players'),
    equipment: z.string().max(400, 'validation.maxLength400').optional(),
    videoUrl: z
      .string()
      .trim()
      .refine((v) => v === '' || parseYouTubeId(v) !== null, 'validation.youtube')
      .optional(),
  })
  .refine((v) => !v.minPlayers || !v.maxPlayers || Number(v.minPlayers) <= Number(v.maxPlayers), {
    message: 'validation.playersRange',
    path: ['maxPlayers'],
  })

export function toCount(value: string | undefined): number | null {
  return value ? Number(value) : null
}
