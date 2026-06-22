import { remote } from 'webdriverio'
const APP = process.env.APP_BIN
const browser = await remote({ logLevel:'error', hostname:'127.0.0.1', port:4444, path:'/',
  capabilities: { 'tauri:options': { application: APP } } })
try {
  await new Promise(r => setTimeout(r, 6000))
  const txt = await browser.execute(() => document.body.innerText)
  console.log('[BODYTEXT_START]')
  console.log(txt)
  console.log('[BODYTEXT_END]')
  const btns = await browser.execute(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0,20))
  console.log('[BUTTONS]', JSON.stringify(btns))
  const shot = await browser.takeScreenshot()
  const fs = await import('fs'); fs.writeFileSync('/tmp/drv-shot.png', shot, 'base64')
  console.log('[SHOT_SAVED]')
} catch(e){ console.log('[DIAG_FAIL]', e.message) } finally { await browser.deleteSession() }
