// Full end-to-end desktop suite driven against the REAL Tauri binary via
// tauri-driver. Exercises vault-backed persistence, navigation, settings,
// model add, agent create, edit, and a REAL Claude inference round-trip through
// the app's claude-cli provider. Run inside xvfb + dbus + unlocked gnome-keyring.
import { remote } from 'webdriverio'
import fs from 'fs'

const APP = process.env.APP_BIN
const results = []
const pass = (n, extra) => { results.push({ step: n, ok: true, ...extra }); console.log('PASS:', n, extra ? JSON.stringify(extra) : '') }
const fail = (n, e) => { results.push({ step: n, ok: false, error: String(e) }); console.log('FAIL:', n, '-', String(e)) }

const browser = await remote({
  logLevel: 'error', hostname: '127.0.0.1', port: 4444, path: '/',
  capabilities: { 'tauri:options': { application: APP } },
})

const sleep = ms => new Promise(r => setTimeout(r, ms))
const killOverlay = () => browser.execute(() => { document.querySelectorAll('nextjs-portal').forEach(n => n.remove()) }).catch(() => {})
const bodyText = () => browser.execute(() => document.body.innerText)
const shot = async (name) => { try { fs.writeFileSync(`/tmp/shot-${name}.png`, await browser.takeScreenshot(), 'base64') } catch {} }

// Query + click entirely inside the browser: immune to element-ref races and to
// Next dev-overlay pointer interception, while still firing React's onClick.
async function click({ sel, tag, text }, timeout = 12000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const ok = await browser.execute((sel, tag, text) => {
      document.querySelectorAll('nextjs-portal').forEach(n => n.remove())
      let el
      if (sel) el = document.querySelector(sel)
      else {
        const all = [...document.querySelectorAll(tag)]
        // Prefer an exact text match; fall back to a contains match for buttons
        // with composite content (e.g. a model row with name + context + "Add →").
        el = all.find(e => e.textContent.trim() === text) || all.find(e => e.textContent.includes(text))
      }
      if (el) { el.click(); return true }
      return false
    }, sel || null, tag || null, text || null)
    if (ok) return true
    await sleep(300)
  }
  throw new Error('click target not found: ' + (sel || `${tag}:${text}`))
}
// Case-insensitive: WebKit innerText returns CSS text-transform:uppercase
// headings (e.g. "Configured Providers") as uppercase.
async function waitForText(substr, timeout = 15000) {
  const needle = substr.toLowerCase()
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) { if ((await bodyText()).toLowerCase().includes(needle)) return true; await sleep(400) }
  throw new Error(`timeout waiting for text: ${substr}`)
}
// Wait for the real shell (past the VaultGate unlock/decrypt screens).
async function waitShell() {
  const t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    await killOverlay()
    const t = await bodyText().catch(() => '')
    if (t.includes('Agent Command Center') && t.includes('New Agent')) return
    await sleep(500)
  }
  throw new Error('shell did not render: ' + (await bodyText()).slice(0, 160))
}

try {
  // 1. Shell + vault unlock
  await waitShell()
  const txt = await bodyText()
  if (txt.includes('running') && txt.includes('models')) pass('shell-renders-vault-unlocked')
  else throw new Error('statusbar missing: ' + txt.slice(0, 160))
  await shot('01-shell')

  // 2. Store panel
  await click({ sel: 'aside button[aria-label="Store"]' })
  await waitForText('MCP Servers'); await waitForText('Skills')
  pass('nav-store-opens'); await shot('02-store')

  // 3. Workflows panel
  await click({ sel: 'aside button[aria-label="Workflows"]' })
  await waitForText('workflow')
  pass('nav-workflows-opens')

  // 4. Settings
  await click({ sel: 'aside button[aria-label="Settings"]' })
  await waitForText('Configured Providers')
  pass('nav-settings-opens'); await shot('03-settings')

  // 5. Add a real Claude (subscription) model (DB write via encrypted vault)
  await click({ sel: 'button[aria-label="Models"]' })
  await waitForText('Configured Models')
  await click({ tag: 'button', text: 'Add Model' })
  await waitForText('Select Provider')
  await click({ tag: 'button', text: 'Claude (subscription)' })
  await waitForText('Claude Sonnet (subscription)', 20000)
  await click({ tag: 'button', text: 'Claude Sonnet (subscription)' })
  await waitForText('Claude Sonnet (subscription)', 15000)
  pass('add-claude-model-persisted'); await shot('04-model-added')

  // Close settings, reload -> StatusBar reflects the persisted model
  await click({ sel: 'button[aria-label="Close settings"]' })
  await browser.execute(() => location.reload())
  await waitShell()
  if ((await bodyText()).includes('1 models')) pass('statusbar-models-count-persisted')
  else fail('statusbar-models-count-persisted', 'expected "1 models", got: ' + (await bodyText()))

  // 6. Create an LLM agent bound to that model
  await click({ tag: 'button', text: '+ New Agent' })
  await waitForText('New Agent')
  const nameInput = await browser.$('input[placeholder="Agent name"]')
  await nameInput.waitForExist({ timeout: 8000 })
  await nameInput.setValue('PingBot')
  const sel = await browser.$('select'); await sel.selectByVisibleText('Claude Sonnet (subscription)')
  await click({ tag: 'button', text: 'Create' })
  await waitForText('PingBot', 15000)
  pass('create-llm-agent-persisted'); await shot('05-agent-created')

  // 7. Persistence proof: reload -> agent survives (encrypted DB)
  await browser.execute(() => location.reload())
  await waitShell()
  await waitForText('PingBot', 15000)
  pass('agent-survives-reload-encrypted-db')

  // 8. REAL LLM chat round-trip through the claude-cli provider + process sidecar
  await killOverlay()
  await browser.execute(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.textContent.trim() === 'PingBot' && e.children.length === 0)
    let node = el
    for (let i = 0; i < 6 && node; i++) { node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); node = node.parentElement }
  })
  const ta = await browser.$('textarea[placeholder^="Send a message"]')
  await ta.waitForExist({ timeout: 10000 })
  await ta.setValue('Reply with exactly: PONG')
  await browser.keys('Enter')
  const t0 = Date.now(); let got = ''
  while (Date.now() - t0 < 90000) {
    got = await bodyText()
    if ((got.match(/PONG/g) || []).length >= 2) break
    await sleep(1500)
  }
  await shot('06-chat-pong')
  const occurrences = (got.match(/PONG/g) || []).length
  if (occurrences >= 2) pass('real-llm-chat-pong', { occurrences })
  else fail('real-llm-chat-pong', 'no assistant PONG; tail=' + got.slice(-200))

} catch (e) {
  fail('suite-exception', e.stack || e.message)
} finally {
  console.log('SUITE_RESULTS', JSON.stringify(results))
  await browser.deleteSession()
}
process.exitCode = results.some(r => !r.ok) ? 1 : 0
