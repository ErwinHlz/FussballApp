import { ballOffset } from './geometry'
import type { Animation, Keyframe, Point } from './schema'

export type Positions = Record<string, Point>
export type Easing = (progress: number) => number

export const linear: Easing = (p) => p
export const easeInOut: Easing = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)

/**
 * Fills every keyframe with a position for every object:
 * an object missing in a keyframe keeps its last known position (it stands still).
 * Before its first appearance an object uses that first position.
 * A carried ball sits at its carrier's feet; carriers persist like positions, so a pass is
 * simply a new carrier in a later keyframe (the ball travels between the two).
 */
export function resolveKeyframes(
  animation: Pick<Animation, 'objects' | 'keyframes'> & Partial<Pick<Animation, 'field'>>,
): Keyframe[] {
  const last: Positions = {}
  const carrier: Record<string, string | null> = {}
  const offset = ballOffset(animation.field ?? 'half')
  const clamp = (v: number) => Math.min(100, Math.max(0, v))
  // Seed with the first known position so objects appearing later are not undefined.
  for (const k of animation.keyframes) {
    for (const [id, p] of Object.entries(k.positions)) last[id] ??= p
  }
  return animation.keyframes.map((k) => {
    const positions: Positions = {}
    for (const o of animation.objects) {
      const own = k.positions[o.id]
      if (own) last[o.id] = own
      const p = last[o.id]
      if (p) positions[o.id] = p
    }
    for (const [ball, holder] of Object.entries(k.holders ?? {})) carrier[ball] = holder
    for (const [ball, holder] of Object.entries(carrier)) {
      const at = holder ? positions[holder] : undefined
      if (!at || !positions[ball]) continue
      positions[ball] = [clamp(at[0] + offset[0]), clamp(at[1] + offset[1])]
      // A ball released later starts from where it was carried.
      last[ball] = positions[ball]
    }
    return { t: k.t, positions }
  })
}

/** Carrier of each ball in a keyframe (after applying all earlier keyframes). */
export function holdersAt(
  animation: Pick<Animation, 'keyframes'>,
  keyframeIndex: number,
): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  animation.keyframes.slice(0, keyframeIndex + 1).forEach((k) => Object.assign(result, k.holders))
  return result
}

function lerp(a: Point, b: Point, f: number): Point {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** Positions of all objects at time t (ms), linearly interpolated between keyframes. */
export function positionsAt(
  animation: Pick<Animation, 'objects' | 'keyframes' | 'durationMs'>,
  t: number,
  easing: Easing = linear,
  resolved: Keyframe[] = resolveKeyframes(animation),
): Positions {
  if (!resolved.length) return {}
  const time = Math.min(Math.max(t, 0), animation.durationMs)

  const index = resolved.findIndex((k) => k.t > time)
  if (index === -1) return { ...resolved.at(-1)!.positions } // after the last keyframe
  if (index === 0) return { ...resolved[0]!.positions }

  const from = resolved[index - 1]!
  const to = resolved[index]!
  const f = easing((time - from.t) / (to.t - from.t))
  const result: Positions = {}
  for (const [id, p] of Object.entries(from.positions)) {
    const target = to.positions[id]
    result[id] = target ? lerp(p, target, f) : p
  }
  return result
}

/** Next playback time: wraps around when looping, stops at the end otherwise. */
export function advance(
  time: number,
  deltaMs: number,
  speed: number,
  durationMs: number,
  loop: boolean,
): { time: number; ended: boolean } {
  const next = time + deltaMs * speed
  if (next < durationMs) return { time: next, ended: false }
  return loop ? { time: next % durationMs, ended: false } : { time: durationMs, ended: true }
}
