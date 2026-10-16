/**
 * Core flows in a real browser on a phone viewport, against the local Supabase stack.
 * Each test seeds its own demo club, so tests are independent.
 */
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { PASSWORD, seedDemo } from './support/seed'

test('login redirects back, rejects wrong passwords and signs out', async ({ page }) => {
  const demo = await seedDemo()
  // Expected errors (wrong password) must be shown in the UI, not crash into the console.
  const consoleErrors: string[] = []
  // (The browser's own "Failed to load resource" network log is expected for a 400.)
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
      consoleErrors.push(m.text())
    }
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))

  await page.goto('/squad')
  await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)squad$/)

  await page.getByLabel('E-Mail').fill(demo.player.email)
  await page.getByLabel('Passwort', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('alert')).toContainText('E-Mail oder Passwort ist falsch')
  expect(consoleErrors).toEqual([])

  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/squad$/)
  await expect(page).toHaveTitle('Kader · Rondo')

  await page.getByRole('link', { name: 'Profil' }).click()
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page).toHaveURL(/\/login/)
})

test('player answers on the start page, the coach sees it live', async ({ browser }) => {
  const demo = await seedDemo()
  const coachContext = await browser.newContext()
  const playerContext = await browser.newContext()
  const coach = await coachContext.newPage()
  const player = await playerContext.newPage()

  await login(coach, demo.coach.email, `/events/${demo.match.id}`)
  const yesCount = coach.locator('.overview__total--yes .overview__total-count')
  await expect(yesCount).toContainText('4')

  await login(player, demo.player.email, '/')
  const next = player.locator('.next')
  await expect(next).toContainText('Training')
  // Different group per drill: shown per drill (Rondo: Rot, Abschlussspiel: Blau).
  await expect(next.locator('.bib-chip', { hasText: 'Rondo 4 gegen 2' })).toContainText('Rot')
  // The match waits for an answer below the next event: answer there.
  const matchRow = player.locator('.event-row', { hasText: 'FC Nachbarort' })
  await matchRow.getByRole('button', { name: 'Zusage' }).click()
  await expect(matchRow.getByRole('button', { name: 'Zusage' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(matchRow).toContainText('Du bist dabei')

  // Live update via Supabase Realtime, no reload on the coach side.
  await expect(yesCount).toContainText('5')
  await expect(coach.locator('.overview__group', { hasText: 'Zusagen' })).toContainText('Pia')

  await coachContext.close()
  await playerContext.close()
})

test('declining asks for a reason and shows it to the coach', async ({ browser }) => {
  const demo = await seedDemo()
  const player = await (await browser.newContext()).newPage()
  await login(player, demo.player.email, `/events/${demo.training.id}`)

  await player.getByRole('button', { name: 'Absage', exact: true }).click()
  const dialog = player.getByRole('dialog', { name: 'Absagen' })
  // Note first, then one tap on the reason saves the decline.
  await dialog.getByLabel('Bemerkung (optional)').fill('Erkältet')
  await dialog.getByRole('button', { name: 'Krank' }).click()
  await expect(dialog).toBeHidden()
  await expect(player.getByText('Abgesagt', { exact: true })).toBeVisible()

  const coach = await (await browser.newContext()).newPage()
  await login(coach, demo.coach.email, `/events/${demo.training.id}`)
  await expect(coach.locator('.overview__group', { hasText: 'Absagen' })).toContainText(
    'Krank: Erkältet',
  )
  // The plan was published before: the coach is warned about the late decline.
  await expect(coach.getByText(/nach dem Veröffentlichen abgesagt/)).toBeVisible()
})

test('coach builds and publishes a plan, the player sees it', async ({ browser }) => {
  const demo = await seedDemo()
  const coach = await (await browser.newContext()).newPage()
  const nextTraining = demo.training

  // Back to draft, then add a drill through the picker.
  await login(coach, demo.coach.email, `/events/${nextTraining.id}/plan`)
  await coach.getByRole('button', { name: 'Zurück auf Entwurf' }).click()
  await expect(coach.getByText('Entwurf', { exact: true })).toBeVisible()
  await coach.getByRole('button', { name: 'Übung hinzufügen' }).click()
  const picker = coach.getByRole('dialog', { name: 'Übung hinzufügen' })
  await picker.getByLabel('Suchen').fill('Torschuss')
  await picker.getByRole('button', { name: /Torschuss nach Doppelpass/ }).click()
  await expect(coach.locator('.plan-item')).toHaveCount(4)
  await expect(coach.getByText(/70 Min\. geplant/)).toBeVisible()

  // Reordering without dragging: "⋯" on the row, then "Nach oben".
  await coach.getByRole('button', { name: 'Aktionen für Torschuss nach Doppelpass' }).click()
  await coach.getByRole('dialog').getByRole('button', { name: 'Nach oben' }).click()
  await expect(coach.locator('.plan-item').nth(2)).toContainText('Torschuss nach Doppelpass')

  await coach.getByRole('button', { name: 'Plan veröffentlichen' }).click()
  await expect(coach.getByText('Veröffentlicht', { exact: true })).toBeVisible()

  const player = await (await browser.newContext()).newPage()
  await login(player, demo.player.email, `/events/${nextTraining.id}`)
  const flow = player.locator('.flow__item')
  await expect(flow).toHaveCount(4)
  await expect(flow.nth(2)).toContainText('Torschuss nach Doppelpass')
})

test('coach assigns a group by tapping, the player sees the bib color', async ({ browser }) => {
  const demo = await seedDemo()
  const coach = await (await browser.newContext()).newPage()
  await login(coach, demo.coach.email, `/events/${demo.training.id}/groups`)

  // First drill (warm-up) has no groups yet: create two and move Pia into "Blau".
  await coach.getByRole('button', { name: 'Gruppe hinzufügen' }).click()
  await coach.getByRole('button', { name: 'Gruppe hinzufügen' }).click()
  await coach.locator('.groups__box--pool .chip', { hasText: 'Pia' }).click()
  await coach
    .locator('.groups__grid .groups__box')
    .nth(1)
    .getByRole('button', { name: 'Hierher' })
    .click()
  await expect(coach.locator('.groups__grid .groups__box').nth(1)).toContainText('Pia')
  await coach.getByRole('button', { name: 'Gruppen speichern' }).click()
  await expect(coach.getByRole('button', { name: /Gespeichert/ })).toBeVisible()

  const player = await (await browser.newContext()).newPage()
  await login(player, demo.player.email, `/events/${demo.training.id}`)
  const warmUp = player.locator('.flow__item', { hasText: 'Aufwärmen mit Ball' })
  await expect(warmUp.locator('.bib-chip')).toHaveText('Blau')
})

test('a vacation declines events automatically and the coach sees it', async ({ browser }) => {
  const demo = await seedDemo()
  const player = await (await browser.newContext()).newPage()
  await login(player, demo.player.email, '/profile')

  // Vacation from today until in 4 days (covers the match in 3 days).
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  await player.getByRole('button', { name: 'Abwesenheit eintragen' }).click()
  await player.getByLabel('Von').fill(day(0))
  await player.getByLabel('Bis (einschließlich)').fill(day(4))
  await player.getByRole('button', { name: 'Urlaub' }).click()
  await player.getByRole('button', { name: 'Abwesenheit speichern' }).click()
  await expect(player.getByText(/Termine? abgesagt/)).toBeVisible()
  // The training tomorrow was already answered "yes" (by the coach): explicit answers win.

  const coach = await (await browser.newContext()).newPage()
  await login(coach, demo.coach.email, `/events/${demo.match.id}`)
  await expect(coach.locator('.overview__group', { hasText: 'Absagen' })).toContainText(
    'Urlaub · Abwesenheit',
  )
  await coach.goto('/squad')
  await expect(coach.locator('#squad-away')).toBeVisible()
  await expect(coach.getByText('Urlaub').first()).toBeVisible()
})
