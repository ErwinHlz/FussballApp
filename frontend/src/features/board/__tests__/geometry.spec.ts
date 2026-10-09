import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { arrowPath, distance, fromSvg, toSvg } from '../geometry'
import { parseAnimation } from '../schema'

describe('coordinates', () => {
  it('maps percent to SVG units and back', () => {
    expect(toSvg('full', [50, 50])).toEqual([34, 52.5])
    expect(fromSvg('full', 34, 52.5)).toEqual([50, 50])
    expect(fromSvg('quarter', 17, 0)).toEqual([50, 0])
  })

  it('clamps points outside the field', () => {
    expect(fromSvg('half', -5, 999)).toEqual([0, 100])
  })

  it('measures distances in percent', () => {
    expect(distance([0, 0], [3, 4])).toBe(5)
  })
})

describe('arrowPath', () => {
  it('draws straight lines for runs and passes', () => {
    expect(arrowPath('full', [0, 0], [100, 100], 'pass')).toBe('M 0 0 L 68 105')
    expect(arrowPath('full', [0, 0], [100, 100], 'run')).toBe('M 0 0 L 68 105')
  })

  it('draws a wave for dribbling that ends at the target', () => {
    const path = arrowPath('half', [10, 50], [90, 50], 'dribble')
    const segments = path.split(' L ')
    expect(segments.length).toBeGreaterThan(10)
    expect(segments.at(-1)).toBe('61.20 26.25')
  })
})

describe('demo animation in the migration', () => {
  it('is valid according to the Zod schema', () => {
    const dir = join(__dirname, '../../../../../backend/supabase/migrations')
    const file = readdirSync(dir).find((f) => f.endsWith('_drill_animation.sql'))!
    const sql = readFileSync(join(dir, file), 'utf8')
    const json = sql.split('$json$')[1]!
    expect(parseAnimation(JSON.parse(json))).not.toBeNull()
  })
})
