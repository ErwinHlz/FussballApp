/**
 * Tactics board: drag players, equipment and zones from the palette onto the field, put the
 * ball at a player's feet, pass it in the next step, save and attach the board to a drill.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

/**
 * Drags a palette item from the edge to a point of the field area (fractions of its
 * width/height). The editor is full screen, so nothing has to scroll.
 */
async function dragToField(page: Page, item: string, fx: number, fy: number) {
  await dragFrom(page, page.locator(`[data-palette="${item}"]`), fx, fy)
}

async function dragFrom(page: Page, from: Locator, fx: number, fy: number) {
  await from.scrollIntoViewIfNeeded()
  const source = (await from.boundingBox())!
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
    .getByRole('link', { name: 'Taktik' })
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

  // Equipment and a zone (all in the same bar at the edge).
  await dragToField(page, 'cone', 0.5, 0.3)
  await dragToField(page, 'ladder', 0.15, 0.3)
  await dragToField(page, 'zoneRect', 0.5, 0.75)
  await expect(page.locator('.board--interactive .board__object')).toHaveCount(6)

  // An extra disc goes again: dragged onto the trash that appears below the field.
  await dragToField(page, 'disc', 0.8, 0.4)
  await expect(page.locator('.board--interactive .board__object')).toHaveCount(7)
  // The token itself (the object's box also holds the selection ring and the resize handle).
  const disc = (await page.locator('[data-object="d1"] > g').first().boundingBox())!
  await page.mouse.move(disc.x + disc.width / 2, disc.y + disc.height / 2)
  await page.mouse.down()
  await page.mouse.move(disc.x + disc.width / 2, disc.y + 40, { steps: 4 })
  const trash = (await page.locator('[data-trash]').boundingBox())!
  await page.mouse.move(trash.x + trash.width / 2, trash.y + trash.height / 2, { steps: 8 })
  await expect(page.locator('[data-trash]')).toHaveClass(/board-editor__trash--over/)
  await page.mouse.up()
  await expect(page.locator('.board--interactive .board__object')).toHaveCount(6)
  await expect(page.locator('[data-trash]')).toHaveCount(0)

  // Make the cone bigger with the handle on its selection ring.
  const cone = (await page.locator('[data-object="c1"] > g').first().boundingBox())!
  await page.mouse.click(cone.x + cone.width / 2, cone.y + cone.height / 2)
  const handle = (await page.locator('[data-handle] .board__knob').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + 40, handle.y - 40, { steps: 6 })
  await page.mouse.up()
  await announced(page, 'Prozent')

  // A squad player from the bar at the top left, with name and number.
  await page.getByRole('button', { name: 'Kader', exact: true }).click()
  await dragFrom(page, page.locator('[data-squad]', { hasText: 'Emil' }), 0.6, 0.3)
  await announced(page, 'Emil hinzugefügt')
  await expect(page.getByRole('button', { name: 'Spieler 9' })).toBeVisible()
  await page.getByRole('button', { name: 'Kader', exact: true }).click()

  // Rename player 2 and pass the ball to them in a new step.
  // Properties open as a sheet.
  await page.getByRole('button', { name: 'Schritt hinzufügen' }).click()
  await page.locator('[data-object="p2"]').dispatchEvent('pointerdown')
  await page.getByRole('button', { name: 'Eigenschaften' }).click()
  const props = page.getByRole('dialog', { name: 'Spieler 2' })
  await props.getByLabel('Name', { exact: true }).fill('Lena')
  await page.keyboard.press('Escape')
  await expect(props).toBeHidden()
  await page.getByRole('button', { name: /Ball geben/ }).click()
  await announced(page, 'Ball bei Spieler Lena')
  await page.screenshot({ path: 'e2e/__screens__/70-board-editor.png' })

  await page.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Animation gespeichert')

  // Picture of the current step as a PNG.
  await page.getByRole('button', { name: 'Bild teilen oder herunterladen' }).click()
  const picture = page.getByRole('dialog', { name: 'Bild von Schritt 2' })
  await expect(picture.getByRole('img')).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    picture.getByRole('button', { name: 'Als PNG herunterladen' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('ecke-kurz-schritt-2.png')
  await page.screenshot({ path: 'e2e/__screens__/72-board-picture.png' })
  await page.keyboard.press('Escape')

  // Attach to the team's drill (in the settings); the stored animation passes the ball.
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByRole('button', { name: 'An Übung hängen' }).click()
  await page
    .getByRole('dialog', { name: 'Übung wählen' })
    .getByRole('button', { name: /Ecke kurz – Übung/ })
    .click()
  await expect(page.getByRole('status')).toContainText('Ecke kurz – Übung')
  const stored = (
    await demo.coach.sb.from('drills').select('animation').eq('id', drill.id).single()
  ).data!.animation as {
    objects: { type: string; name?: string; label?: string; scale?: number }[]
    keyframes: { holders?: Record<string, string> }[]
  }
  expect(stored.objects.map((o) => o.type).sort()).toEqual(
    ['ball', 'cone', 'ladder', 'player', 'player', 'player', 'zone'].sort(),
  )
  expect(stored.objects.find((o) => o.name === 'Emil')).toMatchObject({ label: '9' })
  expect(stored.objects.some((o) => o.name === 'Lena')).toBe(true)
  expect(stored.objects.find((o) => o.type === 'cone')?.scale).toBeGreaterThan(1.5)
  expect(stored.keyframes[0]!.holders).toEqual({ b1: 'p1' })
  expect(stored.keyframes[1]!.holders).toEqual({ b1: 'p2' })

  // The board list shows a thumbnail.
  await page.goto('/boards')
  await expect(page.getByRole('link', { name: /Ecke kurz/ })).toContainText('2 Schritte')
  await page.screenshot({ path: 'e2e/__screens__/71-boards.png' })
})
