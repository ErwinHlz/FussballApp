/**
 * Lighthouse (mobile) for the main signed-in pages: start, events and an event page.
 * Needs the local backend and a production build served by `vite preview`:
 *   npm run build && npx vite preview --port 4173 --strictPort   (other terminal)
 *   node scripts/lighthouse.mjs
 * Seeds a demo club, signs in once in a Chromium with remote debugging and runs Lighthouse in
 * that browser (the session in localStorage is kept between the runs).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import { seedDemo, PASSWORD } from '../e2e/support/seed.ts'

const BASE = process.env.LH_BASE ?? 'http://localhost:4173'
const PORT = 9333
const OUT = new URL('../lighthouse/', import.meta.url)

const demo = await seedDemo()
const context = await chromium.launchPersistentContext('', {
  args: [`--remote-debugging-port=${PORT}`],
  locale: 'de-DE',
})
const page = await context.newPage()
await page.goto(`${BASE}/login`)
await page.getByLabel('E-Mail').fill(demo.player.email)
await page.getByLabel('Passwort', { exact: true }).fill(PASSWORD)
await page.getByRole('button', { name: 'Anmelden' }).click()
await page.waitForURL(/\/events$/)

const pages = [
  ['start', `${BASE}/`],
  ['events', `${BASE}/events`],
  ['event', `${BASE}/events/${demo.training.id}`],
]
mkdirSync(OUT, { recursive: true })
const rows = []
for (const [name, url] of pages) {
  const result = await lighthouse(url, {
    port: PORT,
    output: 'html',
    logLevel: 'error',
    // Keep the signed-in session; Lighthouse would clear storage by default.
    disableStorageReset: true,
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    formFactor: 'mobile',
  })
  writeFileSync(new URL(`${name}.html`, OUT), result.report)
  const c = result.lhr.categories
  const audit = (id) => result.lhr.audits[id]?.displayValue ?? '–'
  rows.push({
    page: name,
    performance: Math.round(c.performance.score * 100),
    accessibility: Math.round(c.accessibility.score * 100),
    bestPractices: Math.round(c['best-practices'].score * 100),
    lcp: audit('largest-contentful-paint'),
    cls: audit('cumulative-layout-shift'),
    tbt: audit('total-blocking-time'),
  })
}
console.table(rows)
writeFileSync(new URL('summary.json', OUT), JSON.stringify(rows, null, 2))
await context.close()
