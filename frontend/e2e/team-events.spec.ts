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
  await coach.getByRole('button', { name: 'Termin anlegen' }).click()
  const sheet = coach.getByRole('dialog')
  for (const option of ['Training', 'Trainingsserie', 'Spiel', 'Event']) {
    await expect(sheet.getByRole('button', { name: new RegExp(`^${option} `) })).toBeVisible()
  }
  await coach.waitForTimeout(300)
  await coach.screenshot({ path: 'e2e/__screens__/80-new-date.png' })
  await sheet.getByRole('button', { name: /^Event / }).click()

  await expect(coach.getByRole('heading', { level: 1 })).toHaveText('Neues Event')
  await coach.getByRole('button', { name: 'Speichern' }).click()
  await expect(coach.getByText('Pflichtfeld', { exact: true })).toBeVisible()

  await coach.getByLabel('Titel').fill('Teamabend')
  await coach.getByLabel('Datum').fill(format(addDays(new Date(), 2), 'yyyy-MM-dd'))
  await coach.getByLabel('Ort').fill('Vereinsheim')
  await coach.getByRole('button', { name: 'Speichern' }).click()

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
