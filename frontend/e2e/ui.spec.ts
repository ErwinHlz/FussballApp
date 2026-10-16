/**
 * UI elements in every browser (Chromium, Firefox, Opera) on a 375 px phone viewport:
 * forms, navigation, answer buttons, dialogs, the create menu, filters and dark mode.
 * Run: npm run test:browsers (Supabase must be running).
 */
import { login } from './support/app'
import { expect, expectNoHorizontalScroll, ready, test, trackErrors } from './support/fixtures'
import { PASSWORD, register, seedDemo } from './support/seed'

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
  await page.getByLabel('Passwort', { exact: true }).fill('wrong-password')
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
    ['Start', /\/$/, 'Start'],
    ['Termine', /\/events$/, 'Termine'],
    ['Training', /\/training$/, 'Training'],
    ['Team', /\/squad$/, 'Kader'],
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

  // Profile and club administration sit behind the header.
  await page.getByRole('link', { name: 'Profil' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible()
  await page.getByRole('button', { name: /Mannschaft wechseln/ }).click()
  const switcher = page.getByRole('dialog', { name: 'Mannschaft wechseln' })
  await expect(switcher.getByRole('button', { name: /U17/ })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await switcher.getByRole('button', { name: 'Verein verwalten: SV Demo 09' }).click()
  await expect(page).toHaveURL(/\/clubs\//)
  await expect(page.getByRole('heading', { level: 1, name: 'SV Demo 09' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Team' })).toHaveAttribute('aria-current', 'page')
  expect(errors).toEqual([])
})

test('the team switcher sheet closes with Escape and swipe', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  await ready(page)
  const opener = page.getByRole('button', { name: /Mannschaft wechseln/ })
  const sheet = page.getByRole('dialog', { name: 'Mannschaft wechseln' })

  await opener.click()
  await expect(sheet).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(opener).toBeFocused()

  // Drag the handle area down: the sheet follows and closes.
  await opener.click()
  // Wait until the sheet finished sliding in, otherwise the handle is still off screen.
  await expect(sheet).toBeVisible()
  await page.waitForTimeout(400)
  const head = sheet.locator('.sheet__head')
  const box = (await head.boundingBox())!
  await page.mouse.move(box.x + 40, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + 200, { steps: 8 })
  await page.mouse.up()
  await expect(sheet).toBeHidden()
})

test('the back button returns to the list, also on a deep link', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  await page.locator('.event-row', { hasText: 'FC Nachbarort' }).getByRole('link').first().click()
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
  // The answer bar is fixed at the bottom of the event page.
  const answers = page.getByRole('group', { name: 'Bist du dabei?' })
  const yes = answers.getByRole('button', { name: /dabei/ })
  const maybe = answers.getByRole('button', { name: 'Vielleicht' })
  const no = answers.getByRole('button', { name: 'Absage' })
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0)

  await yes.click()
  await expect(yes).toHaveAttribute('aria-pressed', 'true')
  await expect(no).toHaveAttribute('aria-pressed', 'false')
  await maybe.click()
  await expect(maybe).toHaveAttribute('aria-pressed', 'true')
  await expect(yes).toHaveAttribute('aria-pressed', 'false')

  // Decline asks for a reason; closing the sheet keeps the old answer.
  await no.click()
  const dialog = page.getByRole('dialog', { name: 'Absagen' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(maybe).toHaveAttribute('aria-pressed', 'true')
  await no.click()
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  await expect(dialog).toBeHidden()

  // Note, then one tap on the reason: saved, with "undo" in the snackbar.
  await no.click()
  await dialog.getByLabel('Bemerkung (optional)').fill('Spätschicht')
  await dialog.getByRole('button', { name: 'Arbeit' }).click()
  await expect(dialog).toBeHidden()
  await expect(no).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(maybe).toHaveAttribute('aria-pressed', 'true')
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

  // A match asks for the opponent; "Alles anpassen" opens the full form with the choices.
  await page.getByRole('button', { name: 'Termin anlegen' }).click()
  await menu.getByRole('button', { name: /^Spiel\s/ }).click()
  const match = page.getByRole('dialog', { name: 'Neues Spiel' })
  await match.getByLabel('Gegner').fill('TSV Testhausen')
  await match.getByRole('button', { name: 'Alles anpassen' }).click()
  await expect(match).toBeHidden()
  await expect(page).toHaveURL(/\/events\/new\/match\?/)
  await expect(page.getByRole('heading', { level: 1, name: 'Neues Spiel' })).toBeVisible()
  await expect(page.getByLabel('Gegner')).toHaveValue('TSV Testhausen')
  await expectNoHorizontalScroll(page)
})

test('a coach creates a training with taken-over defaults in at most four taps', async ({
  page,
}) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email)
  await ready(page)

  await page.getByRole('button', { name: 'Termin anlegen' }).click() // 1
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: /^Training\s/ }).click() // 2
  await expect(sheet).toHaveAccessibleName('Neues Training')
  // Place, time, length and deadline come from the last training (seed: 18:30, Platz 2).
  await expect(sheet.getByLabel('Beginn')).toHaveValue('18:30')
  await expect(sheet).toContainText('Sportpark, Platz 2')
  await expect(sheet.locator('.quick__day[aria-pressed="true"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click() // 3

  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Training angelegt')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Training' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sportpark, Platz 2/ })).toBeVisible()
})

