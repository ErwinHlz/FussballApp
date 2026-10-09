import type { Animation, BoardObject, Point } from './schema'
import { MAX_DURATION_MS, MAX_KEYFRAMES, MAX_OBJECTS } from './schema'

/** Pure editing operations on an animation draft (easy to test, no UI state). */

export const PLAYER_COLORS = [
  { key: 'red', hex: '#ef4444' },
  { key: 'blue', hex: '#3b82f6' },
  { key: 'yellow', hex: '#facc15' },
  { key: 'green', hex: '#22c55e' },
  { key: 'orange', hex: '#f97316' },
  { key: 'white', hex: '#f8fafc' },
] as const

const PREFIX: Record<BoardObject['type'], string> = { player: 'p', ball: 'b', cone: 'c', goal: 'g' }

export function nextObjectId(animation: Animation, type: BoardObject['type']): string {
  const used = new Set(animation.objects.map((o) => o.id))
  let n = 1
  while (used.has(`${PREFIX[type]}${n}`)) n++
  return `${PREFIX[type]}${n}`
}

/** Next jersey label for a player color (1, 2, 3 … per color). */
export function nextLabel(animation: Animation, color: string): string {
  const labels = animation.objects
    .filter((o) => o.type === 'player' && o.color === color)
    .map((o) => Number(o.label))
    .filter((n) => Number.isFinite(n))
  return String(labels.length ? Math.max(...labels) + 1 : 1)
}

/**
 * Adds an object. It gets its position in the first keyframe (so it exists from the start)
 * and in the current keyframe (so it shows up where the coach is working).
 */
export function addObject(
  animation: Animation,
  object: Omit<BoardObject, 'id'>,
  at: Point,
  keyframeIndex: number,
): { animation: Animation; id: string } | null {
  if (animation.objects.length >= MAX_OBJECTS) return null
  const id = nextObjectId(animation, object.type)
  const keyframes = animation.keyframes.map((k, i) =>
    i === 0 || i === keyframeIndex ? { ...k, positions: { ...k.positions, [id]: at } } : k,
  )
  return {
    animation: { ...animation, objects: [...animation.objects, { ...object, id }], keyframes },
    id,
  }
}

export function removeObject(animation: Animation, id: string): Animation {
  return {
    ...animation,
    objects: animation.objects.filter((o) => o.id !== id),
    keyframes: animation.keyframes.map((k) => {
      const positions = { ...k.positions }
      delete positions[id]
      return { ...k, positions }
    }),
  }
}

export function moveObject(
  animation: Animation,
  id: string,
  to: Point,
  keyframeIndex: number,
): Animation {
  return {
    ...animation,
    keyframes: animation.keyframes.map((k, i) =>
      i === keyframeIndex ? { ...k, positions: { ...k.positions, [id]: to } } : k,
    ),
  }
}

/**
 * Inserts a keyframe after the given one (1.5 s later, or halfway to the next keyframe).
 * Extends the duration if needed. Returns the index of the new keyframe.
 */
export function addKeyframe(
  animation: Animation,
  afterIndex: number,
  stepMs = 1500,
): { animation: Animation; index: number } | null {
  if (animation.keyframes.length >= MAX_KEYFRAMES) return null
  const current = animation.keyframes[afterIndex]
  if (!current) return null
  const next = animation.keyframes[afterIndex + 1]
  const t = next ? Math.round((current.t + next.t) / 2) : current.t + stepMs
  if (t <= current.t || t > MAX_DURATION_MS) return null
  const keyframes = [...animation.keyframes]
  keyframes.splice(afterIndex + 1, 0, { t, positions: {} })
  return {
    animation: { ...animation, keyframes, durationMs: Math.max(animation.durationMs, t) },
    index: afterIndex + 1,
  }
}

export function removeKeyframe(animation: Animation, index: number): Animation {
  if (index === 0) return animation // the first keyframe defines the start
  return { ...animation, keyframes: animation.keyframes.filter((_, i) => i !== index) }
}

/** Changes a keyframe time, keeping the order strictly increasing. Returns null if invalid. */
export function setKeyframeTime(animation: Animation, index: number, t: number): Animation | null {
  if (index === 0) return null
  const prev = animation.keyframes[index - 1]
  const next = animation.keyframes[index + 1]
  const time = Math.round(t)
  if (!prev || time <= prev.t || (next && time >= next.t) || time > MAX_DURATION_MS) return null
  return {
    ...animation,
    keyframes: animation.keyframes.map((k, i) => (i === index ? { ...k, t: time } : k)),
    durationMs: Math.max(animation.durationMs, time),
  }
}

/** Shortens/extends the animation; never before the last keyframe. */
export function setDuration(animation: Animation, ms: number): Animation {
  const last = animation.keyframes.at(-1)?.t ?? 0
  const durationMs = Math.min(MAX_DURATION_MS, Math.max(500, last, Math.round(ms)))
  return { ...animation, durationMs }
}
