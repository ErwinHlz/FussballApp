import { describe, expect, it } from 'vitest'
import {
  addKeyframe,
  addObject,
  moveObject,
  nextLabel,
  removeKeyframe,
  removeObject,
  setDuration,
  setKeyframeTime,
} from '../editor'
import { animationSchema, emptyAnimation, type Animation } from '../schema'

function withTwoKeyframes(): Animation {
  return {
    ...emptyAnimation(),
    keyframes: [
      { t: 0, positions: {} },
      { t: 2000, positions: {} },
    ],
  }
}

describe('objects', () => {
  it('adds objects with unique ids, present in the first and the current keyframe', () => {
    let a = withTwoKeyframes()
    const first = addObject(a, { type: 'player', color: '#ef4444', label: '1' }, [10, 10], 1)!
    a = first.animation
    const second = addObject(a, { type: 'player', color: '#ef4444', label: '2' }, [20, 20], 0)!
    a = second.animation

    expect([first.id, second.id]).toEqual(['p1', 'p2'])
    expect(a.keyframes[0]!.positions).toEqual({ p1: [10, 10], p2: [20, 20] })
    expect(a.keyframes[1]!.positions).toEqual({ p1: [10, 10] })
    expect(animationSchema.safeParse(a).success).toBe(true)
  })

  it('numbers players per color', () => {
    let a = emptyAnimation()
    a = addObject(a, { type: 'player', color: '#ef4444', label: '1' }, [1, 1], 0)!.animation
    a = addObject(a, { type: 'player', color: '#3b82f6', label: '1' }, [1, 1], 0)!.animation
    expect(nextLabel(a, '#ef4444')).toBe('2')
    expect(nextLabel(a, '#22c55e')).toBe('1')
  })

  it('moves an object only in the current keyframe', () => {
    let a = addObject(withTwoKeyframes(), { type: 'ball' }, [50, 50], 0)!.animation
    a = moveObject(a, 'b1', [60, 40], 1)
    expect(a.keyframes[0]!.positions.b1).toEqual([50, 50])
    expect(a.keyframes[1]!.positions.b1).toEqual([60, 40])
  })

  it('removes an object from all keyframes', () => {
    let a = addObject(withTwoKeyframes(), { type: 'cone' }, [5, 5], 1)!.animation
    a = removeObject(a, 'c1')
    expect(a.objects).toEqual([])
    expect(a.keyframes.every((k) => !('c1' in k.positions))).toBe(true)
  })
})

describe('keyframes', () => {
  it('appends 1.5 s after the last keyframe and extends the duration', () => {
    const a = { ...withTwoKeyframes(), durationMs: 2000 }
    const result = addKeyframe(a, 1)!
    expect(result.index).toBe(2)
    expect(result.animation.keyframes.map((k) => k.t)).toEqual([0, 2000, 3500])
    expect(result.animation.durationMs).toBe(3500)
  })

  it('inserts halfway between two keyframes', () => {
    const result = addKeyframe(withTwoKeyframes(), 0)!
    expect(result.animation.keyframes.map((k) => k.t)).toEqual([0, 1000, 2000])
  })

  it('never removes the first keyframe', () => {
    const a = withTwoKeyframes()
    expect(removeKeyframe(a, 0)).toBe(a)
    expect(removeKeyframe(a, 1).keyframes).toHaveLength(1)
  })

  it('only allows keyframe times that keep the order', () => {
    const a = {
      ...withTwoKeyframes(),
      keyframes: [...withTwoKeyframes().keyframes, { t: 4000, positions: {} }],
    }
    expect(setKeyframeTime(a, 1, 3000)!.keyframes[1]!.t).toBe(3000)
    expect(setKeyframeTime(a, 1, 4000)).toBeNull()
    expect(setKeyframeTime(a, 1, 0)).toBeNull()
    expect(setKeyframeTime(a, 0, 100)).toBeNull()
  })

  it('keeps the duration at least as long as the last keyframe', () => {
    const a = withTwoKeyframes()
    expect(setDuration(a, 1000).durationMs).toBe(2000)
    expect(setDuration(a, 9000).durationMs).toBe(9000)
    expect(setDuration(a, 999_999).durationMs).toBe(60_000)
  })
})
