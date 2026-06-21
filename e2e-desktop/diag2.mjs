import { remote } from 'webdriverio'
const browser = await remote({ logLevel:'error', hostname:'127.0.0.1', port:4444, path:'/', capabilities:{'tauri:options':{application:process.env.APP_BIN}} })
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
try{
  await browser.waitUntil(async()=>(await browser.$('aside')).isExisting(),{timeout:25000,interval:500})
  const labels = await browser.execute(()=>[...document.querySelectorAll('aside button')].map(b=>b.getAttribute('aria-label')))
  console.log('ASIDE_BTN_LABELS', JSON.stringify(labels))
  // dispatch a full bubbling click sequence on Settings
  const r = await browser.execute(()=>{
    document.querySelectorAll('nextjs-portal').forEach(n=>n.remove())
    const el=document.querySelector('aside button[aria-label="Settings"]')
    if(!el) return 'no-el'
    for(const t of ['pointerdown','mousedown','pointerup','mouseup','click']) el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true}))
    return 'dispatched'
  })
  console.log('dispatch:', r)
  for(let i=0;i<10;i++){ const t=await browser.execute(()=>document.body.innerText); if(t.includes('Configured Providers')||t.includes('Manage API keys')){console.log('SETTINGS_OPENED at',i);break} await sleep(500) }
  const t=await browser.execute(()=>document.body.innerText)
  console.log('opened?', t.includes('Configured Providers'))
  // Also try the wdio native click as a cross-check
  const btn = await browser.$('aside button[aria-label="Settings"]')
  await btn.click().catch(e=>console.log('wdio click err', e.message))
  await sleep(1500)
  const t2=await browser.execute(()=>document.body.innerText)
  console.log('after-wdio-click opened?', t2.includes('Configured Providers'), '| has Models nav?', t2.includes('Manage API keys'))
}catch(e){console.log('DIAG_ERR',e.message)}finally{await browser.deleteSession()}
