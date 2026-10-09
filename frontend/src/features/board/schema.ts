import { z } from 'zod'

/**
 * Tactics board animation, stored in drills.animation (PLAN.md section 6).
 * Coordinates are percentages (0–100) of the field, so it fits every screen size.
 */
export const FIELD_TYPES = ['full', 'half', 'quarter'] as const
export const OBJECT_TYPES = [
  // People
  'player',
  'goalkeeper',
  'coach',
  'ball',
  // Equipment
  'cone',
  'disc',
  'pole',
  'dummy',
  'minigoal',
  'goal',
  'ladder',
  'ring',
  // Zones and markings
  'zone',
  'text',
] as const
export const ARROW_STYLES = ['run', 'pass', 'dribble', 'line'] as const
export const ZONE_SHAPES = ['rect', 'circle'] as const

/** Objects that can carry the ball. */
export const BALL_CARRIERS: readonly ObjectType[] = ['player', 'goalkeeper', 'coach']
/** Objects whose orientation matters. */
export const ROTATABLE: readonly ObjectType[] = [
  'dummy',
  'minigoal',
  'goal',
  'ladder',
  'zone',
  'text',
]
/** Objects that take a color. */
export const COLORED: readonly ObjectType[] = [
  'player',
  'goalkeeper',
  'cone',
  'disc',
  'pole',
  'ring',
  'zone',
]

export const MAX_OBJECTS = 60
export const MAX_KEYFRAMES = 30
export const MAX_DURATION_MS = 60_000

const coordinate = z.number().min(0).max(100)
export const pointSchema = z.tuple([coordinate, coordinate])
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const boardObjectSchema = z.object({
  id: z.string().min(1).max(20),
  type: z.enum(OBJECT_TYPES),
  color: color.optional(),
  /** Jersey number (players). */
  label: z.string().max(3).optional(),
  /** Name shown below a player, e.g. from the squad. */
  name: z.string().max(16).optional(),
  /** Degrees, clockwise. */
  rotation: z.number().int().min(0).max(359).optional(),
  /** Zone size in meters. */
  w: z.number().min(1).max(105).optional(),
  h: z.number().min(1).max(105).optional(),
  shape: z.enum(ZONE_SHAPES).optional(),
  /** Text objects. */
  text: z.string().max(40).optional(),
})

export const keyframeSchema = z.object({
  t: z.number().int().min(0).max(MAX_DURATION_MS),
  positions: z.record(z.string(), pointSchema),
  /** Ball id -> carrier id (null = loose). Missing balls keep their last carrier. */
  holders: z.record(z.string(), z.string().nullable()).optional(),
})

export const annotationSchema = z.object({
  type: z.literal('arrow'),
  from: pointSchema,
  to: pointSchema,
  style: z.enum(ARROW_STYLES),
})

export const animationSchema = z
  .object({
    version: z.literal(1),
    field: z.enum(FIELD_TYPES),
    durationMs: z.number().int().min(500).max(MAX_DURATION_MS),
    objects: z.array(boardObjectSchema).max(MAX_OBJECTS),
    keyframes: z.array(keyframeSchema).min(1).max(MAX_KEYFRAMES),
    annotations: z.array(annotationSchema).max(40).default([]),
  })
  .superRefine((a, ctx) => {
    const ids = new Set<string>()
    for (const o of a.objects) {
      if (ids.has(o.id)) ctx.addIssue({ code: 'custom', message: `duplicate object id ${o.id}` })
      ids.add(o.id)
    }
    if (a.keyframes[0]?.t !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'first keyframe must be at t = 0',
        path: ['keyframes'],
      })
    }
    a.keyframes.forEach((k, i) => {
      const prev = a.keyframes[i - 1]
      if (prev && k.t <= prev.t) {
        ctx.addIssue({
          code: 'custom',
          message: 'keyframes must be strictly increasing',
          path: ['keyframes', i],
        })
      }
      if (k.t > a.durationMs) {
        ctx.addIssue({ code: 'custom', message: 'keyframe after the end', path: ['keyframes', i] })
      }
      for (const id of Object.keys(k.positions)) {
        if (!ids.has(id)) {
          ctx.addIssue({ code: 'custom', message: `unknown object ${id}`, path: ['keyframes', i] })
        }
      }
      for (const [ball, carrier] of Object.entries(k.holders ?? {})) {
        if (!ids.has(ball) || (carrier !== null && !ids.has(carrier))) {
          ctx.addIssue({
            code: 'custom',
            message: `unknown holder ${ball}`,
            path: ['keyframes', i],
          })
        }
      }
    })
  })

export type Point = z.infer<typeof pointSchema>
export type BoardObject = z.infer<typeof boardObjectSchema>
export type Keyframe = z.infer<typeof keyframeSchema>
export type Annotation = z.infer<typeof annotationSchema>
export type Animation = z.infer<typeof animationSchema>
export type FieldType = (typeof FIELD_TYPES)[number]
export type ObjectType = (typeof OBJECT_TYPES)[number]
export type ArrowStyle = (typeof ARROW_STYLES)[number]

/** Parses stored JSON; returns null for missing or invalid animations (never throws). */
export function parseAnimation(value: unknown): Animation | null {
  if (value === null || value === undefined) return null
  const result = animationSchema.safeParse(value)
  return result.success ? result.data : null
}

export function emptyAnimation(field: FieldType = 'half'): Animation {
  return {
    version: 1,
    field,
    durationMs: 6000,
    objects: [],
    keyframes: [{ t: 0, positions: {} }],
    annotations: [],
  }
}
