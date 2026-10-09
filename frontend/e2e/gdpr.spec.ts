/**
 * GDPR flows against the real backend: consent on sign-up, data export and account deletion.
 */
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { PASSWORD } from './support/seed'

test('a new user consents, downloads the data and deletes the account', async ({ page }) => {
  const email = `gdpr-${Date.now()}@example.test`

  await page.goto('/register')
  await page.getByLabel('Anzeigename').fill('Dana Daten')
  await page.getByLabel('E-Mail').fill(email)
  const passwords = page.locator('input[autocomplete="new-password"]')
  await passwords.nth(0).fill(PASSWORD)
  await passwords.nth(1).fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto erstellen' }).click()
  await expect(page.getByText('Bitte bestätigen')).toBeVisible()

  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Konto erstellen' }).click()
  await expect(page).not.toHaveURL(/register/)

  await page.goto('/profile')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Meine Daten herunterladen' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^rondo-daten-\d{4}-\d{2}-\d{2}\.json$/)
  const data = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(data.account.email).toBe(email)
  expect(data.profile.display_name).toBe('Dana Daten')

  await page.getByRole('button', { name: 'Konto löschen' }).click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' })
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('textbox').fill('LÖSCHEN')
  await confirm.click()

  await expect(page).toHaveURL(/\/login\?deleted=1/)
  await expect(page.getByRole('status')).toHaveText('Dein Konto wurde gelöscht.')

  // The account is really gone.
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('alert')).toContainText('E-Mail oder Passwort ist falsch')
})

test('legal pages are public and highlight the template gaps', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Impressum' }).click()
  await expect(page).toHaveURL(/\/imprint$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impressum')
  await expect(page.locator('mark').first()).toBeVisible()

  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datenschutzerklärung')
  await expect(page).toHaveTitle('Datenschutz · Rondo')
})
