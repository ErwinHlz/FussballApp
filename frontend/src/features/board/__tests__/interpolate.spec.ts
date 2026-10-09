import { describe, expect, it } from 'vitest'
import { advance, easeInOut, positionsAt, resolveKeyframes } from '../interpolate'
import { animationSchema, emptyAnimation, parseAnimation, type Animation } from '../schema'

const base: Animation = {
  version: 1,
  field: 'half',
  durationMs: 8000,
  objects: [
    { id: 'p1', type: 'player', color: '#ef4444', label: '1' },
    { id: 'b1', type: 'ball' },
    { id: 'c1', type: 'cone', color: '#f97316' },
  ],
  keyframes: [
    { t: 0, positions: { p1: [20, 50], b1: [22, 50], c1: [50, 50] } },
    { t: 3000, positions: { p1: [48, 45], b1: [50, 48] } },
    { t: 6000, positions: { b1: [80, 20] } },
  ],
  annotations: [{ type: 'arrow', from: [20, 50], to: [48, 45], style: 'run' }],
}

describe('resolveKeyframes', () => {
  it('fills missing positions with the last known one', () => {
    const resolved = resolveKeyframes(base)
    expect(resolved[1]!.positions.c1).toEqual([50, 50])
    expect(resolved[2]!.positions.p1).toEqual([48, 45])
    expect(resolved[2]!.positions.b1).toEqual([80, 20])
  })

  it('uses the first known position for objects that appear later', () => {
    const late: Animation = {
      ...base,
      keyframes: [
        { t: 0, positions: { p1: [0, 0] } },
        { t: 1000, positions: { p1: [10, 10], b1: [30, 30] } },
      ],
    }
    expect(resolveKeyframes(late)[0]!.positions.b1).toEqual([30, 30])
  })
})

describe('positionsAt', () => {
  it('returns keyframe positions exactly at keyframe times', () => {
    expect(positionsAt(base, 0).p1).toEqual([20, 50])
    expect(positionsAt(base, 3000).p1).toEqual([48, 45])
  })

  it('interpolates linearly between keyframes', () => {
    const mid = positionsAt(base, 1500)
    expect(mid.p1).toEqual([34, 47.5])
    expect(mid.b1).toEqual([36, 49])
  })

  it('keeps objects without a position in a keyframe still', () => {
    // c1 never moves; p1 is missing in the 3rd keyframe and stays at [48, 45].
    expect(positionsAt(base, 1500).c1).toEqual([50, 50])
    expect(positionsAt(base, 4500).p1).toEqual([48, 45])
    expect(positionsAt(base, 4500).b1).toEqual([65, 34])
  })

  it('holds the last keyframe until the end and clamps out-of-range times', () => {
    expect(positionsAt(base, 7000).b1).toEqual([80, 20])
    expect(positionsAt(base, 99_000).b1).toEqual([80, 20])
    expect(positionsAt(base, -50).p1).toEqual([20, 50])
  })

  it('supports optional easing', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(0.5)).toBe(0.5)
    expect(easeInOut(1)).toBe(1)
    expect(easeInOut(0.25)).toBeLessThan(0.25)
    const eased = positionsAt(base, 750, easeInOut).p1![0]
    expect(eased).toBeLessThan(positionsAt(base, 750).p1![0])
  })
})

describe('advance (playback clock)', () => {
  it('moves by delta × speed', () => {
    expect(advance(1000, 100, 2, 8000, false)).toEqual({ time: 1200, ended: false })
  })

  it('stops at the end or loops', () => {
    expect(advance(7950, 100, 1, 8000, false)).toEqual({ time: 8000, ended: true })
    expect(advance(7950, 100, 1, 8000, true)).toEqual({ time: 50, ended: false })
  })
})

describe('animationSchema', () => {
  it('accepts the format from PLAN.md', () => {
    expect(animationSchema.safeParse(base).success).toBe(true)
    expect(parseAnimation(emptyAnimation())).not.toBeNull()
  })

  it.each([
    ['first keyframe not at 0', { ...base, keyframes: [{ t: 100, positions: {} }] }],
    [
      'keyframes not increasing',
      {
        ...base,
        keyframes: [
          { t: 0, positions: {} },
          { t: 0, positions: {} },
        ],
      },
    ],
    [
      'keyframe after the end',
      {
        ...base,
        keyframes: [
          { t: 0, positions: {} },
          { t: 9000, positions: {} },
        ],
      },
    ],
    ['coordinates outside 0–100', { ...base, keyframes: [{ t: 0, positions: { p1: [120, 50] } }] }],
    ['unknown object in keyframe', { ...base, keyframes: [{ t: 0, positions: { x9: [1, 1] } }] }],
    ['duplicate object ids', { ...base, objects: [base.objects[0], base.objects[0]] }],
    ['wrong version', { ...base, version: 2 }],
    ['unknown arrow style', { ...base, annotations: [{ ...base.annotations[0], style: 'fly' }] }],
  ])('rejects: %s', (_label, value) => {
    expect(parseAnimation(value)).toBeNull()
  })
})
