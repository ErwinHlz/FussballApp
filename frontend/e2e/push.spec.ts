/**
 * Web push in a real browser: permission, service worker, device saved for the right user,
 * turning it off again.
 *
 * Headless browsers refuse real push subscriptions ("Registration failed - permission denied",
 * even Google Chrome), so only the browser's PushManager.subscribe is replaced by a fake
 * subscription. Delivery and encryption are verified against the backend separately.
 */
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

// The slim headless shell always reports notifications as "denied"; full Chromium does not.
test.use({ channel: 'chromium' })

test('player turns on notifications and the device is registered', async ({ browser }) => {
  const demo = await seedDemo()
  const context = await browser.newContext({ permissions: ['notifications'] })
  await context.addInitScript(() => {
    let current: PushSubscription | null = null
    const endpoint = `https://push.example.test/send/${Math.random().toString(36).slice(2)}`
    PushManager.prototype.subscribe = async function () {
      current = {
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'BPk3-fake-p256dh-key', auth: 'fake-auth' } }),
        unsubscribe: async () => {
          current = null
          return true
        },
      } as unknown as PushSubscription
      return current
    }
    PushManager.prototype.getSubscription = async () => current
  })
  const page = await context.newPage()
  await login(page, demo.player.email, '/profile')

  const section = page.locator('.notifications')
  await expect(section.getByText('Auf diesem Gerät aus')).toBeVisible()
  await section.getByRole('button', { name: 'Benachrichtigungen aktivieren' }).click()
  await expect(section.getByText('Auf diesem Gerät aktiv')).toBeVisible()

  // The service worker that shows notifications is active.
  const swState = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).active?.state,
  )
  expect(swState).toBe('activated')

  const devices = await demo.player.sb.from('push_subscriptions').select('endpoint, locale, p256dh')
  expect(devices.data).toHaveLength(1)
  expect(devices.data![0]).toMatchObject({ locale: 'de', p256dh: 'BPk3-fake-p256dh-key' })
  expect(devices.data![0]!.endpoint).toMatch(/^https:\/\/push\.example\.test\//)

  await section.getByRole('button', { name: 'Deaktivieren' }).click()
  await expect(section.getByText('Auf diesem Gerät aus')).toBeVisible()
  const after = await demo.player.sb.from('push_subscriptions').select('id')
  expect(after.data).toHaveLength(0)
  await context.close()
})
