import { remote } from 'webdriverio'; import fs from 'fs'
const browser = await remote({ logLevel:'error', hostname:'127.0.0.1', port:4444, path:'/', capabilities:{'tauri:options':{application:process.env.APP_BIN}} })
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const body=()=>browser.execute(()=>document.body.innerText)
const kill=()=>browser.execute(()=>document.querySelectorAll('nextjs-portal').forEach(n=>n.remove())).catch(()=>{})
const click=(spec)=>browser.execute((sel,tag,text)=>{document.querySelectorAll('nextjs-portal').forEach(n=>n.remove());let el=sel?document.querySelector(sel):[...document.querySelectorAll(tag)].find(e=>e.textContent.trim()===text)||[...document.querySelectorAll(tag)].find(e=>e.textContent.includes(text));if(el){el.click();return true}return false},spec.sel||null,spec.tag||null,spec.text||null)
async function waitShell(){const t0=Date.now();while(Date.now()-t0<45000){await kill();const t=await body().catch(()=>'');if(t.includes('Agent Command Center')&&t.includes('New Agent'))return;await sleep(500)}throw new Error('no shell')}
async function waitText(s,to=15000){const n=s.toLowerCase();const t0=Date.now();while(Date.now()-t0<to){if((await body()).toLowerCase().includes(n))return true;await sleep(400)}throw new Error('timeout: '+s)}
async function clickUntil(spec,expect,tries=5){for(let i=0;i<tries;i++){await click(spec);await sleep(1200);try{await waitText(expect,4000);return}catch{}}throw new Error('clickUntil failed: '+expect)}
const results=[]; const pass=(n,x)=>{results.push({step:n,ok:true,...x});console.log('PASS:',n,x?JSON.stringify(x):'')}; const fail=(n,e)=>{results.push({step:n,ok:false,error:String(e)});console.log('FAIL:',n,'-',String(e))}
const ROOT='/tmp/agentrepo'
try{
  await waitShell()
  // 1. Add the Ollama provider's model (real local server)
  await clickUntil({sel:'aside button[aria-label="Settings"]'},'Configured Providers')
  await clickUntil({sel:'button[aria-label="Models"]'},'Configured Models')
  await clickUntil({tag:'button',text:'Add Model'},'Select Provider')
  await clickUntil({tag:'button',text:'Ollama (Local)'},'llama3.2:3b',6)
  await click({tag:'button',text:'llama3.2:3b'})
  await waitText('llama3.2:3b',12000)
  pass('add-ollama-model-live')
  await click({sel:'button[aria-label="Close settings"]'}); await sleep(500)

  // 2. Create an LLM agent on the Ollama model, bound to the repo (auto-grants the toolset)
  let nameInput; for(let a=0;a<3;a++){await click({tag:'button',text:'+ New Agent'});await sleep(1000);nameInput=await browser.$('input[placeholder="Agent name"]');if(await nameInput.isExisting())break}
  await nameInput.setValue('OllamaBot')
  const sel=await browser.$('select'); await sel.selectByVisibleText('llama3.2:3b')
  const ws=await browser.$('input[placeholder="/path/to/repo"]'); await ws.setValue(ROOT)
  await click({tag:'button',text:'Create'}); await waitText('OllamaBot',12000)
  pass('create-ollama-workspace-agent')

  // 3. Chat: ask it to list the repo -> the model must call the app's list_directory tool
  await kill()
  await browser.execute(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.textContent.trim()==='OllamaBot'&&e.children.length===0);let n=el;for(let i=0;i<6&&n;i++){n.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));n=n.parentElement}})
  const ta=await browser.$('textarea[placeholder^="Send a message"]'); await ta.waitForExist({timeout:10000})
  await ta.setValue('Use the list_directory tool to list the files in my workspace, then tell me the file names.')
  await browser.keys('Enter')
  // Poll for evidence the tool ran on the real repo (README.md / main.rs / list_directory activity)
  let got=''
  const t0=Date.now()
  while(Date.now()-t0<180000){
    got=await body()
    if(/list_directory/i.test(got) || /README\.md/.test(got) || /main\.rs/.test(got)) break
    await sleep(2500)
  }
  fs.writeFileSync('/tmp/shot-ollama-toolloop.png', await browser.takeScreenshot(),'base64')
  if(/list_directory/i.test(got) || /README\.md/.test(got) || /main\.rs/.test(got))
    pass('llm-tool-loop-invoked-app-tool-on-repo', {evidence: (got.match(/list_directory|README\.md|main\.rs/i)||[''])[0]})
  else fail('llm-tool-loop-invoked-app-tool-on-repo','no tool evidence; tail='+got.slice(-220))
}catch(e){fail('exception',e.stack||e.message)}finally{console.log('SUITE_RESULTS',JSON.stringify(results));await browser.deleteSession()}
process.exitCode=results.some(r=>!r.ok)?1:0
