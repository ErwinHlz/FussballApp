/** Drill video upload helpers (Supabase Storage bucket `drill-videos`). */

export const VIDEO_BUCKET = 'drill-videos'
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024
export const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export type VideoFileProblem = 'type' | 'tooLarge' | 'empty'

/** Checks a file before uploading (the bucket enforces the same limits server-side). */
export function validateVideoFile(file: Pick<File, 'type' | 'size'>): VideoFileProblem | null {
  if (!(file.type in VIDEO_TYPES)) return 'type'
  if (file.size === 0) return 'empty'
  if (file.size > VIDEO_MAX_BYTES) return 'tooLarge'
  return null
}

/** <team>/<drill>/<random>.<ext> — the storage policies only accept this layout. */
export function videoPath(teamId: string, drillId: string, file: Pick<File, 'type'>): string {
  const ext = VIDEO_TYPES[file.type] ?? 'mp4'
  return `${teamId}/${drillId}/${crypto.randomUUID()}.${ext}`
}

export function formatBytes(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toLocaleString(locale, { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`
}

export class UploadAbortedError extends Error {
  constructor() {
    super('Upload aborted')
    this.name = 'UploadAbortedError'
  }
}

/**
 * Uploads a file to a signed upload URL with progress events.
 * fetch() cannot report upload progress, so this uses XMLHttpRequest.
 */
export function uploadWithProgress(
  signedUrl: string,
  file: File,
  options: { apiKey: string; onProgress: (fraction: number) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('apikey', options.apiKey)
    xhr.setRequestHeader('content-type', file.type)
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress(1)
        resolve()
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed (network)'))
    xhr.onabort = () => reject(new UploadAbortedError())

    if (options.signal) {
      if (options.signal.aborted) return xhr.abort()
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(file)
  })
}
