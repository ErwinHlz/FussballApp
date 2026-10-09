import { describe, expect, it } from 'vitest'
import {
  DARK_SURFACE,
  LIGHT_SURFACE,
  accentTheme,
  contrastRatio,
  extractPalette,
  hexToRgb,
  rgbToHex,
} from '../color'

/** RGBA pixels: [hex, count, alpha]. */
function image(parts: [string, number, number?][]): Uint8ClampedArray {
  const data: number[] = []
  for (const [hex, count, alpha = 255] of parts) {
    const [r, g, b] = hexToRgb(hex)
    for (let i = 0; i < count; i++) data.push(r, g, b, alpha)
  }
  return new Uint8ClampedArray(data)
}

describe('extractPalette', () => {
  it('finds the logo colors, most frequent first, and ignores white, black and gray', () => {
    const pixels = image([
      ['#ffffff', 500],
      ['#000000', 200],
      ['#808080', 100],
      ['#c8102e', 300],
      ['#1d4ed8', 120],
    ])
    expect(extractPalette(pixels)).toEqual(['#c8102e', '#1d4ed8'])
  })

  it('ignores transparent pixels and specks', () => {
    const pixels = image([
      ['#16a34a', 400, 0],
      ['#f59e0b', 200],
      ['#7c3aed', 2],
    ])
    expect(extractPalette(pixels)).toEqual(['#f59e0b'])
  })

  it('merges similar shades', () => {
    const pixels = image([
      ['#c8102e', 300],
      ['#d0142f', 200],
      ['#1d4ed8', 100],
    ])
    expect(extractPalette(pixels)).toHaveLength(2)
  })

  it('returns nothing for black-and-white logos', () => {
    expect(
      extractPalette(
        image([
          ['#ffffff', 50],
          ['#111111', 50],
        ]),
      ),
    ).toEqual([])
  })
})

describe('accentTheme', () => {
  it.each(['#facc15', '#c8102e', '#1d4ed8', '#22c55e', '#0b1f3a', '#ffffff'])(
    'keeps %s readable in both modes',
    (accent) => {
      const { light, dark } = accentTheme(accent)
      expect(contrastRatio(light.primary, LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(light.primary, light.contrast)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(dark.primary, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(dark.primary, dark.contrast)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('keeps dark enough colors unchanged in light mode', () => {
    expect(accentTheme('#1d4ed8').light.primary).toBe('#1d4ed8')
  })
})

describe('hex conversion', () => {
  it('round-trips', () => {
    expect(rgbToHex(hexToRgb('#0a7f3c'))).toBe('#0a7f3c')
  })
})
