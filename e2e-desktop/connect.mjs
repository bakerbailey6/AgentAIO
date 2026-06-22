import { remote } from 'webdriverio'
const APP = process.env.APP_BIN
const log = (...a) => console.log('[wdio]', ...a)
const browser = await remote({
  logLevel: 'error',
  hostname: '127.0.0.1', port: 4444, path: '/',
  capabilities: { 'tauri:options': { application: APP }, 'wdio:maxInstances': 1 },
})
try {
  log('session started')
  // Wait for the shell to render (vault must unlock first)
  await browser.waitUntil(async () => (await browser.$('aside')).isExisting(), { timeout: 25000, interval: 500 })
  const title = await browser.$('span=Agent Command Center')
  log('title present:', await title.isExisting())
  const newAgent = await browser.$('button=+ New Agent')
  log('New Agent btn present:', await newAgent.isExisting())
  const bodyText = await (await browser.$('body')).getText()
  log('status bar contains "running":', bodyText.includes('running'))
  log('RESULT_OK', JSON.stringify({ title: await title.isExisting(), newAgent: await newAgent.isExisting() }))
} catch (e) {
  log('RESULT_FAIL', e.message)
  process.exitCode = 1
} finally {
  await browser.deleteSession()
}
