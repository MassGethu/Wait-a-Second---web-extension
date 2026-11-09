// Optional small real-browser fixture. Point PLAYWRIGHT_MODULE to an installed
// playwright entry point; no network or YouTube/Instagram account is used.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({stdin:{contents:"import {OverlayController} from './src/content/overlay/OverlayController.ts'; window.TestOverlay = OverlayController;",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',plugins:[{name:'inline-css',setup(api){api.onResolve({filter:/\.css\?inline$/},args=>({path:resolve(args.resolveDir,args.path.replace('?inline','')),namespace:'inline-css'}));api.onLoad({filter:/.*/,namespace:'inline-css'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));}}]});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1000,height:900}});await page.setContent('<html><body><h1>Host page</h1></body></html>');
 // Test-only access to a CLOSED root; event retargeting remains closed-root behavior.
 await page.evaluate(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const root=original.call(this,options);window.fixtureShadow=root;return root;};});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{
  window.overlay=new window.TestOverlay();window.siteKeys=[];window.continued=0;
  for(const type of ['keydown','keyup','keypress'])for(const target of [window,document])for(const capture of [true,false])target.addEventListener(type,e=>{if(['k','f','m','j','l'].includes(e.key))window.siteKeys.push(`${type}:${capture}`);},capture);
  window.session={topic:'Study DBMS',mode:'LIGHT'};window.context={site:'YOUTUBE',section:'WATCH'};
  window.overlay.show(window.session,window.context,async()=>{},async()=>{},async()=>{window.continued++;window.overlay.destroy();});
  [...window.fixtureShadow.querySelectorAll('button')].find(b=>b.textContent==='Continue Anyway').click();
 });
 await page.waitForFunction(()=>window.fixtureShadow.querySelector('input'));
 await page.keyboard.type('kfmjl');
 assert.deepEqual(await page.evaluate(()=>({keys:window.siteKeys,value:window.fixtureShadow.querySelector('input').value})),{keys:[],value:'kfmjl'});
 assert(await page.evaluate(()=>[...window.fixtureShadow.querySelectorAll('button')].find(b=>b.textContent==='Continue').disabled));
 assert(await page.evaluate(()=>{const e=new Event('paste',{bubbles:true,cancelable:true,composed:true});window.fixtureShadow.querySelector('input').dispatchEvent(e);return e.defaultPrevented;}));
 assert(await page.evaluate(()=>{const e=new Event('drop',{bubbles:true,cancelable:true,composed:true});window.fixtureShadow.querySelector('input').dispatchEvent(e);return e.defaultPrevented;}));
 await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>window.fixtureShadow.activeElement.textContent),'Go Back');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>window.fixtureShadow.activeElement.tagName),'INPUT');
 await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('I AM choosing this video over my goal: Study DBMS.');
 assert.equal(await page.evaluate(()=>[...window.fixtureShadow.querySelectorAll('button')].find(b=>b.textContent==='Continue').disabled),false);
 await page.screenshot({path:'/tmp/wait-a-second-retype.png'});
 await page.evaluate(()=>[...window.fixtureShadow.querySelectorAll('button')].find(b=>b.textContent==='Continue').click());
 await page.waitForFunction(()=>window.continued===1);
 await page.evaluate(()=>window.overlay.show({...window.session,mode:'STRICT'},window.context,async()=>{},async()=>{},async()=>{}));
 assert.deepEqual(await page.evaluate(()=>[...window.fixtureShadow.querySelectorAll('button')].map(b=>b.textContent)),['Go Back']);
 await page.evaluate(()=>window.overlay.showCheckin(window.session,10,async()=>{},async()=>{}));
 assert.deepEqual(await page.evaluate(()=>[...window.fixtureShadow.querySelectorAll('button')].map(b=>b.textContent)),["Yes, it's for work (+10 min)",'No, take me back']);
 const dmPage=await browser.newPage();
 await dmPage.route('https://www.instagram.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body>Private message placeholder — must not be inspected</body></html>'}));
 await dmPage.goto('https://www.instagram.com/direct/inbox/');
 await dmPage.evaluate(()=>{
  window.reports=[];window.changes=[];
  window.saved={schemaVersion:2,activeSession:{id:'s',topic:'DBMS',plannedDurationMinutes:25,startTimestamp:Date.now(),accumulatedPausedTime:0,status:'ACTIVE',mode:'LIGHT',createdAt:Date.now(),intervals:[]},sessionHistory:[],distractionEvents:[],resets:{},presets:[],schedules:[],scheduleLogs:[],dmCheckins:[],dmDwell:null};
  window.changed=()=>window.changes.forEach(listener=>listener({waitASecondState:{newValue:structuredClone(window.saved)}},'local'));
  window.chrome={storage:{local:{get:async()=>({waitASecondState:structuredClone(window.saved)})},onChanged:{addListener:fn=>window.changes.push(fn)}},runtime:{onMessage:{addListener:()=>{}},sendMessage:async request=>{window.reports.push(request);queueMicrotask(window.changed);return {ok:true,tabId:7,state:structuredClone(window.saved)};}}};
  document.querySelector=()=>{throw Error('Messaging DOM inspection forbidden');};
  document.querySelectorAll=()=>{throw Error('Messaging DOM inspection forbidden');};
 });
 await dmPage.addScriptTag({content:await readFile('dist/content.js','utf8')});
 await dmPage.waitForFunction(()=>window.reports.length===1);
 await dmPage.evaluate(()=>{window.saved.activeSession.status='PAUSED';window.saved.activeSession.pauseTimestamp=Date.now();window.changed();});
 await dmPage.waitForFunction(()=>window.reports.length===2);
 await dmPage.evaluate(()=>{window.changed();window.changed();});
 await dmPage.waitForTimeout(350);
 assert.equal(await dmPage.evaluate(()=>window.reports.length),2,'Storage updates must not trigger a paused reporting loop');
 assert(await dmPage.evaluate(()=>window.reports.every(r=>r.type==='DM_REPORT'&&Object.keys(r).every(k=>['type','sessionId','direct','visible'].includes(k)))));
 console.log('Content fixture passed: route-only DM reports and no repeated reporting on paused storage updates.');
 console.log('Overlay fixture passed in Chromium: closed Shadow DOM keydown/keyup/keypress isolation, real typing, match gate, paste/drop prevention, forward/backward focus trap, Strict buttons, DM buttons.');
}finally{await browser.close();}
