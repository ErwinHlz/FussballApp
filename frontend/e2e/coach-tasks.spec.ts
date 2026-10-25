/**
 * The coach's start page (UX-PLAN.md, phase X4): open tasks lead to their place with one tap;
 * the coach's own answer is a side matter (no reminders, no "attend all").
 */
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

test('the coach reaches every open task from the start page with one tap', async ({ page }) => {
  const demo = await seedDemo()
  const sb = demo.coach.sb
  // A training the day after tomorrow without a published plan …
  const start = new Date()
  start.setDate(start.getDate() + 2)
  start.setHours(18, 0, 0, 0)
  const draft = (
    await sb
      .from('events')
      .insert({ team_id: demo.team.id, type: 'training', starts_at: start.toISOString() })
      .select()
      .single()
  ).data!
  // … and Ben says yes to tomorrow's training, but is in no group yet.
  await sb.rpc('set_attendance', {
    p_event_id: demo.training.id,
    p_member_id: demo.memberId('Ben'),
    p_status: 'yes',
  })

  await login(page, demo.coach.email, '/')
  const tasks = page.getByRole('region', { name: /Zu erledigen/ })
  await expect(tasks).toBeVisible()
  await expect(tasks.getByRole('link', { name: /1 Zusage ohne Gruppe/ })).toBeVisible()
  await expect(tasks.getByRole('link', { name: /Antworten fehlen/ }).first()).toBeVisible()
  await expect(page.getByText('Wartet auf deine Antwort')).toHaveCount(0)

  await tasks.getByRole('link', { name: /Plan veröffentlichen/ }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${draft.id}/plan$`))

  await page.goto('/')
  await tasks.getByRole('link', { name: /Kader nominieren/ }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${demo.match.id}/squad$`))
  await expect(page.getByRole('heading', { name: 'Spieltagskader', level: 1 })).toBeVisible()

  await page.goto('/')
  await tasks.getByRole('link', { name: /Zusage ohne Gruppe/ }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${demo.training.id}/groups$`))
})

test('coaches answer on the side; players keep reminder and "attend all"', async ({ browser }) => {
  const demo = await seedDemo()

  const coach = await (await browser.newContext()).newPage()
  await login(coach, demo.coach.email, '/events')
  await expect(coach.getByRole('button', { name: 'Alle zusagen' })).toHaveCount(0)
  await expect(coach.getByText(/noch nicht beantwortet/)).toHaveCount(0)
  await coach.goto(`/events/${demo.match.id}`)
  // The own answer is the slim line with three small buttons.
  await expect(coach.getByText('Deine Antwort')).toBeVisible()
  await expect(coach.getByRole('button', { name: 'Ich bin dabei' })).toHaveCount(0)
  await coach.getByRole('button', { name: 'Zusage', exact: true }).click()
  await expect(coach.getByRole('button', { name: 'Zusage', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  const player = await (await browser.newContext()).newPage()
  await login(player, demo.player.email, '/events')
  await expect(player.getByRole('button', { name: 'Alle zusagen' })).toBeVisible()
})
