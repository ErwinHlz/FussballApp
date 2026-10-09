import type { ArrowStyle, FieldType, Point } from './schema'

/** Field sizes in meters, portrait (goals at top and bottom) for phone screens. */
export const FIELD_SIZE: Record<FieldType, { w: number; h: number }> = {
  full: { w: 68, h: 105 },
  half: { w: 68, h: 52.5 },
  quarter: { w: 34, h: 52.5 },
}

export function toSvg(field: FieldType, p: Point): [number, number] {
  const { w, h } = FIELD_SIZE[field]
  return [(p[0] / 100) * w, (p[1] / 100) * h]
}

const clamp = (v: number) => Math.min(100, Math.max(0, v))
const round = (v: number) => Math.round(v * 10) / 10

/** SVG user units -> field percent (clamped, 0.1 precision). */
export function fromSvg(field: FieldType, x: number, y: number): Point {
  const { w, h } = FIELD_SIZE[field]
  return [round(clamp((x / w) * 100)), round(clamp((y / h) * 100))]
}

/** Object size scales with the visible field so objects look the same on every field type. */
export function objectRadius(field: FieldType): number {
  const { w, h } = FIELD_SIZE[field]
  return Math.min(w, h) * 0.045
}

/** SVG path for an arrow: straight for run/pass, a wave for dribbling. */
export function arrowPath(field: FieldType, from: Point, to: Point, style: ArrowStyle): string {
  const [x1, y1] = toSvg(field, from)
  const [x2, y2] = toSvg(field, to)
  if (style !== 'dribble') return `M ${x1} ${y1} L ${x2} ${y2}`

  const length = Math.hypot(x2 - x1, y2 - y1)
  if (length === 0) return `M ${x1} ${y1}`
  const amplitude = objectRadius(field) * 0.6
  const waves = Math.max(2, Math.round(length / (amplitude * 4)))
  // Normal vector for the zig-zag offset.
  const nx = -(y2 - y1) / length
  const ny = (x2 - x1) / length
  const steps = waves * 8
  const points: string[] = [`M ${x1} ${y1}`]
  for (let i = 1; i <= steps; i++) {
    const f = i / steps
    // Fade the wave out at the end so the arrow head points straight.
    const wave = Math.sin(f * waves * 2 * Math.PI) * amplitude * Math.min(1, (1 - f) * 6)
    points.push(
      `L ${(x1 + (x2 - x1) * f + nx * wave).toFixed(2)} ${(y1 + (y2 - y1) * f + ny * wave).toFixed(2)}`,
    )
  }
  return points.join(' ')
}

/** Distance between two field points in percent units (used to ignore accidental tiny arrows). */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}
