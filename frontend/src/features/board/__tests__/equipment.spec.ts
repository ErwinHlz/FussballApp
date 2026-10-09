import { describe, expect, it } from 'vitest'
import {
  addKeyframe,
  addObject,
  carrierNear,
  duplicateObject,
  nearestBall,
  newObject,
  removeObject,
  setHolder,
  updateObject,
} from '../editor'
import { holdersAt, positionsAt, resolveKeyframes } from '../interpolate'
import { animationSchema, emptyAnimation, parseAnimation, type Animation } from '../schema'

/** Two players and a ball on a half field. */
function scene(): Animation {
  let a = emptyAnimation('half')
  for (const [type, at] of [
    ['player', [20, 50]],
    ['player', [80, 50]],
    ['ball', [50, 50]],
  ] as const) {
    a = addObject(a, newObject(a, type), [at[0], at[1]], 0)!.animation
  }
  return a
}

function moveInKeyframe(a: Animation, index: number, id: string, to: [number, number]): Animation {
  return {
    ...a,
    keyframes: a.keyframes.map((k, i) =>
      i === index ? { ...k, positions: { ...k.positions, [id]: to } } : k,
    ),
  }
}

describe('equipment and zones', () => {
  it('get defaults per type and validate', () => {
    let a = emptyAnimation()
    const types = [
      'goalkeeper',
      'coach',
      'disc',
      'pole',
      'dummy',
      'minigoal',
      'ladder',
      'ring',
      'zone',
      'text',
    ] as const
    for (const type of types) a = addObject(a, newObject(a, type), [50, 50], 0)!.animation
    expect(a.objects.find((o) => o.type === 'zone')).toMatchObject({ shape: 'rect', w: 20, h: 15 })
    expect(a.objects.find((o) => o.type === 'goalkeeper')).toMatchObject({ label: '1' })
    expect(animationSchema.safeParse(a).success).toBe(true)
  })

  it('keeps animations of the first format valid', () => {
    const old = {
      version: 1,
      field: 'half',
      durationMs: 3000,
      objects: [{ id: 'p1', type: 'player', color: '#ef4444', label: '1' }],
      keyframes: [{ t: 0, positions: { p1: [10, 10] } }],
      annotations: [{ type: 'arrow', from: [0, 0], to: [10, 10], style: 'run' }],
    }
    expect(parseAnimation(old)).not.toBeNull()
  })
})

describe('object properties', () => {
  it('updates and duplicates with the next number', () => {
    let a = updateObject(scene(), 'p1', { name: 'Lena', rotation: 90 })
    expect(a.objects[0]).toMatchObject({ name: 'Lena', rotation: 90 })
    const copy = duplicateObject(a, 'p1', [20, 50], 0)!
    a = copy.animation
    expect(a.objects.at(-1)).toMatchObject({ type: 'player', label: '3' })
    expect(a.objects.at(-1)?.name).toBeUndefined()
    expect(a.keyframes[0]!.positions[copy.id]).toEqual([24, 54])
  })
})

describe('ball carrying', () => {
  it('puts a carried ball at the carrier and passes it in a later keyframe', () => {
    let a = setHolder(scene(), 'b1', 'p1', 0)
    const step = addKeyframe(a, 0)!
    a = setHolder(step.animation, 'b1', 'p2', step.index)
    const [k0, k1] = resolveKeyframes(a)
    expect(k0!.positions.b1![0]).toBeGreaterThan(20)
    expect(k0!.positions.b1![0]).toBeLessThan(25)
    expect(k1!.positions.b1![0]).toBeGreaterThan(80)
    // Halfway through the pass the ball is in the middle.
    const mid = positionsAt(a, a.keyframes[1]!.t / 2, undefined, resolveKeyframes(a))
    expect(mid.b1![0]).toBeGreaterThan(45)
    expect(mid.b1![0]).toBeLessThan(60)
    expect(holdersAt(a, 1)).toEqual({ b1: 'p2' })
    expect(animationSchema.safeParse(a).success).toBe(true)
  })

  it('moves with its carrier and stays where it was released', () => {
    let a = setHolder(scene(), 'b1', 'p1', 0)
    a = addKeyframe(a, 0)!.animation
    a = moveInKeyframe(a, 1, 'p1', [30, 30])
    expect(resolveKeyframes(a)[1]!.positions.b1![1]).toBeGreaterThan(30)
    a = setHolder(a, 'b1', null, 1, [40, 40])
    expect(resolveKeyframes(a)[1]!.positions.b1).toEqual([40, 40])
  })

  it('releases the ball when the carrier is removed', () => {
    const a = removeObject(setHolder(scene(), 'b1', 'p1', 0), 'p1')
    expect(a.keyframes[0]!.holders).toEqual({ b1: null })
    expect(animationSchema.safeParse(a).success).toBe(true)
  })

  it('finds carriers near a drop point and the ball nearest to a player', () => {
    const a = scene()
    const positions = resolveKeyframes(a)[0]!.positions
    expect(carrierNear(a, positions, [22, 52])).toBe('p1')
    expect(carrierNear(a, positions, [50, 20])).toBeNull()
    expect(nearestBall(a, positions, [80, 50])).toBe('b1')
  })
})
