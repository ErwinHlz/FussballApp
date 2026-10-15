/**
 * Tactics board: drag players, equipment and zones from the palette onto the field, put the
 * ball at a player's feet, pass it in the next step, save and attach the board to a drill.
 */
import { expect, test, type Page } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

/** Drags a palette item to a point of the field (fractions of the field's width/height). */
async function dragToField(page: Page, item: string, fx: number, fy: number) {
  // Like a user: scroll so the field starts just below the app header, the palette follows.
  await page.locator('svg.board--interactive').evaluate((el) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70)
  })
  const source = (await page.locator(`[data-palette="${item}"]`).boundingBox())!
  const field = (await page.locator('svg.board--interactive').boundingBox())!
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  const tx = field.x + field.width * fx
  const ty = field.y + field.height * fy
  await page.mouse.move(tx, ty, { steps: 8 })
  await page.mouse.up()
}

const announced = (page: Page, text: string) =>
  expect(page.locator('.visually-hidden', { hasText: text })).toHaveCount(1)

test('coach builds an animated board by drag and drop and attaches it to a drill', async ({
  page,
}) => {
  const demo = await seedDemo()
  const drill = (
    await demo.coach.sb
      .from('drills')
      .insert({ team_id: demo.team.id, title: 'Ecke kurz – Übung', category: 'tactics' })
      .select()
      .single()
  ).data!

  await login(page, demo.coach.email, '/training')
  await page
    .getByRole('navigation', { name: 'Bereiche im Training' })
    .getByRole('link', { name: 'Taktiktafel' })
    .click()
  await page.getByLabel('Name').fill('Ecke kurz')
  await page.getByRole('button', { name: 'Neue Tafel' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ecke kurz')

  // People: two players, the ball dropped at the first one's feet.
  await dragToField(page, 'player', 0.3, 0.6)
  await dragToField(page, 'player', 0.7, 0.6)
  await expect(page.locator('[data-object="p1"]')).toHaveAttribute('aria-label', 'Spieler 1')
  await expect(page.locator('[data-object="p2"]')).toHaveAttribute('aria-label', 'Spieler 2')
  await dragToField(page, 'ball', 0.31, 0.61)
  await announced(page, 'Ball bei Spieler 1')

  // Equipment and a zone.
  await page.getByRole('button', { name: 'Material', exact: true }).click()
  await dragToField(page, 'cone', 0.5, 0.3)
  await dragToField(page, 'ladder', 0.15, 0.3)
  await page.getByRole('button', { name: 'Zonen', exact: true }).click()
  await dragToField(page, 'zoneRect', 0.5, 0.75)
  await expect(page.locator('.board--interactive .board__object')).toHaveCount(6)

  // Rename player 2 and pass the ball to them in a new step.
  // Steps are the dock's second panel; properties open as a sheet.
  await page.getByRole('tab', { name: 'Ablauf' }).click()
  await page.getByRole('button', { name: '+ Schritt' }).click()
  await page.locator('[data-object="p2"]').dispatchEvent('pointerdown')
  await page.getByRole('button', { name: 'Eigenschaften' }).click()
  const props = page.getByRole('dialog', { name: 'Spieler 2' })
  await props.getByLabel('Name', { exact: true }).fill('Lena')
  await page.keyboard.press('Escape')
  await expect(props).toBeHidden()
  await page.getByRole('button', { name: /Ball geben/ }).click()
  await announced(page, 'Ball bei Spieler Lena')
  await page.screenshot({ path: 'e2e/__screens__/70-board-editor.png', fullPage: true })
  await page.locator('[data-object="p2"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'e2e/__screens__/70b-board-editor-viewport.png' })

  await page.getByRole('button', { name: 'Tafel speichern' }).click()
  await expect(page.getByRole('status')).toContainText('Animation gespeichert')

  // Attach to the team's drill; the stored animation passes the ball.
  await page.getByRole('button', { name: 'An Übung hängen' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Ecke kurz – Übung/ })
    .click()
  await expect(page.getByRole('status')).toContainText('Ecke kurz – Übung')
  const stored = (
    await demo.coach.sb.from('drills').select('animation').eq('id', drill.id).single()
  ).data!.animation as {
    objects: { type: string; name?: string }[]
    keyframes: { holders?: Record<string, string> }[]
  }
  expect(stored.objects.map((o) => o.type).sort()).toEqual(
    ['ball', 'cone', 'ladder', 'player', 'player', 'zone'].sort(),
  )
  expect(stored.objects.find((o) => o.name)?.name).toBe('Lena')
  expect(stored.keyframes[0]!.holders).toEqual({ b1: 'p1' })
  expect(stored.keyframes[1]!.holders).toEqual({ b1: 'p2' })

  // The board list shows a thumbnail.
  await page.goto('/boards')
  await expect(page.getByRole('link', { name: /Ecke kurz/ })).toContainText('2 Schritte')
  await page.screenshot({ path: 'e2e/__screens__/71-boards.png' })
})
