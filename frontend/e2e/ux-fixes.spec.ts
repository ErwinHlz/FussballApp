/**
 * Fixes from the UX review (UX-PLAN.md, phase X1). Run: npm run test:e2e
 */
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

test('groups: a drill without groups is not reported as "everyone assigned" (A2)', async ({
  page,
}) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email)
  await page.goto(`/events/${demo.training.id}/groups`)
  await expect(page.getByRole('heading', { name: 'Gruppeneinteilung' })).toBeVisible()

  // The first drill (warm-up) has no groups.
  await expect(page.getByRole('heading', { name: /^Verfügbar/ })).toBeVisible()
  await expect(page.getByText('Ohne Gruppen – alle zusammen')).toBeVisible()
  await expect(page.getByText('Alle Zusagen sind eingeteilt')).toHaveCount(0)
})

test('match: the coach gets no player nomination sentence and sees unavailable nominees (A4, A5)', async ({
  page,
}) => {
  const demo = await seedDemo()
  // Lena is nominated, then declines.
  await demo.coach.sb
    .from('match_squad')
    .insert({ event_id: demo.match.id, member_id: demo.memberId('Lena'), role: 'starter' })
  await demo.coach.sb.rpc('set_attendance', {
    p_event_id: demo.match.id,
    p_member_id: demo.memberId('Lena'),
    p_status: 'no',
  })

  await login(page, demo.coach.email)
  await page.goto(`/events/${demo.match.id}`)
  await expect(page.getByRole('heading', { name: 'vs. FC Nachbarort' })).toBeVisible()
  await expect(page.getByText('Du bist für dieses Spiel nicht nominiert.')).toHaveCount(0)
  // The squad is its own view next to the overview (X3).
  await page.getByRole('link', { name: 'Kader' }).click()
  await expect(page.getByRole('heading', { name: 'Spieltagskader', level: 1 })).toBeVisible()
  await expect(page.getByText('1 Nominierter hat abgesagt oder nicht geantwortet:')).toBeVisible()
  await expect(page.getByText('(Absage)')).toBeVisible()
})

test('a page that cannot be loaded keeps its heading and leads back (A6)', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  await page.goto('/events/00000000-0000-4000-8000-000000000000')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Termin konnte nicht geladen werden.')).toBeVisible()
  await page.getByRole('link', { name: 'Zu den Terminen' }).click()
  await expect(page).toHaveURL(/\/events$/)
})

test('statistics is a tab of the team area, without a back arrow (A7)', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  await page.goto('/stats')
  await expect(page.getByRole('heading', { name: 'Statistik', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zurück' })).toHaveCount(0)
})

test('a disabled button is grey, not a faded accent, in light and dark (A8)', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email)
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto(`/events/${demo.training.id}/groups`)
    const saved = page.getByRole('button', { name: /Gespeichert/ })
    await expect(saved).toBeDisabled()
    const colors = await saved.evaluate((el) => {
      const root = getComputedStyle(document.documentElement)
      const probe = document.createElement('span')
      document.body.append(probe)
      const resolve = (name: string) => {
        probe.style.color = root.getPropertyValue(name)
        return getComputedStyle(probe).color
      }
      const result = {
        background: getComputedStyle(el).backgroundColor,
        primary: resolve('--color-primary'),
        muted: resolve('--color-surface-muted'),
      }
      probe.remove()
      return result
    })
    expect(colors.background, scheme).toBe(colors.muted)
    expect(colors.background, scheme).not.toBe(colors.primary)
  }
})

test('training list: the time stays on one line next to the plan badge (A9)', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email)
  await page.goto('/training')
  const row = page.getByRole('link', { name: /18:30/ }).first()
  await expect(row.getByText('Veröffentlicht')).toBeVisible()
  const time = row.getByText(/^18:30 – 20:00$/)
  // One line box per line of text.
  const lines = await time.evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size
  })
  expect(lines).toBe(1)
})
