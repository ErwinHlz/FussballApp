/**
 * Debug account switcher (development builds only). Needs the dev data from `npm run seed:dev`;
 * skipped without it, so the suite never changes that data.
 */
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { DEV_PASSWORD } from '../src/dev/accounts'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './support/seed'

test('the debug switcher signs in as a test account and switches to another', async ({ page }) => {
  const probe = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
  const { error } = await probe.auth.signInWithPassword({
    email: 'trainer.u17@rondo.test',
    password: DEV_PASSWORD,
  })
  test.skip(!!error, 'dev data missing: run npm run seed:dev')

  // Browser tests hide the tool unless it is turned on.
  await page.addInitScript(() => localStorage.setItem('rondo.devTools', 'on'))
  await page.goto('/login')
  await page.getByRole('button', { name: 'Debug: Konto wechseln' }).click()
  const sheet = page.getByRole('dialog', { name: 'Konto wechseln (Debug)' })
  await sheet.getByRole('button', { name: /Tom Trainer/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Start' })).toBeVisible()
  await expect(page.getByRole('button', { name: /U17/ }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Debug: Konto wechseln' }).click()
  await expect(sheet.getByRole('button', { name: /Tom Trainer/ })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await sheet.getByRole('button', { name: /Lena Krüger/ }).click()
  await expect(page.getByRole('button', { name: /Damen/ }).first()).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Team' })
    .click()
  await expect(page.getByText('Clara Schmitt')).toBeVisible()
  await expect(page.getByText('Jonas Keller')).toHaveCount(0)
})
