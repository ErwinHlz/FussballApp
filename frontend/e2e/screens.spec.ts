/**
 * Screenshot tour of the main screens on a phone (375 px) for visual review.
 * Output: e2e/__screens__/*.png (git-ignored). Run: npm run test:screens
 */
import { test, type Page } from '@playwright/test'
import { login } from './support/app'
import { seedDemo, seedHistory } from './support/seed'

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `e2e/__screens__/${name}.png`, fullPage: true })

test('screens: player', async ({ page }) => {
  const demo = await seedDemo()
  await page.goto('/login')
  await page.getByRole('heading', { name: 'Anmelden' }).waitFor()
  await shot(page, '01-login')
  await page.goto('/register')
  await page.getByRole('heading', { name: 'Konto erstellen' }).waitFor()
  await shot(page, '02-register')

  await login(page, demo.player.email, '/')
  await page.getByRole('button', { name: /dabei/ }).first().waitFor()
  await page.waitForTimeout(500)
  await shot(page, '10-player-home')
  await page.goto('/events')
  await page.getByText('Diese Woche').first().waitFor()
  await page.waitForTimeout(300)
  await shot(page, '10b-player-events')

  await page.goto(`/events/${demo.training.id}`)
  await page.getByText('Trainingsplan').first().waitFor()
  await page.waitForTimeout(500)
  await shot(page, '11-player-training-detail')
  await page.screenshot({ path: 'e2e/__screens__/11b-player-training-viewport.png' })
  await page.getByRole('button', { name: 'Absage', exact: true }).click()
  await page.getByRole('dialog', { name: 'Absagen' }).waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screens__/11c-decline-sheet.png' })
  await page.keyboard.press('Escape')

  await page.goto(`/events/${demo.match.id}`)
  await page.getByText('FC Nachbarort').first().waitFor()
  await shot(page, '12-player-match-detail')

  await page.goto('/drills/0d000000-0000-4000-8000-000000000001')
  await page.getByRole('button', { name: 'Abspielen' }).waitFor()
  await shot(page, '13-drill-with-animation')

  await page.goto('/squad')
  await page.getByText('Lena').first().waitFor()
  await shot(page, '14-player-squad')

  await page.goto('/profile')
  await page.getByText('Meine Vereine').waitFor()
  await shot(page, '15-profile')
  await page.getByRole('button', { name: 'Konto löschen' }).click()
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screens__/16-delete-account.png' })
  await page.goto('/privacy')
  await shot(page, '17-privacy')
})

test('screens: coach', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, '/')
  await page.getByRole('button', { name: /dabei/ }).first().waitFor()
  await page.waitForTimeout(500)
  await shot(page, '20-coach-home')

  await page.goto(`/events/${demo.training.id}`)
  await page.getByText('Wer kommt?').waitFor()
  await shot(page, '21-coach-training-detail')

  await page.goto(`/events/${demo.training.id}/plan`)
  await page.getByText('Rondo 4 gegen 2').first().waitFor()
  await shot(page, '22-plan-editor')

  await page.goto(`/events/${demo.training.id}/groups`)
  await page.getByText('Noch nicht eingeteilt').waitFor()
  await shot(page, '23-groups')

  await page.goto(`/events/${demo.match.id}`)
  await page.getByText('Spieltagskader').waitFor()
  await shot(page, '24-coach-match-detail')

  await page.goto('/events/new/series')
  await shot(page, '25-new-series')

  await page.goto('/training')
  await page.getByText('Nächste Trainings').waitFor()
  await shot(page, '26-training-tab')

  await page.goto('/drills')
  await page.getByText('Rondo 4 gegen 2').first().waitFor()
  await shot(page, '27-drills')

  await page.goto('/squad')
  await page.getByText('Lena').first().waitFor()
  await shot(page, '28-coach-squad')

  await page.goto(`/clubs/${demo.club.id}`)
  await page.getByText('Mitglieder und Admins').waitFor()
  await shot(page, '29-club')

  await page.goto('/teams')
  await page.getByText('SV Demo 09').first().waitFor()
  await shot(page, '30-teams')
})

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('screens: dark', async ({ page }) => {
    const demo = await seedDemo()
    await login(page, demo.player.email, '/')
    await page.getByRole('button', { name: /dabei/ }).first().waitFor()
    await page.waitForTimeout(500)
    await shot(page, '40-dark-home')

    await page.goto(`/events/${demo.match.id}`)
    await page.getByText('FC Nachbarort').first().waitFor()
    await shot(page, '41-dark-match')

    await page.goto('/drills/0d000000-0000-4000-8000-000000000001')
    await page.getByRole('button', { name: 'Abspielen' }).waitFor()
    await shot(page, '42-dark-drill')
  })
})

test('screens: statistics', async ({ page }) => {
  const demo = await seedDemo()
  await seedHistory(demo)
  await login(page, demo.coach.email, '/stats')
  await page.getByText('Beteiligung pro Training').waitFor()
  await shot(page, '50-stats-coach')

  await page.getByRole('button', { name: 'Als Tabelle' }).click()
  await shot(page, '51-stats-table')

  await page.getByRole('link', { name: 'Profil' }).click()
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await login(page, demo.player.email, '/stats')
  await page.getByText('Deine Werte').waitFor()
  await page.getByText('(du)').waitFor()
  await shot(page, '52-stats-player')
})

test('screens: design system', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/dev/ui')
    await page.getByRole('heading', { name: 'Design-System' }).waitFor()
    await page.waitForTimeout(400)
    await shot(page, `90-design-system-${scheme}`)
  }
  await page.getByRole('button', { name: 'Sheet öffnen' }).click()
  await page.getByRole('dialog', { name: 'Absagen' }).waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screens__/91-design-system-sheet.png' })
})
