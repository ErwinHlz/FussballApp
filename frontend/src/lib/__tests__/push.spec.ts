import { describe, expect, it } from 'vitest'
import { base64UrlToBytes, isPushSupported } from '../push'

describe('push helpers', () => {
  it('decodes base64url VAPID keys', () => {
    expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })

  it('knows when push is not available (no service worker in the test DOM)', () => {
    expect(isPushSupported()).toBe(false)
  })
})
