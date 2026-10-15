/**
 * UI elements in every browser (Chromium, Firefox, Opera) on a 375 px phone viewport:
 * forms, navigation, answer buttons, dialogs, the create menu, filters and dark mode.
 * Run: npm run test:browsers (Supabase must be running).
 */
import { login } from './support/app'
import { expect, expectNoHorizontalScroll, ready, test, trackErrors } from './support/fixtures'
import { PASSWORD, seedDemo } from './support/seed'

test('login form: labels, validation, error message and links', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/login')
  await expect(page).toHaveTitle(/Anmelden · Rondo/)
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible()
  await expectNoHorizontalScroll(page)

  // Empty submit: field errors instead of a request.
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByLabel('E-Mail')).toHaveAttribute('aria-invalid', 'true')

  await page.getByLabel('E-Mail').fill('nobody@example.test')
  await page.getByLabel('Passwort').fill('wrong-password')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByRole('alert')).toContainText('E-Mail oder Passwort ist falsch')

  await page.getByRole('link', { name: 'Passwort vergessen?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Passwort zurücksetzen' })).toBeVisible()
  await page.goBack()
  await page.getByRole('link', { name: 'Konto erstellen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Konto erstellen' })).toBeVisible()
  await expect(page.getByLabel('Passwort wiederholen')).toBeVisible()
  await expectNoHorizontalScroll(page)
  expect(errors).toEqual([])
})

test('bottom navigation reaches every tab and marks the active one', async ({ page }) => {
  const errors = trackErrors(page)
  const demo = await seedDemo()
  await login(page, demo.coach.email)
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  const tabs = [
    ['Termine', /\/events$/, 'Termine'],
    ['Training', /\/training$/, 'Training'],
    ['Kader', /\/squad$/, 'Kader'],
    ['Verein', /\/clubs\//, 'SV Demo 09'],
    ['Profil', /\/profile$/, 'Profil'],
  ] as const
  for (const [label, url, heading] of tabs) {
    await test.step(label, async () => {
      const link = nav.getByRole('link', { name: label })
      await link.click()
      await expect(page).toHaveURL(url)
      await expect(link).toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await ready(page)
      await expectNoHorizontalScroll(page)
    })
  }
  expect(errors).toEqual([])
})

test('the back button returns to the list, also on a deep link', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  await page.locator('.event-card', { hasText: 'FC Nachbarort' }).getByRole('link').first().click()
  await expect(page).toHaveURL(new RegExp(`/events/${demo.match.id}$`))
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page).toHaveURL(/\/events$/)

  // Deep link without history: back goes to the parent page.
  await page.goto(`/events/${demo.match.id}`)
  await ready(page)
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page).toHaveURL(/\/events$/)
})

test('answer buttons toggle and the decline dialog works', async ({ page }) => {
  const errors = trackErrors(page)
  const demo = await seedDemo()
  await login(page, demo.player.email, `/events/${demo.match.id}`)
  await ready(page)
  const answers = page.getByRole('group', { name: 'Antwort' }).first()
  const yes = answers.getByRole('button', { name: /Zusage/ })
  const maybe = answers.getByRole('button', { name: /Vielleicht/ })
  const no = answers.getByRole('button', { name: /Absage/ })

  await yes.click()
  await expect(yes).toHaveAttribute('aria-pressed', 'true')
  await expect(no).toHaveAttribute('aria-pressed', 'false')
  await maybe.click()
  await expect(maybe).toHaveAttribute('aria-pressed', 'true')
  await expect(yes).toHaveAttribute('aria-pressed', 'false')

  // Decline asks for a reason; Cancel keeps the old answer, the close button too.
  await no.click()
  const dialog = page.getByRole('dialog', { name: 'Absagen' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(dialog).toBeHidden()
  await expect(maybe).toHaveAttribute('aria-pressed', 'true')
  await no.click()
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  await expect(dialog).toBeHidden()

  await no.click()
  await dialog.getByRole('button', { name: 'Arbeit' }).click()
  await dialog.getByLabel('Bemerkung (optional)').fill('Spätschicht')
  await dialog.getByRole('button', { name: 'Absage' }).click()
  await expect(dialog).toBeHidden()
  await expect(no).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('the create menu offers all event types and opens the form', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email)
  await ready(page)
  await page.getByRole('button', { name: 'Termin anlegen' }).click()
  const menu = page.getByRole('dialog', { name: 'Termin anlegen' })
  for (const kind of ['Training', 'Trainingsserie', 'Spiel', 'Event']) {
    // Name = label + hint ("Training Einzelnes Training"), so match the label as a whole word.
    await expect(menu.getByRole('button', { name: new RegExp(`^${kind} `) })).toBeVisible()
  }
  // Clicking the backdrop closes the menu.
  await page.mouse.click(10, 10)
  await expect(menu).toBeHidden()

  await page.getByRole('button', { name: 'Termin anlegen' }).click()
  await menu.getByRole('button', { name: /^Spiel\s/ }).click()
  await expect(page).toHaveURL(/\/events\/new\/match$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Neues Spiel' })).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('the filter panel narrows the list and is remembered', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  await ready(page)
  const toggle = page.getByRole('button', { name: /^Filter/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const panel = page.getByRole('region', { name: 'Filter' })
  await panel.getByRole('button', { name: 'Spiel' }).click()
  await expect(page.getByRole('button', { name: 'Filter (1 aktiv)' })).toBeVisible()
  await expect(page.locator('main')).toContainText('FC Nachbarort')
  await expect(page.locator('.event-card', { hasText: 'Training' })).toHaveCount(0)

  await page.reload()
  await ready(page)
  await expect(page.getByRole('button', { name: 'Filter (1 aktiv)' })).toBeVisible()
  await page.getByRole('button', { name: 'Filter (1 aktiv)' }).click()
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click()
  await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible()
})

test('dark mode switches the colors', async ({ page }) => {
  await page.goto('/login')
  await ready(page)
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const light = await background()
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(background).not.toBe(light)
})

test('sign in and out keeps the session per browser', async ({ page }) => {
  const demo = await seedDemo()
  await page.goto('/profile')
  await expect(page).toHaveURL((url) => url.pathname === '/login')
  await page.getByLabel('E-Mail').fill(demo.player.email)
  await page.getByLabel('Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  // (The login URL carries "?redirect=/profile", so compare the path.)
  await expect(page).toHaveURL((url) => url.pathname === '/profile')
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible()
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/login')
})
