/**
 * Pitch schedule Monday to Sunday with home matches (UX-PLAN.md, phase X2): a home match on a
 * club pitch shows on exactly that pitch, away matches and home matches without a pitch do not;
 * a training over a home match is marked as a conflict.
 */
import { addDays, format } from 'date-fns'
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

/** The next given weekday (0 = Sunday) at least `min` days ahead, at the hour. */
function next(weekday: number, hour: number, min = 2) {
  let day = addDays(new Date(), min)
  while (day.getDay() !== weekday) day = addDays(day, 1)
  day.setHours(hour, 0, 0, 0)
  return day
}

test('a home match shows on its pitch on Saturday, other matches do not', async ({ page }) => {
  const demo = await seedDemo()
  const sb = demo.coach.sb
  const pitches = (
    await sb
      .from('pitches')
      .insert([
        { club_id: demo.club.id, name: 'Rasen', sort_order: 1 },
        { club_id: demo.club.id, name: 'Kunstrasen', sort_order: 2 },
      ])
      .select()
  ).data!
  const grass = pitches.find((p) => p.name === 'Rasen')!
  const saturday = next(6, 11)
  const match = (opponent: string, extra: Record<string, unknown>) =>
    sb.from('events').insert({
      team_id: demo.team.id,
      type: 'match',
      starts_at: saturday.toISOString(),
      opponent,
      ...extra,
    })
  await match('FC Platzgast', {
    is_home: true,
    pitch_id: grass.id,
    pitch_part: 'full',
    location: 'Rasen',
  })
  await match('SV Ohneplatz', { is_home: true })
  await match('TSV Auswärts', { is_home: false })

  await login(page, demo.coach.email, `/events/schedule?date=${format(saturday, 'yyyy-MM-dd')}`)
  await expect(page.getByRole('heading', { name: 'Belegungsplan' })).toBeVisible()
  // Monday to Sunday.
  await expect(page.getByRole('region', { name: /^(Montag|Sonntag),/ })).toHaveCount(2)

  await page.getByRole('radio', { name: 'Rasen', exact: true }).click()
  const onGrass = page.getByRole('link', { name: /Heimspiel U17 gegen/ })
  await expect(onGrass).toHaveCount(1)
  await expect(onGrass).toHaveAccessibleName(/Anstoß 11:00.*FC Platzgast/)
  // Weekends are shown but not bookable.
  await expect(page.getByRole('button', { name: /^Sa .*reservieren/ })).toHaveCount(0)

  await page.getByRole('radio', { name: 'Kunstrasen', exact: true }).click()
  await expect(page.getByRole('link', { name: /Heimspiel/ })).toHaveCount(0)

  // The match opens from the calendar.
  await page.getByRole('radio', { name: 'Rasen', exact: true }).click()
  await onGrass.click()
  await expect(page.getByRole('heading', { name: 'vs. FC Platzgast' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Rasen.*Belegungsplan/ })).toBeVisible()
})

test('a training over a home match is marked as a conflict', async ({ page }) => {
  const demo = await seedDemo()
  const sb = demo.coach.sb
  const turf = (
    await sb.from('pitches').insert({ club_id: demo.club.id, name: 'Kunstrasen' }).select().single()
  ).data!
  const thursday = next(4, 19)
  const day = format(thursday, 'yyyy-MM-dd')
  const booked = await sb.rpc('book_pitch', {
    p_pitch_id: turf.id,
    p_team_id: demo.team.id,
    p_part: 'full',
    p_start: '18:00',
    p_end: '19:30',
    p_from: day,
    p_until: day,
  })
  expect(booked.error).toBeNull()
  await sb.from('events').insert({
    team_id: demo.team.id,
    type: 'match',
    starts_at: thursday.toISOString(),
    opponent: 'SV Nachholheim',
    is_home: true,
    pitch_id: turf.id,
    pitch_part: 'a',
  })

  await login(page, demo.coach.email, `/events/schedule?date=${day}`)
  await expect(page.getByText(/Rot umrandete Trainings/)).toBeVisible()
  await page.getByRole('button', { name: /Überschneidet sich mit einem Heimspiel/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const training = (
    await sb
      .from('events')
      .select('id')
      .eq('booking_id', (booked.data as { booking_id: string }).booking_id)
      .single()
  ).data!
  await page.goto(`/events/${training.id}`)
  await expect(page.getByText('Überschneidung mit einem Heimspiel auf diesem Platz:')).toBeVisible()
  await expect(page.getByText(/gegen SV Nachholheim \(Anstoß 19:00\)/)).toBeVisible()
})

test('the match form saves the pitch of a home match', async ({ page }) => {
  const demo = await seedDemo()
  await demo.coach.sb.from('pitches').insert({ club_id: demo.club.id, name: 'Rasen' })

  await login(page, demo.coach.email, '/events/new/match')
  await page.getByLabel('Gegner').fill('FC Formular')
  await page.getByLabel('Datum').fill(format(next(6, 12), 'yyyy-MM-dd'))
  await page.getByRole('group', { name: 'Platz' }).getByText('Rasen', { exact: true }).click()
  await expect(page.getByLabel('Spielort')).toHaveCount(0)
  await page.getByRole('radio', { name: 'Hälfte B' }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByRole('heading', { name: 'vs. FC Formular' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Rasen · B/ })).toBeVisible()
  const saved = (
    await demo.coach.sb
      .from('events')
      .select('pitch_part, location')
      .eq('opponent', 'FC Formular')
      .single()
  ).data!
  expect(saved).toEqual({ pitch_part: 'b', location: 'Rasen · B' })
})
