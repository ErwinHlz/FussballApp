/**
 * Color helpers for club branding: pick accent colors from a logo and derive readable theme
 * colors (WCAG contrast) for light and dark mode.
 */

export type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
      : max === gn
        ? ((bn - rn) / d + 2) / 6
        : ((rn - gn) / d + 4) / 6
  return [h * 360, s, l]
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  const hue = (t: number) => {
    const x = (t + 1) % 1
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  const hn = h / 360
  return [hue(hn + 1 / 3) * 255, hue(hn) * 255, hue(hn - 1 / 3) * 255]
}

/** WCAG relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Moves the lightness until the color reaches the contrast against the background. */
function withContrast(hex: string, background: string, minRatio: number, direction: -1 | 1) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  let color = hex
  for (let step = 1; step <= 100 && contrastRatio(color, background) < minRatio; step++) {
    color = rgbToHex(hslToRgb([h, s, Math.min(1, Math.max(0, l + direction * step * 0.01))]))
  }
  return color
}

function shift(hex: string, delta: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  return rgbToHex(hslToRgb([h, s, Math.min(1, Math.max(0, l + delta))]))
}

export type ThemeColors = { primary: string; hover: string; contrast: string }

/** Surfaces the accent is used on (see styles/_tokens.scss). */
export const LIGHT_SURFACE = '#ffffff'
export const DARK_SURFACE = '#18221b'
const LIGHT_TEXT = '#ffffff'
const DARK_TEXT = '#08160d'

/**
 * Readable theme colors for an accent: the primary works as text on the surface and as a
 * button background with its contrast text (>= 4.5:1 in both modes).
 */
export function accentTheme(accent: string): { light: ThemeColors; dark: ThemeColors } {
  const light = withContrast(accent, LIGHT_SURFACE, 4.5, -1)
  const dark = withContrast(accent, DARK_SURFACE, 4.5, 1)
  const darkText =
    contrastRatio(dark, DARK_TEXT) >= contrastRatio(dark, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT
  return {
    light: { primary: light, hover: shift(light, -0.07), contrast: LIGHT_TEXT },
    dark: {
      primary: dark,
      hover: shift(dark, darkText === DARK_TEXT ? 0.08 : -0.08),
      contrast: darkText,
    },
  }
}

/**
 * Prominent colors of an image (RGBA pixels), most frequent first. White, black, gray and
 * transparent pixels are ignored; similar hues are merged.
 */
export function extractPalette(pixels: Uint8ClampedArray, max = 4): string[] {
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>()
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3]! < 128) continue
    const rgb: Rgb = [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!]
    const [h, s, l] = rgbToHsl(rgb)
    if (s < 0.25 || l < 0.12 || l > 0.92) continue
    // 24 hue bins of 15°, split into darker and lighter shades.
    const key = Math.floor(h / 15) * 2 + (l < 0.5 ? 0 : 1)
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bin.count++
    bin.r += rgb[0]
    bin.g += rgb[1]
    bin.b += rgb[2]
    bins.set(key, bin)
  }
  const total = [...bins.values()].reduce((sum, bin) => sum + bin.count, 0)
  const candidates = [...bins.values()]
    // Ignore specks (anti-aliasing, tiny details).
    .filter((bin) => bin.count >= Math.max(3, total * 0.03))
    .sort((a, b) => b.count - a.count)
    .map((bin) => rgbToHex([bin.r / bin.count, bin.g / bin.count, bin.b / bin.count]))

  const palette: string[] = []
  for (const color of candidates) {
    const [h] = rgbToHsl(hexToRgb(color))
    const similar = palette.some((picked) => {
      const [ph] = rgbToHsl(hexToRgb(picked))
      const distance = Math.min(Math.abs(h - ph), 360 - Math.abs(h - ph))
      return distance < 25
    })
    if (!similar) palette.push(color)
    if (palette.length === max) break
  }
  return palette
}
