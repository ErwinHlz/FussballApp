/**
 * Shared club schedule: the admin sets up pitch times, a coach books and releases them,
 * and the bookings show up as trainings of the team.
 */
import { addDays, format } from 'date-fns'
import { de } from 'date-fns/locale/de'
import { expect, test, type Page } from '@playwright/test'
import { login } from './support/app'
import { expectAccessible } from './support/fixtures'
import { register, seedDemo } from './support/seed'

const tomorrow = addDays(new Date(), 1)

/** Opens the week calendar on the week of tomorrow (old club links still lead there). */
async function openTomorrow(page: Page, clubId: string) {
  await page.goto(`/clubs/${clubId}/schedule`)
  await expect(page).toHaveURL(/\/events\/schedule$/)
  // Tomorrow is in next week when today is Sunday.
  if (new Date().getDay() === 0) await page.getByRole('button', { name: 'Nächste Woche' }).click()
}

/** Tomorrow's 17:00 slot on the Kunstrasen (one block with halves A and B). */
const slotBlock = (page: Page) =>
  page.getByRole('button', {
    name: new RegExp(
      `^${format(tomorrow, 'EEEEEE d.M.', { locale: de })}, 17:00–18:30, Kunstrasen: `,
    ),
  })

test('admin sets up a pitch, a coach books and releases half of it', async ({ browser }) => {
  const demo = await seedDemo()

  // Second team with its own coach (not a club admin).
  const u19 = (
    await demo.coach.sb
      .from('teams')
      .insert({ club_id: demo.club.id, name: 'U19' })
      .select()
      .single()
  ).data!
  const invite = (
    await demo.coach.sb
      .from('team_invites')
      .insert({ team_id: u19.id, role: 'coach' })
      .select()
      .single()
  ).data!
  const carl = await register('Carl', demo.stamp)
  await carl.sb.rpc('accept_team_invite', { p_token: invite.token })

  // Admin: pitch and a weekly time on tomorrow's weekday.
  const admin = await (await browser.newContext()).newPage()
  await login(admin, demo.coach.email, `/clubs/${demo.club.id}/schedule/setup`)
  await admin.getByLabel('Name').fill('Kunstrasen')
  await admin.getByRole('button', { name: 'Platz hinzufügen' }).click()
  await expect(admin.getByRole('heading', { name: 'Kunstrasen' })).toBeVisible()
  await admin.getByRole('button', { name: 'Platzzeit hinzufügen' }).click()
  await admin
    .getByRole('button', { name: format(tomorrow, 'EEEEEE', { locale: de }), exact: true })
    .click()
  await admin.locator('.slot-form').getByRole('button', { name: 'Platzzeit hinzufügen' }).click()
  await expect(admin.getByText('17:00–18:30')).toBeVisible()
  await admin.screenshot({ path: 'e2e/__screens__/41-schedule-setup.png', fullPage: true })

  // Coach: books half A every week.
  const page = await (await browser.newContext()).newPage()
  await login(page, carl.email)
  await openTomorrow(page, demo.club.id)
  await expect(page.getByRole('link', { name: 'Plätze & Zeiten' })).toHaveCount(0)
  // Both halves free: a tap books half A (the sheet offers the other parts, too).
  await expect(slotBlock(page)).toHaveAccessibleName(/A frei, B frei$/)
  await slotBlock(page).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: /^Jede Woche bis/ }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/__screens__/42-schedule-book.png' })
  await sheet.getByRole('button', { name: 'Reservieren' }).click()
  await expect(page.getByRole('status')).toContainText('Trainings sind angelegt')
  await expect(slotBlock(page)).toHaveAccessibleName(/A U19, B frei$/)
  await expect(slotBlock(page).locator('.schedule__cell--own')).toContainText('U19')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screens__/40-schedule.png', fullPage: true })
  // The week calendar with free, own and taken parts passes the WCAG check.
  await expectAccessible(page)

  // The trainings are in the team's calendar.
  await page.goto('/training')
  await expect(page.getByText('Kunstrasen · A').first()).toBeVisible()

  // The admin sees the booking live in the plan with the team name.
  await openTomorrow(admin, demo.club.id)
  await expect(slotBlock(admin)).toHaveAccessibleName(/A U19, B frei$/)

  // Coach gives back tomorrow only.
  await openTomorrow(page, demo.club.id)
  // The own booking comes first: a tap opens it to give it back.
  await slotBlock(page).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Nur .* abgeben$/ })
    .click()
  await expect(page.getByRole('status')).toContainText('Abgegeben')
  await expect(slotBlock(page)).toHaveAccessibleName(/A frei, B frei$/)

  // Next week the booking still holds.
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await expect(page.locator('.schedule__cell--own').first()).toContainText('U19')
})
