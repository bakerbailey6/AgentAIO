import { remote } from 'webdriverio'; import fs from 'fs'
const browser = await remote({ logLevel:'error', hostname:'127.0.0.1', port:4444, path:'/', capabilities:{'tauri:options':{application:process.env.APP_BIN}} })
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const body=()=>browser.execute(()=>document.body.innerText)
const kill=()=>browser.execute(()=>document.querySelectorAll('nextjs-portal').forEach(n=>n.remove())).catch(()=>{})
const click=(spec)=>browser.execute((sel,tag,text)=>{document.querySelectorAll('nextjs-portal').forEach(n=>n.remove());let el=sel?document.querySelector(sel):[...document.querySelectorAll(tag)].find(e=>e.textContent.trim()===text)||[...document.querySelectorAll(tag)].find(e=>e.textContent.includes(text));if(el){el.click();return true}return false},spec.sel||null,spec.tag||null,spec.text||null)
const inv=(cmd,args)=>browser.execute(async(cmd,args)=>{try{return await window.__TAURI_INTERNALS__.invoke(cmd,args)}catch(e){return '__ERR__:'+e}},cmd,args)
async function waitShell(){const t0=Date.now();while(Date.now()-t0<45000){await kill();const t=await body().catch(()=>'');if(t.includes('Agent Command Center')&&t.includes('New Agent'))return;await sleep(500)}throw new Error('no shell')}
async function waitText(s,to=15000){const n=s.toLowerCase();const t0=Date.now();while(Date.now()-t0<to){if((await body()).toLowerCase().includes(n))return true;await sleep(400)}throw new Error('timeout: '+s)}
const ROOT='/tmp/agentrepo'
try{
  await waitShell()
  // Create a Claude Code agent bound to the repo
  let nameInput; for(let a=0;a<3;a++){await click({tag:'button',text:'+ New Agent'});await sleep(1000);nameInput=await browser.$('input[placeholder="Agent name"]');if(await nameInput.isExisting())break}
  await nameInput.setValue('Coder')
  await click({tag:'button',text:'Claude Code'}); await sleep(400)
  const ws=await browser.$('input[placeholder="/path/to/repo"]'); await ws.setValue(ROOT)
  await click({tag:'button',text:'Create'}); await waitText('Coder',12000)
  console.log('PASS: create-claude-code-agent-with-workspace')
  // Open chat and give it a real file task
  await kill()
  await browser.execute(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.textContent.trim()==='Coder'&&e.children.length===0);let n=el;for(let i=0;i<6&&n;i++){n.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));n=n.parentElement}})
  const ta=await browser.$('textarea[placeholder^="Send a message"]'); await ta.waitForExist({timeout:10000})
  await ta.setValue('Create a file named GREETING2.txt in the current directory containing exactly: AGENT_WAS_HERE')
  await browser.keys('Enter')
  // Poll (through the app) until the agent has autonomously created the file
  let content=''
  const t0=Date.now()
  while(Date.now()-t0<150000){
    const r=await inv('fs_read_text',{path:ROOT+'/GREETING2.txt',allowedPaths:[ROOT]})
    if(typeof r==='string' && r.includes('AGENT_WAS_HERE')){content=r;break}
    await sleep(2500)
  }
  fs.writeFileSync('/tmp/shot-claude-code-repo.png', await browser.takeScreenshot(),'base64')
  if(content.includes('AGENT_WAS_HERE')) console.log('PASS: claude-code-agent AUTONOMOUSLY created the file in the repo -> '+JSON.stringify(content.trim()))
  else console.log('FAIL: file not created; chat tail='+(await body()).slice(-200))
}catch(e){console.log('FAIL exception',e.message)}finally{await browser.deleteSession()}
