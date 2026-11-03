/**
 * Tactics board zoom: two fingers zoom the field (never the page), one finger moves the zoomed
 * view, and with an object selected the same gesture makes the object bigger.
 */
import { expect, test, type Page } from '@playwright/test'
import { login } from './support/app'
import { seedDemo } from './support/seed'

/** Two-finger pinch through the browser's touch input, spreading by `spread` pixels. */
async function pinch(page: Page, x: number, y: number, spread: number) {
  const cdp = await page.context().newCDPSession(page)
  const points = (d: number) => [
    { x: x - 20 - d, y, id: 1 },
    { x: x + 20 + d, y, id: 2 },
  ]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) })
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points((spread * i) / 8),
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('pinching zooms the field, not the page, and resizes a selected object', async ({ page }) => {
  const demo = await seedDemo()
  const board = (
    await demo.coach.sb
      .from('tactic_boards')
      .insert({
        team_id: demo.team.id,
        title: 'Zoom',
        animation: {
          version: 1,
          field: 'half',
          durationMs: 6000,
          objects: [{ id: 'c1', type: 'cone', color: '#f97316' }],
          keyframes: [{ t: 0, positions: { c1: [50, 50] } }],
          annotations: [],
        },
      })
      .select()
      .single()
  ).data!

  await login(page, demo.coach.email, `/boards/${board.id}`)
  const field = page.locator('svg.board--interactive')
  await expect(field).toBeVisible()
  const viewBox = await field.getAttribute('viewBox')
  const box = (await field.boundingBox())!

  // Nothing selected: the field zooms, the page keeps its scale.
  await pinch(page, box.x + box.width * 0.3, box.y + box.height * 0.3, 60)
  await expect(field).not.toHaveAttribute('viewBox', viewBox!)
  const reset = page.getByRole('button', { name: /^Zoom \d+ % · zurücksetzen$/ })
  await expect(reset).toBeVisible()
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1)

  // One finger on free grass moves the zoomed view.
  const zoomed = await field.getAttribute('viewBox')
  await swipe(page, box.x + box.width * 0.7, box.y + box.height * 0.6, -60, -40)
  await expect(field).not.toHaveAttribute('viewBox', zoomed!)
  await page.screenshot({ path: 'e2e/__screens__/73-board-zoom.png' })

  // The picture still shows the whole field.
  await page.getByRole('button', { name: 'Bild teilen oder herunterladen' }).click()
  await expect(
    page.getByRole('dialog', { name: /Bild von Schritt/ }).getByRole('img'),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  await reset.click()
  await expect(field).toHaveAttribute('viewBox', viewBox!)

  // Selected object: the same gesture makes it bigger.
  const cone = (await page.locator('[data-object="c1"] > g').first().boundingBox())!
  await page.mouse.click(cone.x + cone.width / 2, cone.y + cone.height / 2)
  await pinch(page, box.x + box.width / 2, box.y + box.height * 0.7, 80)
  await expect(page.locator('[data-object="c1"] > g').first()).toHaveAttribute(
    'transform',
    /scale\((1\.[5-9]|[23](\.\d+)?)\)/,
  )
  await expect(field).toHaveAttribute('viewBox', viewBox!)
})

/** One finger dragging on the field. */
async function swipe(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 6, y: y + (dy * i) / 6, id: 1 }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
