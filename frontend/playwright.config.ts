import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'
import type { BrowserOptions } from './e2e/support/fixtures'

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

/** UI and accessibility suite that runs in every browser (`npm run test:browsers`). */
const crossBrowser = /(ui|a11y)\.spec\.ts/

/**
 * Opera is Chromium-based, so Playwright drives it through its own executable.
 * `OPERA_PATH` wins; otherwise the usual install locations are searched.
 * The launcher `opera.exe` on Windows starts a child process, so the versioned binary is used.
 */
function findOpera(): string | undefined {
  if (process.env.OPERA_PATH) return process.env.OPERA_PATH
  const local = process.env.LOCALAPPDATA ?? ''
  const windowsRoots = [
    join(local, 'Programs', 'Opera'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Opera'),
  ]
  for (const root of windowsRoots) {
    if (!existsSync(root)) continue
    const versions = readdirSync(root)
      .filter((name) => /^\d+(\.\d+)+$/.test(name))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    for (const version of versions) {
      const exe = join(root, version, 'opera.exe')
      if (existsSync(exe)) return exe
    }
  }
  return ['/Applications/Opera.app/Contents/MacOS/Opera', '/usr/bin/opera', '/snap/bin/opera'].find(
    (path) => existsSync(path),
  )
}
const operaPath = findOpera()

export default defineConfig<BrowserOptions>({
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
    { name: 'phone', testIgnore: [/screens\.spec\.ts/, crossBrowser] },
    // Screenshot tour for visual review: `npm run test:screens`.
    { name: 'screens', testMatch: /screens\.spec\.ts/ },

    // Cross-browser UI and accessibility suite.
    { name: 'chromium', testMatch: crossBrowser, use: { browserName: 'chromium' } },
    {
      name: 'firefox',
      testMatch: crossBrowser,
      // Firefox has no mobile emulation; the 375 px viewport with touch is what matters here.
      use: { browserName: 'firefox', isMobile: false },
    },
    {
      name: 'opera',
      testMatch: crossBrowser,
      use: {
        browserName: 'chromium',
        launchOptions: operaPath ? { executablePath: operaPath } : {},
        missingBrowser: operaPath
          ? undefined
          : 'Opera not found: install it or set OPERA_PATH to the opera executable',
      },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
