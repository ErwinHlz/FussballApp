/**
 * Training templates: build one, share it in the club, another coach puts it on a training;
 * a finished plan is saved as a template.
 */
import { expect, test } from '@playwright/test'
import { login } from './support/app'
import { register, seedDemo } from './support/seed'

test('coaches build, share and apply training templates', async ({ browser }) => {
  const demo = await seedDemo()

  // U17 has its own drill; U19 has a coach and an upcoming training.
  await demo.coach.sb.from('drills').insert({
    team_id: demo.team.id,
    title: 'Gegenpressing-Spiel',
    category: 'tactics',
    duration_min: 20,
  })
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
  const start = new Date(Date.now() + 3 * 86_400_000)
  await carl.sb.from('events').insert({
    team_id: u19.id,
    type: 'training',
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 90 * 60_000).toISOString(),
  })

  // Tina builds and shares a template.
  const tina = await (await browser.newContext()).newPage()
  await login(tina, demo.coach.email, '/training')
  await tina.getByRole('button', { name: 'Vorlagen öffnen' }).click()
  await tina.getByLabel('Name').fill('Passen & Pressing')
  await tina.getByRole('button', { name: 'Vorlage anlegen' }).click()
  await expect(tina.getByRole('heading', { level: 1 })).toHaveText('Passen & Pressing')

  for (const drill of ['Gegenpressing-Spiel', 'Rondo 4 gegen 2']) {
    await tina.getByRole('button', { name: 'Übung hinzufügen' }).click()
    await tina
      .getByRole('dialog')
      .getByRole('button', { name: new RegExp(drill) })
      .first()
      .click()
    await expect(tina.locator('.item__title', { hasText: drill })).toBeVisible()
  }
  await tina.getByRole('checkbox', { name: /Mit den Trainern im Verein teilen/ }).check()
  await tina.getByRole('button', { name: 'Speichern' }).click()
  await expect(tina.getByRole('status')).toContainText('Gespeichert')
  await tina.screenshot({ path: 'e2e/__screens__/60-template.png', fullPage: true })

  // Carl finds it in the club and puts it on his training.
  const page = await (await browser.newContext()).newPage()
  await login(page, carl.email, '/templates')
  await expect(page.getByRole('heading', { name: 'Im Verein geteilt' })).toBeVisible()
  await page.getByRole('link', { name: /Passen & Pressing/ }).click()
  await expect(page.getByText('in eure Übungsbibliothek kopiert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vorlage löschen' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Auf ein Training legen' }).click()
  await page.getByRole('dialog').locator('.pick__item').first().click()
  await expect(page).toHaveURL(/\/plan$/)
  await expect(page.locator('.plan-item__title', { hasText: 'Gegenpressing-Spiel' })).toBeVisible()
  await expect(page.locator('.plan-item__title', { hasText: 'Rondo 4 gegen 2' })).toBeVisible()
  // The copied drill is now part of U19's library and opens normally.
  await page.locator('.plan-item__title', { hasText: 'Gegenpressing-Spiel' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gegenpressing-Spiel')

  // Tina saves the plan of her seeded training as a template.
  await tina.goto(`/events/${demo.training.id}/plan`)
  await tina.getByRole('button', { name: 'Als Vorlage speichern' }).click()
  await tina.getByRole('dialog').getByLabel('Name').fill('Dienstagstraining')
  await tina.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click()
  // The plan page may also show the late-decline notice (role=status): pick the save message.
  await expect(
    tina.getByRole('status').filter({ hasText: 'Als Vorlage gespeichert' }),
  ).toBeVisible()
  await tina.goto('/templates')
  await expect(tina.getByRole('link', { name: /Dienstagstraining/ })).toContainText('3 Übungen')
  await tina.screenshot({ path: 'e2e/__screens__/61-templates.png', fullPage: true })
})
