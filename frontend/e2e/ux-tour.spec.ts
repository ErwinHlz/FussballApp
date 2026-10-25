/**
 * UX tour (UX-PLAN.md, phase X7): every main page as player and coach, light and dark, 375 px.
 * Writes screenshots and a report (page height, controls below the fold, touch targets under
 * 44 px) to e2e/__tour__/ for visual review. Fails on horizontal scrolling and console errors.
 * Run: npm run test:tour (local Supabase running; the test seeds its own demo club).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { addDays, format, startOfWeek } from 'date-fns'
import { expect, test, type Page } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

const OUT = 'e2e/__tour__'

type PageReport = {
  role: string
  page: string
  path: string
  /** Page height in screen heights. */
  screens: number
  controls: number
  belowFold: number
  smallTargets: string[]
}

/** Layout metrics of the current page (interactive elements, fold, touch targets). */
function measure(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight
    const navTop = document.querySelector('.tab-bar')?.getBoundingClientRect().top ?? vh
    const fixed = '.tab-bar, .top-bar, .action-bar, .area-nav'
    const items = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [role=button], [role=tab], [role=radio]',
      ),
    ].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    })
    const label = (el: HTMLElement) =>
      (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim()
    return {
      screens: Math.round((document.documentElement.scrollHeight / vh) * 100) / 100,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls: items.length,
      belowFold: items.filter(
        (el) => !el.closest(fixed) && el.getBoundingClientRect().top + window.scrollY > navTop,
      ).length,
      smallTargets: items
        .filter((el) => !['INPUT', 'TEXTAREA'].includes(el.tagName))
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width < 44 || r.height < 44
        })
        .map((el) => {
          const r = el.getBoundingClientRect()
          return `${label(el).slice(0, 40)} ${Math.round(r.width)}×${Math.round(r.height)}`
        }),
    }
  })
}

const reports: PageReport[] = []

async function visit(page: Page, role: string, name: string, path: string, errors: string[]) {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    errors.length = 0
    await page.goto(path)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('h1').first()).toBeAttached()
    await expect(page.getByText(/^Lädt/)).toHaveCount(0)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${role}-${name}-${scheme}.png` })
    if (scheme === 'light') {
      await page.screenshot({ path: `${OUT}/${role}-${name}-full.png`, fullPage: true })
      const m = await measure(page)
      expect.soft(m.overflowX, `horizontal scrolling on ${path}`).toBeLessThanOrEqual(0)
      reports.push({ role, page: name, path, ...m })
    }
    expect.soft(errors, `console errors on ${path} (${scheme})`).toEqual([])
  }
}

/** Signs in and waits until the app is there (the session must be stored before navigating). */
async function signIn(page: Page, email: string) {
  await login(page, email, '/')
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible()
}

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe.configure({ mode: 'serial' })

test('tour: every page as player and coach, light and dark', async ({ browser }) => {
  test.setTimeout(240_000)
  mkdirSync(OUT, { recursive: true })
  const demo = await seedDemo()
  const drill = '0d000000-0000-4000-8000-000000000001'

  const player = await (await browser.newContext()).newPage()
  const playerErrors = trackErrors(player)
  await signIn(player, demo.player.email)
  for (const [name, path] of [
    ['home', '/'],
    ['events', '/events'],
    ['schedule', '/events/schedule'],
    ['training', `/events/${demo.training.id}`],
    ['match', `/events/${demo.match.id}`],
    ['drills', '/drills'],
    ['drill', `/drills/${drill}`],
    ['squad', '/squad'],
    ['stats', '/stats'],
    ['teams', '/teams'],
    ['profile', '/profile'],
  ] as const)
    await visit(player, 'player', name, path, playerErrors)

  // The demo coach founded the club: coach and club admin.
  const coach = await (await browser.newContext()).newPage()
  const coachErrors = trackErrors(coach)
  await signIn(coach, demo.coach.email)
  for (const [name, path] of [
    ['home', '/'],
    ['events', '/events'],
    ['event-create', '/events/new'],
    ['new-training', '/events/new/training'],
    ['new-match', '/events/new/match'],
    ['training', `/events/${demo.training.id}`],
    ['plan', `/events/${demo.training.id}/plan`],
    ['groups', `/events/${demo.training.id}/groups`],
    ['match', `/events/${demo.match.id}`],
    ['match-squad', `/events/${demo.match.id}/squad`],
    ['training-list', '/training'],
    ['drills', '/drills'],
    ['drill-new', '/drills/new'],
    ['boards', '/boards'],
    ['templates', '/templates'],
    ['squad', '/squad'],
    ['stats', '/stats'],
    ['club', `/clubs/${demo.club.id}`],
    ['schedule-setup', `/clubs/${demo.club.id}/schedule/setup`],
    ['profile', '/profile'],
  ] as const)
    await visit(coach, 'coach', name, path, coachErrors)

  writeFileSync(`${OUT}/report.json`, JSON.stringify(reports, null, 2))
  const rows = reports.map(
    (r) =>
      `| ${r.role} | ${r.page} | ${r.screens} | ${r.controls} | ${r.belowFold} | ${r.smallTargets.length ? r.smallTargets.join('; ') : '–'} |`,
  )
  writeFileSync(
    `${OUT}/report.md`,
    [
      '# UX-Tour',
      '',
      `${new Date().toISOString()} · 375 × 740 px · Bildschirmhöhen = Seitenhöhe / Bildschirmhöhe`,
      '',
      '| Rolle | Seite | Bildschirmhöhen | Bedienelemente | unter dem Falz | Touch-Ziele < 44 px |',
      '|---|---|---|---|---|---|',
      ...rows,
      '',
    ].join('\n'),
  )
})

test('on a Sunday the week strip and the schedule still show what comes next', async ({ page }) => {
  const demo = await seedDemo()
  await demo.coach.sb.from('pitches').insert({ club_id: demo.club.id, name: 'Rasen' })
  // The last Sunday (a past time keeps the session tokens valid), 10:00.
  const sunday = startOfWeek(new Date(), { weekStartsOn: 0 })
  sunday.setHours(10, 0, 0, 0)
  await page.clock.setFixedTime(sunday)
  await signIn(page, demo.coach.email)

  // Week strip: today (Sunday) and the six days after it.
  const strip = page.getByRole('navigation', { name: 'Die nächsten 7 Tage' })
  const days = strip.getByRole('button')
  await expect(days).toHaveCount(7)
  await expect(days.first()).toContainText(format(sunday, 'd'))
  await expect(days.last()).toContainText(format(addDays(sunday, 6), 'd'))

  // Schedule: Monday to Sunday of the running week, Sunday included.
  await page.goto('/events/schedule')
  await expect(
    page.getByRole('region', {
      name: /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),/,
    }),
  ).toHaveCount(7)
  await expect(
    page.getByRole('region', { name: new RegExp(`^Sonntag, ${format(sunday, 'd')}\\.`) }),
  ).toHaveCount(1)
})
