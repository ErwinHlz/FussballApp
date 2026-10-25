/**
 * Club page and lists (UX-PLAN.md, phase X6): teams first, admins by search, logo folded away;
 * drills as a list (tiles on request, remembered); squad filters in a sheet; save bar in forms.
 */
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

test('the club page: add a team in a sheet, appoint an admin by search', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, `/clubs/${demo.club.id}`)

  // Order: teams, schedule, admins, then the folded appearance.
  const headings = page.locator('main h2')
  await expect(headings).toHaveText(['Mannschaften', 'Belegungsplan', 'Admins'])
  await expect(page.getByLabel('Logo hochladen')).toBeHidden()

  await page.getByRole('button', { name: 'Mannschaft anmelden' }).click()
  const sheet = page.getByRole('dialog', { name: 'Mannschaft anmelden' })
  await sheet.getByLabel('Name der Mannschaft').fill('U15')
  await sheet.getByRole('button', { name: 'Mannschaft anmelden' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('heading', { name: /^U15/ })).toBeVisible()

  await page.getByRole('button', { name: 'Admin ernennen' }).click()
  const appoint = page.getByRole('dialog', { name: 'Admin ernennen' })
  await appoint.getByLabel('Mitglied suchen').fill('pia')
  await expect(appoint.getByRole('button')).toContainText(['Pia'])
  await appoint.getByRole('button', { name: /Pia/ }).click()
  await expect(appoint).toBeHidden()
  await expect(page.locator('.club__members')).toContainText('Pia')
})

test('drills: compact list by default, tiles on request and remembered', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, '/drills')
  await expect(page.getByRole('radio', { name: 'Liste' })).toBeChecked()
  await expect(page.locator('.drill-tile--row').first()).toBeVisible()

  await page.getByRole('radio', { name: 'Kacheln' }).click()
  await expect(page.locator('.drills__grid')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Kacheln' })).toBeChecked()
})

test('squad filters live in a sheet; the active one is a removable pill', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, '/squad')
  await expect(page.getByRole('group', { name: 'Status' })).toHaveCount(0)

  const names = page.locator('[aria-labelledby="squad-players"] .squad__name')
  await page.getByRole('button', { name: 'Spieler filtern' }).click()
  const sheet = page.getByRole('dialog', { name: 'Spieler filtern' })
  await sheet.getByRole('group', { name: 'Status' }).getByText('Verletzt').click()
  await sheet.getByRole('button', { name: /Spieler anzeigen/ }).click()
  await expect(names).toHaveText(['Ben'])

  await page.getByRole('button', { name: 'Filter Verletzt entfernen' }).click()
  await expect(names).toHaveCount(8)
})

test('the event form keeps "Speichern" in reach at the bottom', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, '/events/new/match')
  await expect(page.getByRole('heading', { name: 'Neues Spiel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeInViewport()
})
