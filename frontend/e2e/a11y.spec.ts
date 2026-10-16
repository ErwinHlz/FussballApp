/**
 * Accessibility in every browser: automatic WCAG 2.1 AA checks (axe) on the main pages for
 * players and coaches, light and dark, plus keyboard operation and touch target sizes.
 * Run: npm run test:browsers (Supabase must be running).
 */
import type { Page } from '@playwright/test'
import { login } from './support/app'
import { expect, expectAccessible, ready, test } from './support/fixtures'
import { seedDemo } from './support/seed'

/** Public library drill with an animation (from supabase/seed.sql). */
const ANIMATED_DRILL = '/drills/0d000000-0000-4000-8000-000000000001'

async function checkPages(page: Page, paths: string[]) {
  for (const path of paths) {
    await test.step(path, async () => {
      await page.goto(path)
      await ready(page)
      await expectAccessible(page)
    })
  }
}

test.describe('axe: WCAG 2.1 AA', () => {
  // Each test scans many pages; axe is noticeably slower in Firefox.
  test.describe.configure({ timeout: 180_000 })

  test('public pages', async ({ page }) => {
    await checkPages(page, ['/login', '/register', '/forgot-password', '/privacy', '/imprint'])
  })

  test('design system in light and dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await test.step(scheme, async () => {
        await page.emulateMedia({ colorScheme: scheme })
        await page.goto('/dev/ui')
        await ready(page)
        await expectAccessible(page)
      })
    }
    await page.getByRole('button', { name: 'Sheet öffnen' }).click()
    await expect(page.getByRole('dialog', { name: 'Absagen' })).toBeVisible()
    await page.waitForTimeout(300)
    await expectAccessible(page, { include: '[role="dialog"]' })
  })

  test('player pages', async ({ page }) => {
    const demo = await seedDemo()
    await login(page, demo.player.email)
    await checkPages(page, [
      '/',
      '/events',
      `/events/${demo.training.id}`,
      `/events/${demo.match.id}`,
      '/training',
      '/drills',
      ANIMATED_DRILL,
      '/squad',
      '/stats',
      '/profile',
      '/teams',
    ])
  })

  test('coach pages', async ({ page }) => {
    const demo = await seedDemo()
    await login(page, demo.coach.email)
    await checkPages(page, [
      '/',
      '/events',
      `/events/${demo.training.id}`,
      `/events/${demo.match.id}`,
      `/events/${demo.training.id}/plan`,
      `/events/${demo.training.id}/groups`,
      `/events/${demo.training.id}/edit`,
      '/events/new/training',
      '/events/new/series',
      '/events/new/match',
      '/drills',
      '/drills/new',
      '/boards',
      '/templates',
      '/squad',
      `/clubs/${demo.club.id}`,
    ])
  })

  test('dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    const demo = await seedDemo()
    await checkPages(page, ['/login'])
    await login(page, demo.coach.email)
    await checkPages(page, [
      '/',
      '/events',
      `/events/${demo.training.id}`,
      `/events/${demo.match.id}`,
      `/events/${demo.training.id}/groups`,
      ANIMATED_DRILL,
      '/squad',
      '/profile',
    ])
  })

  test('open dialogs', async ({ page }) => {
    const demo = await seedDemo()
    await login(page, demo.player.email, `/events/${demo.match.id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Absage', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Absagen' })).toBeVisible()
    await page.waitForTimeout(300)
    // The page behind is checked by the page tests; here only the dialog.
    await expectAccessible(page, { include: '[role="dialog"]' })

    const coach = await (await page.context().browser()!.newContext()).newPage()
    await login(coach, demo.coach.email)
    await ready(coach)
    await coach.getByRole('button', { name: 'Termin anlegen' }).click()
    await expect(coach.getByRole('dialog', { name: 'Termin anlegen' })).toBeVisible()
    await coach.waitForTimeout(300)
    await expectAccessible(coach, { include: '[role="dialog"]' })
    await coach.context().close()
  })
})

test.describe('keyboard', () => {
  test('login works with the keyboard alone and the focus is visible', async ({ page }) => {
    const demo = await seedDemo()
    await page.goto('/login')
    await ready(page)

    // Tab order follows the form: e-mail, password, submit.
    const email = page.getByLabel('E-Mail')
    const password = page.getByLabel('Passwort', { exact: true })
    const submit = page.getByRole('button', { name: 'Anmelden' })
    await email.focus()
    await expect(email).toBeFocused()
    await expectVisibleFocus(page)
    await page.keyboard.type(demo.player.email)
    await tabTo(page, password)
    await page.keyboard.type('demo-pass-1234')
    await tabTo(page, submit)
    await expectVisibleFocus(page)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/events$/)
  })

  test('every control on the main pages can be reached with Tab', async ({ page }) => {
    const demo = await seedDemo()
    await login(page, demo.player.email)
    for (const path of ['/', '/events', `/events/${demo.training.id}`, '/squad', '/profile']) {
      await test.step(path, async () => {
        await page.goto(path)
        await ready(page)
        const unreachable = await page.evaluate(() => {
          const controls = [
            ...document.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary',
            ),
          ].filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
          // Tabs and radio groups use a roving tab stop on purpose (arrow keys move inside).
          const roving = (el: HTMLElement) =>
            ['tablist', 'radiogroup'].includes(el.parentElement?.getAttribute('role') ?? '')
          return controls
            .filter((el) => el.tabIndex < 0 && !roving(el))
            .map((el) => el.outerHTML.slice(0, 120))
        })
        expect.soft(unreachable, `controls removed from the tab order on ${path}`).toEqual([])
      })
    }
  })

  test('after navigating, the focus moves to the new page heading', async ({ page }) => {
    const demo = await seedDemo()
    await login(page, demo.player.email)
    await ready(page)
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await nav.getByRole('link', { name: 'Team' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Kader' })).toBeFocused()
    await page.getByRole('link', { name: 'Profil' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeFocused()
  })

  test('dialogs trap Escape and give the focus back', async ({ page }) => {
    const demo = await seedDemo()
    await login(page, demo.player.email, `/events/${demo.match.id}`)
    await ready(page)
    const decline = page.getByRole('button', { name: 'Absage', exact: true })
    await decline.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Absagen' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(decline).toBeFocused()
  })
})

test('touch targets are at least 44 × 44 px', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  for (const path of ['/', '/events', `/events/${demo.match.id}`, '/profile']) {
    await test.step(path, async () => {
      await page.goto(path)
      await ready(page)
      // Buttons and navigation links; links inside running text are exempt (WCAG 2.5.8).
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            'button, [role="button"], nav a, header a, input[type="checkbox"], input[type="radio"]',
          ),
        ]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ el, box: el.getBoundingClientRect() }))
          .filter(({ box }) => box.width < 44 || box.height < 44)
          .map(
            ({ el, box }) =>
              `${Math.round(box.width)}×${Math.round(box.height)} ${el.outerHTML.slice(0, 100)}`,
          ),
      )
      expect.soft(small, `small touch targets on ${path}`).toEqual([])
    })
  }
})

async function tabTo(page: Page, target: ReturnType<Page['locator']>) {
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((el) => el === document.activeElement)) return
  }
  throw new Error('target not reached with Tab')
}

/** The focused element must show a focus indicator (outline or box-shadow ring). */
async function expectVisibleFocus(page: Page) {
  const indicator = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const style = getComputedStyle(el)
    const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
    return outline || style.boxShadow !== 'none'
  })
  expect(indicator, 'focused element has no visible focus indicator').toBe(true)
}

test('reduced motion stops endless animations instead of speeding them up', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dev/ui')
  await ready(page)
  const shine = page.locator('.ui-skeleton__line').first()
  await expect(shine).toHaveCSS('animation-iteration-count', '1')
  await expect(shine).toHaveCSS('animation-duration', /^0\.00001s|1e-05s$/)
})
