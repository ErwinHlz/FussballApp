/**
 * New dates via the + button, including the "event" type (team evening, tournament, …).
 */
import { addDays, format } from 'date-fns'
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

test('coach adds a team event with the + button, the player answers it', async ({ browser }) => {
  const demo = await seedDemo()

  const coach = await (await browser.newContext()).newPage()
  await login(coach, demo.coach.email)
  await coach.screenshot({ path: 'e2e/__screens__/79-events-head.png' })
  await coach.getByRole('button', { name: 'Termin anlegen' }).click()
  const sheet = coach.getByRole('dialog')
  for (const option of ['Training', 'Trainingsserie', 'Spiel', 'Event']) {
    await expect(sheet.getByRole('button', { name: new RegExp(`^${option} `) })).toBeVisible()
  }
  await coach.waitForTimeout(300)
  await coach.screenshot({ path: 'e2e/__screens__/80-new-date.png' })
  await sheet.getByRole('button', { name: /^Event / }).click()

  // Quick create: the title is required, the date comes as a suggestion.
  await expect(sheet).toHaveAccessibleName('Neues Event')
  await coach.getByRole('button', { name: 'Anlegen', exact: true }).click()
  await expect(sheet.getByText('Pflichtfeld', { exact: true })).toBeVisible()

  await sheet.getByLabel('Titel').fill('Teamabend')
  await sheet.getByLabel('Anderes Datum').fill(format(addDays(new Date(), 2), 'yyyy-MM-dd'))
  await coach.getByRole('button', { name: 'Anlegen', exact: true }).click()

  await expect(coach).toHaveURL(/\/events\/[0-9a-f-]{36}$/)
  await expect(coach.getByRole('heading', { level: 1 })).toHaveText('Teamabend')
  await expect(coach.getByText('Trainingsplan')).toHaveCount(0)

  // The player sees it with its title and answers.
  const player = await (await browser.newContext()).newPage()
  await login(player, demo.player.email)
  const card = player.locator('article, li').filter({ hasText: 'Teamabend' }).first()
  await expect(card).toBeVisible()
  await player.screenshot({ path: 'e2e/__screens__/81-events-with-event.png', fullPage: true })
})

test('a player attends all open dates, filters the list and jumps back to the top', async ({
  page,
}) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  await expect(page.getByRole('button', { name: '+' })).toHaveCount(0)

  // Filter: only matches.
  await page.getByRole('button', { name: 'Filter' }).click()
  const filter = page.getByRole('dialog', { name: 'Filter' })
  await filter.getByRole('button', { name: 'Spiel', exact: true }).click()
  await page.screenshot({ path: 'e2e/__screens__/82-events-filter.png' })
  await filter.getByRole('button', { name: /^Zeigen/ }).click()
  await expect(page.getByRole('button', { name: 'Filter (1 aktiv)' })).toBeVisible()
  await expect(page.getByText('vs. FC Nachbarort').first()).toBeVisible()
  await expect(page.locator('.event-row--training')).toHaveCount(0)
  await page.getByRole('button', { name: 'Filter (1 aktiv)' }).click()
  await filter.getByRole('button', { name: 'Filter zurücksetzen' }).click()
  await filter.getByRole('button', { name: 'Schließen' }).click()

  // Attend all open dates at once.
  await page.getByRole('button', { name: 'Alle zusagen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('offene Termine')
  await dialog.getByRole('button', { name: /^Zusagen/ }).click()
  await expect(page.getByText(/Termine zugesagt/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alle zusagen' })).toHaveCount(0)
  await expect(page.getByText('noch nicht beantwortet')).toHaveCount(0)

  // Back to top after scrolling down (once the sheet is gone, it would take the wheel).
  await expect(dialog).toBeHidden()
  await expect(page.locator('.sheet')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Nach oben' })).toHaveCount(0)
  await page.mouse.wheel(0, 3000)
  await page.getByRole('button', { name: 'Nach oben' }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50)
})
