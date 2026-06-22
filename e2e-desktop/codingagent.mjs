import { remote } from 'webdriverio'; import fs from 'fs'
const browser = await remote({ logLevel:'error', hostname:'127.0.0.1', port:4444, path:'/', capabilities:{'tauri:options':{application:process.env.APP_BIN}} })
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const body=()=>browser.execute(()=>document.body.innerText)
const kill=()=>browser.execute(()=>document.querySelectorAll('nextjs-portal').forEach(n=>n.remove())).catch(()=>{})
const click=(spec)=>browser.execute((sel,tag,text)=>{document.querySelectorAll('nextjs-portal').forEach(n=>n.remove());let el=sel?document.querySelector(sel):[...document.querySelectorAll(tag)].find(e=>e.textContent.trim()===text)||[...document.querySelectorAll(tag)].find(e=>e.textContent.includes(text));if(el){el.click();return true}return false},spec.sel||null,spec.tag||null,spec.text||null)
async function waitShell(){const t0=Date.now();while(Date.now()-t0<45000){await kill();const t=await body().catch(()=>'');if(t.includes('Agent Command Center')&&t.includes('New Agent'))return;await sleep(500)}throw new Error('no shell')}
async function waitText(s,to=15000){const n=s.toLowerCase();const t0=Date.now();while(Date.now()-t0<to){if((await body()).toLowerCase().includes(n))return true;await sleep(400)}throw new Error('timeout: '+s)}
try{
  await waitShell()
  let name
  for(let a=0;a<3;a++){ await click({tag:'button',text:'+ New Agent'}); await sleep(1200); name=await browser.$('input[placeholder="Agent name"]'); if(await name.isExisting())break }
  await name.setValue('CoderBot')
  await click({tag:'button',text:'Claude Code'})
  await click({tag:'button',text:'Create'})
  await waitText('CoderBot',15000)
  console.log('PASS: create-claude-code-agent')
  await kill()
  await browser.execute(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.textContent.trim()==='CoderBot'&&e.children.length===0);let n=el;for(let i=0;i<6&&n;i++){n.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));n=n.parentElement}})
  const ta=await browser.$('textarea[placeholder^="Send a message"]'); await ta.waitForExist({timeout:10000})
  await ta.setValue('hello'); await browser.keys('Enter')
  const t0=Date.now();let got=''
  while(Date.now()-t0<40000){got=await body();if(/project directory/i.test(got))break;await sleep(1000)}
  fs.writeFileSync('/tmp/shot-codingagent.png', await browser.takeScreenshot(),'base64')
  const m=got.match(/.{0,30}project directory.{0,30}/i)
  console.log(m?('RESULT_BUG: claude-code errors from UI -> "'+m[0].trim()+'"'):('RESULT_OK_OR_OTHER tail='+got.slice(-160)))
}catch(e){console.log('ERR',e.message)}finally{await browser.deleteSession()}
