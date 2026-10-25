/**
 * Tidier navigation (UX-PLAN.md, phase X5): players' training tab is the drills, the team area
 * has no teams tab any more (team switcher instead), absences are one tap from the start page
 * and from the decline sheet.
 */
import { addDays, format } from 'date-fns'
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

test('players get the drills in the training tab, coaches the four areas', async ({ browser }) => {
  const demo = await seedDemo()

  const player = await (await browser.newContext()).newPage()
  await login(player, demo.player.email, '/')
  await player.getByRole('navigation', { name: 'Hauptnavigation' }).getByText('Training').click()
  await expect(player).toHaveURL(/\/drills$/)
  await expect(player.getByRole('heading', { name: 'Übungen', level: 1 })).toBeInViewport()
  await expect(player.getByRole('navigation', { name: 'Bereiche im Training' })).toHaveCount(0)
  // An old link to the trainings list leads to the drills too.
  await player.goto('/training')
  await expect(player).toHaveURL(/\/drills$/)

  const coach = await (await browser.newContext()).newPage()
  await login(coach, demo.coach.email, '/training')
  const areas = coach.getByRole('navigation', { name: 'Bereiche im Training' })
  await expect(areas.getByRole('link')).toHaveText(['Trainings', 'Übungen', 'Taktik', 'Vorlagen'])
  await expect(coach.getByRole('link', { name: /Belegungsplan/ })).toHaveCount(0)
})

test('teams and clubs are managed from the team switcher', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email, '/squad')
  const areas = page.getByRole('navigation', { name: /Bereiche/ })
  await expect(areas.getByRole('link')).toHaveText(['Kader', 'Statistik'])

  await page.getByRole('button', { name: /Mannschaft wechseln/ }).click()
  await page.getByRole('button', { name: 'Mannschaften verwalten' }).click()
  await expect(page).toHaveURL(/\/teams$/)
  await expect(page.getByRole('heading', { name: 'Meine Mannschaften', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: /Verein anlegen/ })).toHaveCount(0)

  await page.goto('/profile')
  await expect(page.getByRole('button', { name: 'Weiteren Verein anlegen' })).toBeVisible()
})

test('a player enters a holiday from the start page in three taps', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email, '/')
  const from = addDays(new Date(), 5)
  const until = addDays(new Date(), 12)

  // Tap 1, without scrolling.
  const away = page.getByRole('button', { name: 'Abwesend?' })
  await expect(away).toBeInViewport()
  await away.click()
  const sheet = page.getByRole('dialog', { name: 'Abwesenheit eintragen' })
  await sheet.getByLabel('Von').fill(format(from, 'yyyy-MM-dd'))
  await sheet.getByLabel('Bis (einschließlich)').fill(format(until, 'yyyy-MM-dd'))
  // Tap 2: the reason ("Urlaub" is preselected; tapping it keeps it). Tap 3: save.
  await sheet.getByRole('button', { name: 'Urlaub' }).click()
  await sheet.getByRole('button', { name: 'Abwesenheit speichern' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByText(/Gespeichert – \d+ Termin/)).toBeVisible()
})

test('the decline sheet leads to an absence for longer times away', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email, `/events/${demo.match.id}`)
  await page.getByRole('button', { name: 'Absage', exact: true }).click()
  const decline = page.getByRole('dialog', { name: 'Absagen' })
  await decline.getByRole('button', { name: 'Länger weg? Abwesenheit eintragen' }).click()
  await expect(decline).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Abwesenheit eintragen' })).toBeVisible()
})
