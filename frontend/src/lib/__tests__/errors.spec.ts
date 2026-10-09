import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError } from '@supabase/supabase-js'
import { UploadAbortedError } from '@/features/drills/video'
import { isExpectedApiError, reportError } from '../errors'

describe('isExpectedApiError', () => {
  it('recognizes backend errors that the UI already shows', () => {
    expect(
      isExpectedApiError(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')),
    ).toBe(true)
    expect(isExpectedApiError(new UploadAbortedError())).toBe(true)
    expect(
      isExpectedApiError({ code: '42501', message: 'denied', details: null, hint: null }),
    ).toBe(true)
  })

  it('does not hide programming errors', () => {
    expect(isExpectedApiError(new TypeError('x is undefined'))).toBe(false)
    expect(isExpectedApiError(new Error('boom'))).toBe(false)
    expect(isExpectedApiError(null)).toBe(false)
    expect(isExpectedApiError('string')).toBe(false)
  })
})

describe('reportError', () => {
  afterEach(() => vi.restoreAllMocks())

  it('logs only unexpected errors', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportError(new AuthApiError('nope', 400, 'invalid_credentials'))
    expect(log).not.toHaveBeenCalled()
    reportError(new TypeError('bug'), 'render')
    expect(log).toHaveBeenCalledOnce()
  })
})
