import { remote } from 'webdriverio'; import fs from 'fs'
const browser = await remote({ logLevel:'error', hostname:'127.0.0.1', port:4444, path:'/', capabilities:{'tauri:options':{application:process.env.APP_BIN}} })
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
try{
  await browser.waitUntil(async()=>(await browser.$('aside')).isExisting(),{timeout:25000,interval:500})
  await browser.execute(()=>document.querySelectorAll('nextjs-portal').forEach(n=>n.remove()))
  const found = await browser.execute(()=>{ const el=document.querySelector('aside button[aria-label="Settings"]'); if(el){el.click(); return true} return false })
  console.log('settings-clicked:', found)
  await sleep(2500)
  const txt = await browser.execute(()=>document.body.innerText)
  console.log('[BODY_AFTER_SETTINGS]'); console.log(txt); console.log('[END]')
  fs.writeFileSync('/tmp/shot-diag-settings.png', await browser.takeScreenshot(),'base64')
}catch(e){console.log('DIAG_ERR',e.message)}finally{await browser.deleteSession()}
