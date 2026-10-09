import type { Animation, Keyframe, Point } from './schema'

export type Positions = Record<string, Point>
export type Easing = (progress: number) => number

export const linear: Easing = (p) => p
export const easeInOut: Easing = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)

/**
 * Fills every keyframe with a position for every object:
 * an object missing in a keyframe keeps its last known position (it stands still).
 * Before its first appearance an object uses that first position.
 */
export function resolveKeyframes(animation: Pick<Animation, 'objects' | 'keyframes'>): Keyframe[] {
  const last: Positions = {}
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
    return { t: k.t, positions }
  })
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
