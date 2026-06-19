import { test, expect } from '@playwright/test'

/**
 * Web-mode E2E for the app shell (WP9).
 *
 * Drives the Next.js dev server with Chromium. This covers UI flow and
 * rendering only. Tauri-only features (keychain, SQLite) are unavailable in a
 * plain browser, so flows that would persist data are asserted only **up to**
 * the Tauri boundary — persistence itself is out of scope for web-mode E2E.
 *
 * Components call Tauri APIs on mount (initDb / loadCanvasState / keychain).
 * Those calls reject in web mode but are caught, so the shell still renders.
 * If the app ever crashes at load here, that is itself a finding.
 */

test.describe('app shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // The Next.js dev-tools indicator renders as a <nextjs-portal> fixed to the
    // bottom-left corner, overlapping the Settings gear at the bottom of the
    // sidebar and intercepting clicks. It's a dev-only affordance with no
    // bearing on the app under test, so hide it.
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  })

  test('loads with sidebar, top bar, status bar, and canvas visible', async ({ page }) => {
    // Sidebar — nav buttons are keyed by aria-label.
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Store' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()

    // Top bar.
    await expect(page.getByText('Agent Command Center')).toBeVisible()
    await expect(page.getByRole('button', { name: '+ New Agent' })).toBeVisible()

    // Status bar.
    await expect(page.getByText(/running/)).toBeVisible()
    await expect(page.getByText(/idle/)).toBeVisible()

    // Canvas region (ReactFlow). It renders null until loadCanvasState settles,
    // so wait for the react-flow root to appear.
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('opens Settings panel with Providers and Models sections', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click()

    // Settings panel header.
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Section nav — Providers is the default active section, Models is selectable.
    await expect(page.getByRole('button', { name: 'Providers' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Models' })).toBeVisible()

    // Providers section content renders by default.
    await expect(page.getByText('Configured Providers')).toBeVisible()

    // Switching to Models renders that section.
    await page.getByRole('button', { name: 'Models' }).click()
    await expect(page.getByText('Configured Models')).toBeVisible()
  })

  test('opens Store panel with catalog rows', async ({ page }) => {
    await page.getByRole('button', { name: 'Store' }).click()

    // Tabs.
    await expect(page.getByRole('button', { name: 'MCP Servers' })).toBeVisible()

    // Catalog rows from MCP_CATALOG render — assert by an entry name + description.
    await expect(page.getByText('@modelcontextprotocol/server-filesystem')).toBeVisible()
    await expect(page.getByText('Read and write files on the local filesystem')).toBeVisible()
  })

  test('opens Create Agent panel showing form fields', async ({ page }) => {
    await page.getByRole('button', { name: '+ New Agent' }).click()

    // Panel header ("New Agent" — exact, to avoid matching the "+ New Agent" button).
    await expect(page.getByText('New Agent', { exact: true })).toBeVisible()

    // Name field.
    await expect(page.getByPlaceholder('Agent name')).toBeVisible()

    // Type toggle.
    await expect(page.getByRole('button', { name: 'LLM' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Claude Code' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Codex' })).toBeVisible()

    // Model section. In web mode the models DB is unavailable, so the panel
    // shows the "no models configured" fallback rather than a populated <select>.
    // Either way the Model label is present — assert up to the Tauri boundary;
    // actually creating an agent would write SQLite, which is out of scope here.
    await expect(page.getByText('Model', { exact: true })).toBeVisible()
  })
})
