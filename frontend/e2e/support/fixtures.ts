/**
 * Shared fixtures and checks for the cross-browser UI and accessibility suite.
 */
import AxeBuilder from '@axe-core/playwright'
import { test as base, expect, type Page } from '@playwright/test'

export type BrowserOptions = {
  /** Set by a project whose browser is not installed: its tests are skipped with this reason. */
  missingBrowser: string | undefined
}

export const test = base.extend<{ skipIfMissing: void }, BrowserOptions>({
  missingBrowser: [undefined, { option: true, scope: 'worker' }],
  skipIfMissing: [
    async ({ missingBrowser }, use, testInfo) => {
      testInfo.skip(!!missingBrowser, missingBrowser)
      await use()
    },
    { auto: true },
  ],
})

export { expect }

/** WCAG 2.1 level A and AA, the level the app aims for. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Runs axe on the page (or a part of it) and fails with a readable list of violations. */
export async function expectAccessible(page: Page, options: { include?: string } = {}) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS)
  if (options.include) builder = builder.include(options.include)
  const { violations } = await builder.analyze()
  const report = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n` +
      v.nodes
        .slice(0, 5)
        .map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, ' ')}`)
        .join('\n'),
  )
  // Soft: one run lists the problems of every checked page, not only the first.
  expect.soft(report, `accessibility violations on ${page.url()}`).toEqual([])
}

/** Waits until the page heading is shown and no loading placeholder is left. */
export async function ready(page: Page) {
  await expect(page.locator('main h1, h1').first()).toBeVisible()
  await expect(page.getByText(/^Lädt/)).toHaveCount(0)
  // Transitions (dialogs, lists) settle within their CSS duration.
  await page.waitForTimeout(300)
}

/** Collects unexpected console errors and page crashes; network 4xx logs are expected. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** The page must fit the phone width: no horizontal scrolling. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0)
}
