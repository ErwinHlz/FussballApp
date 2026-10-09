import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatBytes,
  uploadWithProgress,
  UploadAbortedError,
  validateVideoFile,
  VIDEO_MAX_BYTES,
  videoPath,
} from '../video'

describe('validateVideoFile', () => {
  it('accepts mp4, webm and mov up to 50 MB', () => {
    expect(validateVideoFile({ type: 'video/mp4', size: 10_000_000 })).toBeNull()
    expect(validateVideoFile({ type: 'video/webm', size: VIDEO_MAX_BYTES })).toBeNull()
    expect(validateVideoFile({ type: 'video/quicktime', size: 1 })).toBeNull()
  })

  it('rejects other formats, empty and too large files', () => {
    expect(validateVideoFile({ type: 'video/x-msvideo', size: 1000 })).toBe('type')
    expect(validateVideoFile({ type: 'image/png', size: 1000 })).toBe('type')
    expect(validateVideoFile({ type: 'video/mp4', size: 0 })).toBe('empty')
    expect(validateVideoFile({ type: 'video/mp4', size: VIDEO_MAX_BYTES + 1 })).toBe('tooLarge')
  })
})

describe('videoPath', () => {
  it('follows team/drill/random.ext', () => {
    const path = videoPath('team-1', 'drill-2', { type: 'video/quicktime' })
    expect(path).toMatch(/^team-1\/drill-2\/[0-9a-f-]{36}\.mov$/)
    expect(videoPath('t', 'd', { type: 'video/mp4' })).not.toBe(
      videoPath('t', 'd', { type: 'video/mp4' }),
    )
  })
})

describe('formatBytes', () => {
  it('shows megabytes', () => {
    expect(formatBytes(5 * 1024 * 1024, 'de')).toBe('5 MB')
    expect(formatBytes(1.5 * 1024 * 1024, 'de')).toBe('1,5 MB')
    expect(formatBytes(48 * 1024 * 1024, 'en')).toBe('48 MB')
  })
})

// Minimal XMLHttpRequest fake to drive progress, success, failure and abort.
class FakeXhr {
  static last: FakeXhr
  headers: Record<string, string> = {}
  method = ''
  url = ''
  status = 0
  body: unknown
  upload: {
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null
  } = {
    onprogress: null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null
  constructor() {
    FakeXhr.last = this
  }
  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(key: string, value: string) {
    this.headers[key] = value
  }
  send(body: unknown) {
    this.body = body
  }
  abort() {
    this.onabort?.()
  }
}

describe('uploadWithProgress', () => {
  afterEach(() => vi.unstubAllGlobals())

  const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })

  it('PUTs the file with headers and reports progress', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const progress: number[] = []
    const promise = uploadWithProgress('https://storage/upload?token=t', file, {
      apiKey: 'anon',
      onProgress: (f) => progress.push(f),
    })
    const xhr = FakeXhr.last
    expect([xhr.method, xhr.url, xhr.headers.apikey, xhr.headers['content-type']]).toEqual([
      'PUT',
      'https://storage/upload?token=t',
      'anon',
      'video/mp4',
    ])
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 })
    xhr.status = 200
    xhr.onload?.()
    await promise
    expect(progress).toEqual([0.25, 1])
    expect(xhr.body).toBe(file)
  })

  it('rejects on server errors', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const promise = uploadWithProgress('u', file, { apiKey: 'a', onProgress: () => {} })
    FakeXhr.last.status = 413
    FakeXhr.last.onload?.()
    await expect(promise).rejects.toThrow('413')
  })

  it('can be cancelled', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const controller = new AbortController()
    const promise = uploadWithProgress('u', file, {
      apiKey: 'a',
      onProgress: () => {},
      signal: controller.signal,
    })
    controller.abort()
    await expect(promise).rejects.toBeInstanceOf(UploadAbortedError)
  })
})
