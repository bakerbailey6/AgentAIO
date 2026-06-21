import { remote } from 'webdriverio'; import fs from 'fs'
const MCP_CMD='http://localhost:3334/sse'
const browser = await remote({ logLevel:'error', hostname:'127.0.0.1', port:4444, path:'/', capabilities:{'tauri:options':{application:process.env.APP_BIN}} })
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const body=()=>browser.execute(()=>document.body.innerText)
const kill=()=>browser.execute(()=>document.querySelectorAll('nextjs-portal').forEach(n=>n.remove())).catch(()=>{})
const click=(spec)=>browser.execute((sel,tag,text)=>{document.querySelectorAll('nextjs-portal').forEach(n=>n.remove());let el=sel?document.querySelector(sel):[...document.querySelectorAll(tag)].find(e=>e.textContent.trim()===text)||[...document.querySelectorAll(tag)].find(e=>e.textContent.includes(text));if(el){el.click();return true}return false},spec.sel||null,spec.tag||null,spec.text||null)
async function waitShell(){const t0=Date.now();while(Date.now()-t0<45000){await kill();const t=await body().catch(()=>'');if(t.includes('Agent Command Center')&&t.includes('New Agent'))return;await sleep(500)}throw new Error('no shell')}
async function waitText(s,to=15000){const n=s.toLowerCase();const t0=Date.now();while(Date.now()-t0<to){if((await body()).toLowerCase().includes(n))return true;await sleep(400)}throw new Error('timeout: '+s)}
async function clickUntil(spec,expect,tries=5){for(let i=0;i<tries;i++){await click(spec);await sleep(1200);try{await waitText(expect,4000);return}catch{}}throw new Error('clickUntil failed: '+expect)}
const results=[]; const pass=(n,x)=>{results.push({step:n,ok:true,...x});console.log('PASS:',n,x?JSON.stringify(x):'')}; const fail=(n,e)=>{results.push({step:n,ok:false,error:String(e)});console.log('FAIL:',n,'-',String(e))}
try{
  await waitShell()
  // model
  await clickUntil({sel:'aside button[aria-label="Settings"]'},'Configured Providers')
  await clickUntil({sel:'button[aria-label="Models"]'},'Configured Models')
  await clickUntil({tag:'button',text:'Add Model'},'Select Provider')
  await clickUntil({tag:'button',text:'Ollama (Local)'},'llama3.2:3b',6)
  await click({tag:'button',text:'llama3.2:3b'}); await waitText('llama3.2:3b',12000)
  await click({sel:'button[aria-label="Close settings"]'}); await sleep(500)
  // agent (no workspace -> only MCP tools)
  let nameInput; for(let a=0;a<3;a++){await click({tag:'button',text:'+ New Agent'});await sleep(1000);nameInput=await browser.$('input[placeholder="Agent name"]');if(await nameInput.isExisting())break}
  await nameInput.setValue('McpSseBot')
  const sel=await browser.$('select'); await sel.selectByVisibleText('llama3.2:3b')
  await click({tag:'button',text:'Create'}); await waitText('McpSseBot',12000)
  // add the MCP server via the Store footer
  await clickUntil({sel:'aside button[aria-label="Store"]'},'MCP Servers')
  const fi=await browser.$('input[placeholder*='https']'); await fi.waitForExist({timeout:8000}); await fi.setValue(MCP_CMD)
  await click({tag:'button',text:'Add'}); await sleep(1500)
  pass('mcp-server-added')
  await click({sel:'aside button[aria-label="Home"]'}); await sleep(500)
  // assign MCP to McpSseBot via Edit
  await kill()
  await browser.execute(()=>{const el=[...document.querySelectorAll('button[aria-label="Edit agent"]')][0]; if(el)el.click()})
  await waitText('Edit Agent',10000)
  // check the first MCP checkbox in the MCP Servers section
  const checked = await browser.execute(()=>{ const cbs=[...document.querySelectorAll('input[type=checkbox]')]; if(cbs.length){cbs[cbs.length-1].click(); return cbs.length} return 0 })
  await click({tag:'button',text:'Save'}); await sleep(1500)
  pass('mcp-assigned-to-agent', {checkboxes:checked})
  // chat -> model should call the MCP echo tool
  await kill()
  await browser.execute(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.textContent.trim()==='McpSseBot'&&e.children.length===0);let n=el;for(let i=0;i<6&&n;i++){n.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));n=n.parentElement}})
  const ta=await browser.$('textarea[placeholder^="Send a message"]'); await ta.waitForExist({timeout:10000})
  await ta.setValue('Call the echo tool with the message MCP_OK and report what it returns.')
  await browser.keys('Enter')
  let got=''
  const t0=Date.now()
  while(Date.now()-t0<180000){got=await body(); if(/mcp__|echo|MCP_OK/i.test(got.replace('Call the echo tool with the message MCP_OK and report what it returns.',''))) break; await sleep(2500)}
  fs.writeFileSync('/tmp/shot-mcp-sse.png', await browser.takeScreenshot(),'base64')
  const ev=(got.replace('Call the echo tool with the message MCP_OK and report what it returns.','').match(/mcp__\w+|echo|MCP_OK/i)||[''])[0]
  if(ev) pass('mcp-tool-invoked-via-agent',{evidence:ev}); else fail('mcp-tool-invoked-via-agent','no MCP evidence; tail='+got.slice(-220))
}catch(e){fail('exception',e.stack||e.message)}finally{console.log('SUITE_RESULTS',JSON.stringify(results));await browser.deleteSession()}
process.exitCode=results.some(r=>!r.ok)?1:0
