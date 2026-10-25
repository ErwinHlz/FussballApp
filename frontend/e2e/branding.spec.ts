/**
 * Club branding: the admin uploads a logo, the app suggests its colors and themes itself.
 */
import { crc32, deflateSync } from 'node:zlib'
import { expect, test, type Page } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

/** Minimal PNG encoder: white background, red block, blue stripe. */
function logoPng(size = 120): Buffer {
  const rows: number[] = []
  for (let y = 0; y < size; y++) {
    rows.push(0) // filter: none
    for (let x = 0; x < size; x++) {
      const red = x > 20 && x < 100 && y > 20 && y < 80
      const blue = y >= 90 && y < 105
      const [r, g, b] = red ? [0xc8, 0x10, 0x2e] : blue ? [0x1d, 0x4e, 0xd8] : [255, 255, 255]
      rows.push(r, g, b)
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8 bit, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const primary = (page: Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
  )

test('the logo gives the club color; every account can pick its own', async ({ browser }) => {
  const demo = await seedDemo()

  const admin = await (await browser.newContext()).newPage()
  await login(admin, demo.coach.email, `/clubs/${demo.club.id}`)
  expect(await primary(admin)).toBe('#3f6212')
  // No color picker for the club any more.
  await expect(admin.getByRole('button', { name: /Farbe aus dem Logo/ })).toHaveCount(0)

  // Logo and color are folded away on the club page (UX-PLAN X6).
  await admin.getByText('Vereinslogo', { exact: true }).click()
  await admin.getByLabel('Logo hochladen').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: logoPng(),
  })
  await expect(admin.getByText('Vereinsfarbe aus dem Logo: #c8102e')).toBeVisible()
  await admin.getByRole('button', { name: 'Speichern' }).click()
  await expect(admin.getByRole('status')).toContainText('Gespeichert')
  await expect.poll(() => primary(admin)).toBe('#c8102e')
  await expect(admin.locator('.top-bar__logo')).toBeVisible()
  await admin.screenshot({ path: 'e2e/__screens__/50-branding.png', fullPage: true })

  // A player in dark mode: logo in the header, the club color lightened for readability.
  const player = await (await browser.newContext({ colorScheme: 'dark' })).newPage()
  await login(player, demo.player.email)
  await expect
    .poll(() =>
      player.locator('.top-bar__logo').evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0)
  const dark = await primary(player)
  expect(dark).not.toBe('#c6f25b')
  expect(dark).not.toBe('#c8102e')
  await player.screenshot({ path: 'e2e/__screens__/51-branding-dark.png' })

  // The player picks an own color in the profile: club color is the default, logo colors
  // are offered, Rondo green brings back the app's color.
  await player.goto('/profile')
  const accent = player.getByRole('group', { name: 'Akzentfarbe' })
  await expect(accent.getByRole('button', { name: /^Vereinsfarbe/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // The stored logo is compressed, so its colors may shift slightly: take the first one.
  await accent
    .getByRole('button', { name: /^Farbe aus dem Vereinslogo / })
    .first()
    .click()
  await expect(player.getByText('Akzentfarbe gespeichert')).toBeVisible()
  await expect.poll(() => primary(player)).not.toBe(dark)
  const blue = await primary(player)
  await accent.getByRole('button', { name: 'Rondo-Grün' }).click()
  await expect.poll(() => primary(player)).toBe('#c6f25b')

  // Only the player's account changed: the admin still sees the club color.
  await admin.reload()
  await expect.poll(() => primary(admin)).toBe('#c8102e')
  expect(blue).not.toBe('#c8102e')

  // Back to the club color.
  await accent.getByRole('button', { name: /^Vereinsfarbe/ }).click()
  await expect.poll(() => primary(player)).toBe(dark)
})

test('an account manages only one club', async ({ page }) => {
  const demo = await seedDemo()
  // Founding a club lives in the profile (UX-PLAN X5).
  await login(page, demo.coach.email, '/profile')
  await expect(page.getByText('Du verwaltest bereits einen Verein.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Weiteren Verein anlegen' })).toHaveCount(0)
  // The database refuses it, too.
  const { error } = await demo.coach.sb.rpc('create_club', { p_name: 'Zweitverein' })
  expect(error?.hint).toBe('already_admin')
})
