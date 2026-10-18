/**
 * Shared club schedule: the admin adds a pitch, a coach books a time range in half hours
 * (Monday to Friday, 15:00–20:30) and releases it again; bookings become the team's trainings.
 */
import { addDays, format, startOfWeek } from 'date-fns'
import { de } from 'date-fns/locale/de'
import { expect, test, type Page } from '@playwright/test'
import { login } from './support/app'
import { expectAccessible } from './support/fixtures'
import { register, seedDemo } from './support/seed'

/** The next weekday (Monday to Friday) from tomorrow on: it can be booked from 17:00. */
const target = (() => {
  let day = addDays(new Date(), 1)
  while (day.getDay() === 0 || day.getDay() === 6) day = addDays(day, 1)
  return day
})()
const dayLabel = format(target, 'EEEEEE d.M.', { locale: de })

/** Opens the calendar on the week of the target day (old club links still lead there). */
async function openTargetWeek(page: Page, clubId: string) {
  await page.goto(`/clubs/${clubId}/schedule`)
  await expect(page).toHaveURL(/\/events\/schedule$/)
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
  if (startOfWeek(target, { weekStartsOn: 1 }).getTime() !== thisWeek)
    await page.getByRole('button', { name: 'Nächste Woche' }).click()
}

const freeHalf = (page: Page, time: string, half: 'A' | 'B') =>
  page.getByRole('button', { name: `${dayLabel}, ${time}, Hälfte ${half} frei – reservieren` })
const booking = (page: Page, text: string) =>
  page.getByRole('button', { name: `${dayLabel}, ${text}` })

