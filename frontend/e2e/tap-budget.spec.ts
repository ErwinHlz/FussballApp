/**
 * Tap budgets for the core tasks of the usability test (docs/ui/usability-test.md, UX-PLAN.md
 * X7): every task is done by counting taps from where the person starts. Typing into fields
 * is not a tap. S6 (absence in three taps) is in navigation.spec.ts.
 */
import { expect, test, type Locator } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

/** Counts taps; `tap` clicks and counts one. */
function taps() {
  let count = 0
  return {
    tap: async (target: Locator) => {
      count++
      await target.click()
    },
    get count() {
      return count
    },
  }
}

test('S1: a player says yes from the start page with one tap', async ({ page }) => {
  const demo = await seedDemo()
  // An unanswered training before all others is the next event.
  const soon = new Date(Date.now() + 3 * 3600_000)
  await demo.coach.sb
    .from('events')
    .insert({ team_id: demo.team.id, type: 'training', starts_at: soon.toISOString() })
  await login(page, demo.player.email, '/')

  const t = taps()
  await t.tap(page.locator('.next').getByRole('button', { name: 'Ich bin dabei' }))
  await expect(
    page.locator('.next').getByRole('button', { name: 'Du bist dabei' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(t.count).toBeLessThanOrEqual(1)
})

test('S2: the own bib for tomorrow is visible without scrolling', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email, '/')
  const bib = page.locator('.next .bib-chip', { hasText: 'Rondo 4 gegen 2' })
  await expect(bib).toContainText('Rot')
  await expect(bib).toBeInViewport()
})

test('S3 + S4: decline with a reason in two taps, then undo', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email, `/events/${demo.match.id}`)

  const t = taps()
  await t.tap(page.getByRole('button', { name: 'Absage', exact: true }))
  await t.tap(page.getByRole('dialog', { name: 'Absagen' }).getByRole('button', { name: 'Arbeit' }))
  expect(t.count).toBeLessThanOrEqual(2)
  await expect(
    page
      .getByText('Du hast abgesagt')
      .or(page.getByText('Abgesagt', { exact: true }))
      .first(),
  ).toBeVisible()

  await t.tap(page.getByRole('button', { name: 'Rückgängig' }))
  await expect(page.getByRole('button', { name: 'Absage', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('S5: the animation of the second drill plays within three taps', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.player.email, '/')

  const t = taps()
  await t.tap(page.getByRole('link', { name: /Ablauf und Details/ }))
  await t.tap(page.getByRole('link', { name: /Rondo 4 gegen 2/ }).first())
  await t.tap(page.getByRole('button', { name: 'Abspielen' }))
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  expect(t.count).toBeLessThanOrEqual(3)
})

test('T1: a coach creates a training for next Tuesday in at most four taps', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, '/events')

  const t = taps()
  await t.tap(page.getByRole('link', { name: 'Termin anlegen' }))
  // The choice "Training" (not the series, not the "Training" tab of the tab bar).
  await t.tap(page.getByRole('button', { name: /^Training Einzelnes/ }))
  await t.tap(page.getByRole('button', { name: /^Dienstag/ }))
  await t.tap(page.getByRole('button', { name: 'Anlegen' }))
  await expect(page.getByRole('heading', { name: 'Training', level: 1 })).toBeVisible()
  expect(t.count).toBeLessThanOrEqual(4)
})

test('T2: who is missing for the match shows on the coach start page', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, '/')
  const task = page
    .getByRole('region', { name: /Zu erledigen/ })
    .getByRole('link', { name: /Antworten fehlen.*FC Nachbarort/ })
  await expect(task).toBeInViewport()
})

test('T3: the coach answers for a player within three taps from the start page', async ({
  page,
}) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, '/')

  const t = taps()
  await t.tap(page.getByRole('link', { name: /Antworten fehlen.*FC Nachbarort/ }))
  await t.tap(page.getByRole('button', { name: /^Pia/ }))
  await t.tap(page.getByRole('dialog').getByRole('button', { name: 'Ich bin dabei' }))
  await expect(page.locator('.overview__group', { hasText: 'Zusagen' })).toContainText('Pia')
  expect(t.count).toBeLessThanOrEqual(3)
})

test('T4: publishing the plan needs no searching', async ({ page }) => {
  const demo = await seedDemo()
  const draft = (
    await demo.coach.sb
      .from('events')
      .select('id')
      .eq('team_id', demo.team.id)
      .eq('plan_status', 'draft')
      .eq('type', 'training')
      .order('starts_at')
      .limit(1)
      .single()
  ).data!
  await login(page, demo.coach.email, `/events/${draft.id}/plan`)
  await expect(page.getByRole('button', { name: 'Plan veröffentlichen' })).toBeInViewport()
})

test('T6: cancelling a training with a reason takes three taps', async ({ page }) => {
  const demo = await seedDemo()
  await login(page, demo.coach.email, `/events/${demo.training.id}`)

  const t = taps()
  await t.tap(page.getByRole('button', { name: 'Trainer-Aktionen' }))
  await t.tap(
    page
      .getByRole('dialog', { name: 'Trainer-Aktionen' })
      .getByRole('button', { name: 'Termin absagen' }),
  )
  const sheet = page.getByRole('dialog', { name: 'Termin absagen' })
  await sheet.getByLabel('Grund (optional)').fill('Platz gesperrt')
  await t.tap(sheet.getByRole('button', { name: 'Termin absagen' }))
  await expect(page.getByText('Platz gesperrt')).toBeVisible()
  expect(t.count).toBeLessThanOrEqual(3)
})
