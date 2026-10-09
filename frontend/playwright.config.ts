import { defineConfig } from '@playwright/test'

/**
 * Browser tests against the local stack (Supabase must be running: `npm start` in ../backend).
 * Runs the app on a separate port so it does not clash with `npm run dev`.
 */
const PORT = 5180

const phone = {
  viewport: { width: 375, height: 740 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...phone,
  },
  projects: [
    { name: 'phone', testIgnore: /screens\.spec\.ts/ },
    // Screenshot tour for visual review: `npm run test:screens`.
    { name: 'screens', testMatch: /screens\.spec\.ts/ },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