test('admin adds a pitch, a coach books half an evening and releases it', async ({ browser }) => {
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

  // Admin: only the pitch, no fixed times any more.
  const admin = await (await browser.newContext()).newPage()
  await login(admin, demo.coach.email, `/clubs/${demo.club.id}/schedule/setup`)
  await expect(admin.getByText('zwischen 15:00 und 20:30 Uhr')).toBeVisible()
  await admin.getByLabel('Name').fill('Kunstrasen')
  await admin.getByRole('button', { name: 'Platz hinzufügen' }).click()
  await expect(admin.getByRole('heading', { name: 'Kunstrasen' })).toBeVisible()
  await expect(admin.getByRole('button', { name: 'Platzzeit hinzufügen' })).toHaveCount(0)
  await admin.screenshot({ path: 'e2e/__screens__/41-schedule-setup.png', fullPage: true })

  // Coach: tap the free half hour 17:00 on half A, keep 90 minutes, every week.
  const page = await (await browser.newContext()).newPage()
  await login(page, carl.email)
  await openTargetWeek(page, demo.club.id)
  await expect(page.getByRole('link', { name: 'Plätze & Zeiten' })).toHaveCount(0)
  await freeHalf(page, '17:00', 'A').click()
  const sheet = page.getByRole('dialog', { name: 'Platz reservieren' })
  await expect(sheet.getByRole('button', { name: '90 Min.' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Nothing after 20:30: from 17:00 at most three and a half hours.
  await expect(sheet.getByRole('button', { name: '210 Min.' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: '240 Min.' })).toHaveCount(0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/__screens__/42-schedule-book.png' })
  await sheet.getByRole('button', { name: 'Bis 18:30 reservieren' }).click()
  await expect(page.getByRole('status')).toContainText('Trainings sind angelegt')
  const own = booking(page, '17:00–18:30, Hälfte A: U19')
  await expect(own).toHaveClass(/schedule__block--own/)
  // Right after the booking and on the other half, it is still free.
  await expect(freeHalf(page, '18:30', 'A')).toBeVisible()
  await expect(freeHalf(page, '17:00', 'B')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screens__/40-schedule.png', fullPage: true })
  // The calendar with free, own and taken times passes the WCAG check.
  await expectAccessible(page)

  // The trainings are in the team's calendar.
  await page.goto('/training')
  await expect(page.getByText('Kunstrasen · A').first()).toBeVisible()

  // The admin sees the booking with the team name.
  await openTargetWeek(admin, demo.club.id)
  await expect(booking(admin, '17:00–18:30, Hälfte A: U19')).toBeVisible()

  // Coach gives back that date only.
  await openTargetWeek(page, demo.club.id)
  await booking(page, '17:00–18:30, Hälfte A: U19').click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Nur .* abgeben$/ })
    .click()
  await expect(page.getByRole('status')).toContainText('Abgegeben')
  await expect(freeHalf(page, '17:00', 'A')).toBeVisible()

  // The weeks after stay booked.
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await expect(page.locator('.schedule__block--own').first()).toContainText('U19')
})

test('the database only takes Monday to Friday, 15:00–20:30, in half hours', async () => {
  const demo = await seedDemo()
  const pitch = (
    await demo.coach.sb
      .from('pitches')
      .insert({ club_id: demo.club.id, name: 'Rasen' })
      .select()
      .single()
  ).data!
  const book = (start: string, end: string) =>
    demo.coach.sb.rpc('book_pitch', {
      p_pitch_id: pitch.id,
      p_team_id: demo.team.id,
      p_part: 'full',
      p_start: start,
      p_end: end,
      p_from: format(target, 'yyyy-MM-dd'),
      p_until: format(target, 'yyyy-MM-dd'),
    })
  expect((await book('14:30', '16:00')).error?.hint).toBe('not_bookable')
  expect((await book('19:30', '21:00')).error?.hint).toBe('not_bookable')
  expect((await book('17:15', '18:00')).error?.hint).toBe('not_bookable')
  expect((await book('19:00', '20:30')).error).toBeNull()
})

test('a new training on a pitch lands in the schedule; a time outside is explained', async ({
  page,
}) => {
  const demo = await seedDemo()
  await demo.coach.sb.from('pitches').insert({ club_id: demo.club.id, name: 'Kunstrasen' })
  await login(page, demo.coach.email, '/events/new?kind=training')
  await page.getByRole('button', { name: 'Kunstrasen', exact: true }).click()
  await page.getByRole('radio', { name: 'Hälfte B' }).click()
  // No free text place for a pitch.
  await expect(page.getByLabel('Ort', { exact: true })).toHaveCount(0)
  await page.getByLabel('Anderes Datum').fill(format(target, 'yyyy-MM-dd'))
  await page.getByLabel('Beginn').fill('21:00')
  await expect(page.getByRole('alert')).toContainText('zwischen 15:00 und 20:30')
  await page.getByLabel('Beginn').fill('17:30')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click()

  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('link', { name: /Kunstrasen · B/ })).toBeVisible()
  await expect(page.getByText('Im Belegungsplan eintragen')).toHaveCount(0)
  await openTargetWeek(page, demo.club.id)
  await expect(booking(page, '17:30–19:00, Hälfte B: U17')).toBeVisible()
})

test('an existing training is entered in the schedule afterwards', async ({ page }) => {
  const demo = await seedDemo()
  await demo.coach.sb.from('pitches').insert({ club_id: demo.club.id, name: 'Kunstrasen' })
  const start = new Date(target)
  start.setHours(16, 0, 0, 0)
  const training = (
    await demo.coach.sb
      .from('events')
      .insert({
        team_id: demo.team.id,
        type: 'training',
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 60 * 60_000).toISOString(),
        location: 'Kunstrasen · A',
      })
      .select()
      .single()
  ).data!

  await login(page, demo.coach.email, `/events/${training.id}`)
  await page.getByRole('button', { name: 'Im Belegungsplan eintragen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Im Belegungsplan eintragen' })
  // The place already names the pitch and half: both are preselected.
  await expect(sheet.getByRole('button', { name: 'Kunstrasen', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(sheet.getByRole('radio', { name: 'Hälfte A' })).toBeChecked()
  await sheet.getByRole('button', { name: 'Eintragen' }).click()
  await expect(page.getByText('Im Belegungsplan eingetragen.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Im Belegungsplan eintragen' })).toHaveCount(0)

  await openTargetWeek(page, demo.club.id)
  await expect(booking(page, '16:00–17:00, Hälfte A: U17')).toBeVisible()
})

test('a training series on a pitch books every week of both weekdays', async ({ page }) => {
  const demo = await seedDemo()
  await demo.coach.sb.from('pitches').insert({ club_id: demo.club.id, name: 'Kunstrasen' })
  const from = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 })
  await login(page, demo.coach.email, '/events/new/series')
  const weekdays = page.getByRole('group', { name: 'Wochentage' })
  await weekdays.getByRole('button', { name: 'Di', exact: true }).click()
  await weekdays.getByRole('button', { name: 'Do', exact: true }).click()
  await page.getByLabel('Von').fill(format(from, 'yyyy-MM-dd'))
  await page.getByLabel('Bis').fill(format(addDays(from, 20), 'yyyy-MM-dd'))
  await page.getByLabel('Beginn').fill('18:00')
  await page.getByLabel('Dauer (Minuten)').fill('90')
  await page.getByRole('button', { name: 'Kunstrasen', exact: true }).click()
  await page.getByRole('button', { name: /6 Trainings anlegen/ }).click()
  await expect(page).toHaveURL(/\/events$/)

  // Next week: Tuesday and Thursday booked on the whole pitch.
  await page.goto('/events/schedule')
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  const tue = format(addDays(from, 1), 'EEEEEE d.M.', { locale: de })
  const thu = format(addDays(from, 3), 'EEEEEE d.M.', { locale: de })
  await expect(
    page.getByRole('button', { name: `${tue}, 18:00–19:30, Ganzer Platz: U17` }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: `${thu}, 18:00–19:30, Ganzer Platz: U17` }),
  ).toBeVisible()
})
