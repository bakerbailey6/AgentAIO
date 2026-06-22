import { remote } from 'webdriverio'; import fs from 'fs'
const browser = await remote({ logLevel:'error', hostname:'127.0.0.1', port:4444, path:'/', capabilities:{'tauri:options':{application:process.env.APP_BIN}} })
const results=[]; const pass=(n,x)=>{results.push({step:n,ok:true,...x});console.log('PASS:',n,x?JSON.stringify(x):'')}; const fail=(n,e)=>{results.push({step:n,ok:false,error:String(e)});console.log('FAIL:',n,'-',String(e))}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const body=()=>browser.execute(()=>document.body.innerText)
const kill=()=>browser.execute(()=>document.querySelectorAll('nextjs-portal').forEach(n=>n.remove())).catch(()=>{})
const click=(spec)=>browser.execute((sel,tag,text)=>{document.querySelectorAll('nextjs-portal').forEach(n=>n.remove());let el=sel?document.querySelector(sel):[...document.querySelectorAll(tag)].find(e=>e.textContent.trim()===text)||[...document.querySelectorAll(tag)].find(e=>e.textContent.includes(text));if(el){el.click();return true}return false},spec.sel||null,spec.tag||null,spec.text||null)
async function waitShell(){const t0=Date.now();while(Date.now()-t0<45000){await kill();const t=await body().catch(()=>'');if(t.includes('Agent Command Center')&&t.includes('New Agent'))return;await sleep(500)}throw new Error('no shell')}
async function waitText(s,to=15000){const n=s.toLowerCase();const t0=Date.now();while(Date.now()-t0<to){if((await body()).toLowerCase().includes(n))return true;await sleep(400)}throw new Error('timeout: '+s)}
try{
  await waitShell()
  // Create an LLM agent (no model needed)
  let name; for(let a=0;a<3;a++){await click({tag:'button',text:'+ New Agent'});await sleep(1000);name=await browser.$('input[placeholder="Agent name"]');if(await name.isExisting())break}
  await name.setValue('EditMe'); await click({tag:'button',text:'Create'}); await waitText('EditMe')
  pass('create-agent-for-edit')

  // Edit agent -> rename
  await kill(); await click({sel:'button[aria-label="Edit agent"]'}); await waitText('Edit Agent')
  const en=await browser.$('input[placeholder="Agent name"]'); await en.waitForExist({timeout:8000})
  await en.setValue('EditedBot'); await click({tag:'button',text:'Save'})
  await waitText('EditedBot',12000); const b=await body()
  if(b.includes('EditedBot') && !b.includes('EditMe')) pass('edit-agent-rename-persisted'); else fail('edit-agent-rename-persisted','EditMe still present or EditedBot missing')

  // Store: install a tool
  await click({sel:'aside button[aria-label="Store"]'}); await waitText('MCP Servers')
  await click({tag:'button',text:'Tools'}); await sleep(600); await waitText('Install',8000)
  await click({tag:'button',text:'Install'}); await sleep(1200)
  if((await body()).includes('Remove')) pass('store-install-tool'); else fail('store-install-tool','no Remove after install')

  // Assign installed tool to the agent
  await click({tag:'button',text:'Assign ▾'}); await sleep(700)
  const cb=await browser.$('input[type="checkbox"]')
  if(await cb.isExisting()){ await browser.execute(e=>e.click(),cb); await sleep(900); if((await body()).includes('Assigned to')) pass('store-assign-tool-to-agent'); else fail('store-assign-tool-to-agent','no "Assigned to" label') }
  else fail('store-assign-tool-to-agent','no checkbox')

  // Reload -> tool persists in StatusBar
  await click({sel:'aside button[aria-label="Home"]'})
  await browser.execute(()=>location.reload()); await sleep(3000); await waitShell()
  if((await body()).includes('1 tools')) pass('statusbar-tools-count-persisted'); else fail('statusbar-tools-count-persisted','got: '+(await body()).slice(-80))

  // Workflow: create + save + persist
  await click({sel:'aside button[aria-label="Workflows"]'}); await waitText('workflow')
  await click({tag:'button',text:'New workflow'}); await waitText('Back',12000)
  pass('workflow-editor-opens')
  await click({tag:'button',text:'Save'}); await sleep(800)
  await click({tag:'button',text:'Back'}); await sleep(800)
  await browser.execute(()=>location.reload()); await sleep(3000); await waitShell()
  await click({sel:'aside button[aria-label="Workflows"]'}); await sleep(800)
  const wf=await body()
  if(!wf.includes('No workflows yet')) pass('workflow-persisted'); else fail('workflow-persisted','workflow list empty after save')
  fs.writeFileSync('/tmp/shot-feature2.png', await browser.takeScreenshot(),'base64')
}catch(e){fail('exception',e.stack||e.message)}finally{console.log('SUITE_RESULTS',JSON.stringify(results));await browser.deleteSession()}
process.exitCode=results.some(r=>!r.ok)?1:0
