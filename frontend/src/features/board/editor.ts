import type { Animation, BoardObject, ObjectType, Point } from './schema'
import { BALL_CARRIERS, MAX_DURATION_MS, MAX_KEYFRAMES, MAX_OBJECTS } from './schema'
import { distance } from './geometry'

/** Pure editing operations on an animation draft (easy to test, no UI state). */

export const PLAYER_COLORS = [
  { key: 'red', hex: '#ef4444' },
  { key: 'blue', hex: '#3b82f6' },
  { key: 'yellow', hex: '#facc15' },
  { key: 'green', hex: '#22c55e' },
  { key: 'orange', hex: '#f97316' },
  { key: 'white', hex: '#f8fafc' },
] as const

/** Equipment colors (cones, discs, poles, rings) and zone tints. */
export const EQUIPMENT_COLORS = [
  '#f97316',
  '#facc15',
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f8fafc',
] as const

const PREFIX: Record<ObjectType, string> = {
  player: 'p',
  goalkeeper: 'k',
  coach: 't',
  ball: 'b',
  cone: 'c',
  disc: 'd',
  pole: 's',
  dummy: 'm',
  minigoal: 'n',
  goal: 'g',
  ladder: 'l',
  ring: 'r',
  zone: 'z',
  text: 'x',
}

/** A new object of the type with sensible defaults (color, number, size). */
export function newObject(
  animation: Animation,
  type: ObjectType,
  playerColor: string = PLAYER_COLORS[0].hex,
): Omit<BoardObject, 'id'> {
  switch (type) {
    case 'player':
      return { type, color: playerColor, label: nextLabel(animation, playerColor) }
    case 'goalkeeper':
      return { type, color: '#facc15', label: '1' }
    case 'cone':
      return { type, color: '#f97316' }
    case 'disc':
    case 'pole':
      return { type, color: '#facc15' }
    case 'ring':
      return { type, color: '#3b82f6' }
    case 'zone':
      return { type, color: '#facc15', shape: 'rect', w: 20, h: 15 }
    case 'text':
      return { type, text: 'Text' }
    default:
      return { type }
  }
}

export function nextObjectId(animation: Animation, type: ObjectType): string {
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
      if (!k.holders) return { ...k, positions }
      // Drop the ball's own entry and release balls the removed object was carrying.
      const holders: Record<string, string | null> = {}
      for (const [ball, carrier] of Object.entries(k.holders)) {
        if (ball !== id) holders[ball] = carrier === id ? null : carrier
      }
      return { ...k, positions, holders }
    }),
  }
}

/** Changes properties (color, number, name, rotation, size, text); never the id or type. */
export function updateObject(
  animation: Animation,
  id: string,
  patch: Partial<Omit<BoardObject, 'id' | 'type'>>,
): Animation {
  return {
    ...animation,
    objects: animation.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  }
}

/** Copy of an object, placed slightly offset; players get the next free number. */
export function duplicateObject(
  animation: Animation,
  id: string,
  at: Point,
  keyframeIndex: number,
): { animation: Animation; id: string } | null {
  const original = animation.objects.find((o) => o.id === id)
  if (!original) return null
  const copy: Omit<BoardObject, 'id'> & { id?: string } = { ...original }
  delete copy.id
  if (copy.type === 'player') {
    copy.label = nextLabel(animation, copy.color ?? PLAYER_COLORS[0].hex)
    delete copy.name
  }
  const clamp = (v: number) => Math.min(100, Math.max(0, v))
  return addObject(animation, copy, [clamp(at[0] + 4), clamp(at[1] + 4)], keyframeIndex)
}

/** Gives a ball to a carrier (or releases it with null) from this keyframe on. */
export function setHolder(
  animation: Animation,
  ballId: string,
  carrierId: string | null,
  keyframeIndex: number,
  releasedAt?: Point,
): Animation {
  return {
    ...animation,
    keyframes: animation.keyframes.map((k, i) => {
      if (i !== keyframeIndex) return k
      const positions = releasedAt ? { ...k.positions, [ballId]: releasedAt } : k.positions
      return { ...k, positions, holders: { ...k.holders, [ballId]: carrierId } }
    }),
  }
}

/** The ball carrier closest to a point within the snap radius (field percent), if any. */
export function carrierNear(
  animation: Animation,
  positions: Record<string, Point>,
  point: Point,
  radius = 6,
): string | null {
  let best: { id: string; d: number } | null = null
  for (const o of animation.objects) {
    const p = positions[o.id]
    if (!BALL_CARRIERS.includes(o.type) || !p) continue
    const d = distance(p, point)
    if (d <= radius && (!best || d < best.d)) best = { id: o.id, d }
  }
  return best?.id ?? null
}

/** The ball closest to a point (used for "give the ball" to a selected player). */
export function nearestBall(
  animation: Animation,
  positions: Record<string, Point>,
  to: Point,
): string | null {
  let best: { id: string; d: number } | null = null
  for (const o of animation.objects) {
    const p = positions[o.id]
    if (o.type !== 'ball' || !p) continue
    const d = distance(p, to)
    if (!best || d < best.d) best = { id: o.id, d }
  }
  return best?.id ?? null
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
