// Renders public/icon.svg to the PNG sizes used by the web app manifest and iOS.
// Usage (from frontend/): node scripts/render-icons.mjs   (needs: npx playwright install chromium)
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const targets = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size] of targets) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.locator('svg').screenshot({ path: file, omitBackground: false })
  console.log('wrote', file)
}
await browser.close()
