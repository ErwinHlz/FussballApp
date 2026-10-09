/**
 * Errors from the backend (wrong password, RLS refusal, deadline passed, upload cancelled …)
 * are expected: views show them through the mutation's error state. When such an error also
 * bubbles out of an event handler (mutateAsync), it must not be reported as a crash.
 */
const EXPECTED_ERROR_NAMES = new Set([
  'AuthApiError',
  'AuthError',
  'AuthUnknownError',
  'AuthRetryableFetchError',
  'AuthWeakPasswordError',
  'PostgrestError',
  'StorageError',
  'StorageApiError',
  'StorageUnknownError',
  'UploadAbortedError',
])

export function isExpectedApiError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name } = error as { name?: unknown }
  if (typeof name === 'string' && EXPECTED_ERROR_NAMES.has(name)) return true
  // PostgREST errors may also arrive as plain objects.
  return 'code' in error && 'message' in error && ('details' in error || 'hint' in error)
}

/** For Vue's app.config.errorHandler: swallow expected API errors, report everything else. */
export function reportError(error: unknown, info?: string): void {
  if (isExpectedApiError(error)) return
  console.error(error, info)
}
