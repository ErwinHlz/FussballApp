/**
 * Screenshot tour of the main screens on a phone (375 px) for visual review.
 * Output: e2e/__screens__/*.png (git-ignored). Run: npm run test:screens
 */
import { test, type Page } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

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

  await login(page, demo.player.email)
  await page.getByText('Als Nächstes').waitFor()
  await page.waitForTimeout(500)
  await shot(page, '10-player-home')

  await page.goto(`/events/${demo.training.id}`)
  await page.getByText('Trainingsplan').first().waitFor()
  await page.waitForTimeout(500)
  await shot(page, '11-player-training-detail')

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
})

test('screens: coach', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email)
  await page.getByText('Als Nächstes').waitFor()
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
