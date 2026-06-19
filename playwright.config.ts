import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for web-mode E2E (WP9).
 *
 * Drives the Next.js web build (`npm run dev`) with Chromium. This exercises
 * UI flow and rendering only — Tauri-only features (keychain, SQLite) are
 * absent in web mode, so persistence is out of scope here.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