test('the filter sheet narrows the list and is remembered', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email)
  await ready(page)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Filter' })
  const match = sheet.getByRole('button', { name: 'Spiel', exact: true })
  await match.click()
  await expect(match).toHaveAttribute('aria-pressed', 'true')
  await sheet.getByRole('button', { name: /^Zeigen \(1\)/ }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: 'Filter (1 aktiv)' })).toBeVisible()
  await expect(page.locator('main')).toContainText('FC Nachbarort')
  await expect(page.locator('.event-row--training')).toHaveCount(0)

  await page.reload()
  await ready(page)
  await expect(page.getByRole('button', { name: 'Filter (1 aktiv)' })).toBeVisible()
  await page.getByRole('button', { name: 'Filter (1 aktiv)' }).click()
  await sheet.getByRole('button', { name: 'Filter zurücksetzen' }).click()
  await page.keyboard.press('Escape')
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
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  // (The login URL carries "?redirect=/profile", so compare the path.)
  await expect(page).toHaveURL((url) => url.pathname === '/profile')
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible()
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/login')
})

test('appearance and language are chosen in the profile and remembered', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email, '/profile')
  await ready(page)

  const theme = page.getByRole('radiogroup', { name: 'Hell oder dunkel' })
  await theme.getByRole('radio', { name: 'Dunkel' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page
    .getByRole('radiogroup', { name: 'Sprache' })
    .getByRole('radio', { name: 'English' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible()

  // Both stick on this device.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page
    .getByRole('radiogroup', { name: 'Language' })
    .getByRole('radio', { name: 'Automatic' })
    .click()
  // "Automatic" follows the browser again (German in these tests).
  await page
    .getByRole('radiogroup', { name: 'Hell oder dunkel' })
    .getByRole('radio', { name: 'Automatisch' })
    .click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('a new user without a team pastes an invite link and joins', async ({ page }) => {
  const demo = await seedDemo()
  const { data: invite } = await demo.coach.sb
    .from('team_invites')
    .insert({ team_id: demo.team.id, role: 'player' })
    .select()
    .single()
  const newbie = await register('Neu', `${Date.now()}x`)

  await login(page, newbie.email, '/teams')
  await expect(page.getByText('Wie möchtest du starten?')).toBeVisible()
  await expectNoHorizontalScroll(page)
  // Nonsense is rejected at the field, a pasted link opens the invite.
  await page.getByLabel('Einladungslink').fill('hallo')
  await page.getByRole('button', { name: 'Einladung öffnen' }).click()
  await expect(page.getByText('Das sieht nicht nach einem Einladungslink aus.')).toBeVisible()
  await page.getByLabel('Einladungslink').fill(`https://rondo.example/join/${invite!.token}`)
  await page.getByRole('button', { name: 'Einladung öffnen' }).click()

  await expect(page).toHaveURL(new RegExp(`/join/${invite!.token}$`))
  await expect(page.getByText('SV Demo 09')).toBeVisible()
  await expect(page.getByText('U17', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Beitreten' }).click()
  await expect(page).toHaveURL(/\/squad$/)
  await expect(page.getByText('Neu').first()).toBeVisible()
})

test('undo after a first decline goes back to "no answer yet"', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email, `/events/${demo.match.id}`)
  await ready(page)
  const no = page
    .getByRole('group', { name: 'Bist du dabei?' })
    .getByRole('button', { name: 'Absage' })

  await no.click()
  await page.getByRole('dialog', { name: 'Absagen' }).getByRole('button', { name: 'Krank' }).click()
  await expect(no).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(no).toHaveAttribute('aria-pressed', 'false')

  // Stored that way: after a reload the match still has no answer of Pia.
  await page.reload()
  await ready(page)
  await expect(
    page.getByRole('group', { name: 'Bist du dabei?' }).getByRole('button', { name: 'Absage' }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: /Ich bin dabei/ })).toBeVisible()
})
