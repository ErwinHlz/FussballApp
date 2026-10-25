import { expect, type Page } from '@playwright/test'
import { PASSWORD } from './seed'

export async function login(page: Page, email: string, redirect = '/events') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(new RegExp(redirect.replace(/[?]/g, '\\?')))
  // "/" also matches "/login?redirect=…": wait until the sign-in has really left the login page.
  await expect(page).not.toHaveURL(/\/login/)
}
