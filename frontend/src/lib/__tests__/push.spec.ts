import { afterEach, describe, expect, it, vi } from 'vitest'
import { base64UrlToBytes, isPushSupported } from '../push'

describe('push helpers', () => {
  it('decodes base64url VAPID keys', () => {
    expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  })

  it('knows when push is not available (no service worker in the test DOM)', () => {
    expect(isPushSupported()).toBe(false)
  })

  describe('getPushState', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      Reflect.deleteProperty(navigator, 'serviceWorker')
    })

    async function withSubscription(getSubscription: () => Promise<unknown>) {
      vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AQID')
      vi.stubGlobal('Notification', { permission: 'default' })
      vi.stubGlobal('PushManager', class {})
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { getRegistration: async () => ({ pushManager: { getSubscription } }) },
      })
      vi.resetModules()
      return (await import('../push')).getPushState
    }

    it('treats a push service that rejects as unsupported', async () => {
      const getPushState = await withSubscription(() =>
        Promise.reject(new DOMException('no service', 'AbortError')),
      )
      await expect(getPushState()).resolves.toBe('unsupported')
    })

    it('treats a push service that never answers as unsupported', async () => {
      vi.useFakeTimers()
      const getPushState = await withSubscription(() => new Promise(() => {}))
      const state = getPushState()
      await vi.advanceTimersByTimeAsync(5000)
      await expect(state).resolves.toBe('unsupported')
      vi.useRealTimers()
    })

    it('reports an existing subscription', async () => {
      const getPushState = await withSubscription(async () => ({ endpoint: 'x' }))
      await expect(getPushState()).resolves.toBe('on')
    })
  })
})
