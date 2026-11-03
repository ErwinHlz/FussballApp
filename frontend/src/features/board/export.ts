/**
 * Picture of the board: the field SVG as a PNG (share sheet on phones, download elsewhere).
 * The SVG is styled by the page's CSS, so the computed styles are copied onto a clone before
 * it is drawn into a canvas. Selection marks and touch helpers are left out.
 */

const STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'opacity',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
  'visibility',
  'display',
]

/** File name for a step picture, e.g. "ecke-kurz-schritt-2.png". */
export function exportFileName(title: string, step: number, stepWord: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  return `${[slug(title) || 'rondo', slug(stepWord), step].filter(Boolean).join('-')}.png`
}

/** PNG of the field (only the pitch, as in the viewBox), `width` pixels wide. */
export async function boardPng(svg: SVGSVGElement, width = 1080): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const source = [svg, ...svg.querySelectorAll('*')]
  const copy = [clone, ...clone.querySelectorAll('*')]
  source.forEach((element, i) => {
    const style = getComputedStyle(element)
    const target = copy[i] as SVGElement
    target.setAttribute(
      'style',
      STYLE_PROPS.map((prop) => `${prop}:${style.getPropertyValue(prop)}`).join(';'),
    )
    target.removeAttribute('class')
  })
  clone
    .querySelectorAll('[data-handle], [data-selection], [data-hit]')
    .forEach((element) => element.remove())

  // Always the whole field, also when the editor is zoomed in.
  const full = svg.dataset.fullViewbox ?? svg.getAttribute('viewBox') ?? ''
  clone.setAttribute('viewBox', full)
  const [, , vbWidth = 1, vbHeight = 1] = full.split(/\s+/).map(Number)
  const height = Math.round((width * vbHeight) / vbWidth)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const xml = new XMLSerializer().serializeToString(clone)
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('no canvas')
  context.fillStyle = '#2f7d32'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no png'))), 'image/png'),
  )
}

/** Whether the device can share image files (share sheet), e.g. phones. */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
