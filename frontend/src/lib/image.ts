/** Browser image helpers (canvas based). */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Needed to read pixels of logos served from the storage domain.
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image could not be loaded'))
    img.src = src
  })
}

function canvasFor(img: HTMLImageElement, maxSize: number) {
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas not available')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { canvas, ctx }
}

/** RGBA pixels of a small copy (enough to find the main colors). */
export function samplePixels(img: HTMLImageElement, size = 96): Uint8ClampedArray {
  const { canvas, ctx } = canvasFor(img, size)
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data
}

/** Downscaled copy, keeping transparency. WebP where supported, PNG otherwise. */
export async function downscale(img: HTMLImageElement, maxSize = 512): Promise<Blob> {
  const { canvas } = canvasFor(img, maxSize)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.9),
  )
  if (blob?.type === 'image/webp') return blob
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (png) => (png ? resolve(png) : reject(new Error('encoding failed'))),
      'image/png',
    ),
  )
}
