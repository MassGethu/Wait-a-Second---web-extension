import {readState,writeState} from '../storage/storageRepository';
import {remaining} from '../shared/timer';
import {FRICTION_MS,COOLDOWN_MS} from '../shared/constants';
import {ruleBasedClassifier} from '../shared/classifier';
import type {AppState,FocusSession} from '../shared/types';
import type {Request,Response} from '../shared/messages';
function closeInterval(s:FocusSession,now:number){const last=s.intervals.at(-1);if(last&&last.end===undefined)last.end=now;}
function finish(state:AppState,now:number){const s=state.activeSession;if(!s)return;closeInterval(s,now);s.completedAt=s.status==='PAUSED'?s.pauseTimestamp:now;s.status='COMPLETED';state.sessionHistory.push(s);state.activeSession=null;state.resets={};}
async function maintain(state:AppState){const s=state.activeSession;if(s?.status==='ACTIVE'&&remaining(s)===0)finish(state,s.startTimestamp+s.accumulatedPausedTime+s.plannedDurationMinutes*60000);const cutoff=Date.now()-90*86400000;state.sessionHistory=state.sessionHistory.filter(s=>(s.completedAt??0)>cutoff);state.distractionEvents=state.distractionEvents.filter(e=>e.timestamp>cutoff);}
async function persist(state:AppState){await writeState(state);const s=state.activeSession;await chrome.action.setBadgeBackgroundColor({color:'#7566ed'});await chrome.action.setBadgeText({text:s?.status==='ACTIVE'?'ON':s?.status==='PAUSED'?'Ⅱ':''});if(s?.status==='ACTIVE')await chrome.alarms.create('session-end',{when:Date.now()+Math.max(remaining(s),1000)});else await chrome.alarms.clear('session-end');}
function safeReturn(value:string|undefined,topic:string,site:string):string{const fallback=site==='YOUTUBE'?`https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`:'https://www.instagram.com/direct/inbox/';if(!value)return fallback;try{const url=new URL(value);if(url.protocol!=='https:')return fallback;if(site==='YOUTUBE'&&['www.youtube.com','youtube.com'].includes(url.hostname)&&url.pathname==='/results')return url.href;if(site==='INSTAGRAM'&&['www.instagram.com','instagram.com'].includes(url.hostname)&&url.pathname.startsWith('/direct/'))return url.href;}catch{}return fallback;}
async function handle(req:Request,sender:chrome.runtime.MessageSender):Promise<Response>{
 const state=await readState();const before=JSON.stringify(state);await maintain(state);const now=Date.now();let result:Response={ok:true};const s=state.activeSession;const tabId=sender.tab?.id ?? ((req.type==='GET_RESET'||req.type==='FINISH_RESET')&&sender.url?.startsWith(chrome.runtime.getURL('reset.html'))?req.tabId:undefined);
 const trustedPage=sender.url?.startsWith(chrome.runtime.getURL(''))===true;
 if(['START','PAUSE','RESUME','END'].includes(req.type)&&!trustedPage)throw new Error('Open the extension popup to manage your session.');
 switch(req.type){
 case 'GET_STATE':break;
 case 'START':{
 if(s)throw new Error('End your current session first.');
 if(typeof req.topic!=='string'||!req.topic.trim()||req.topic.length>120||!Number.isFinite(req.minutes)||req.minutes<1||req.minutes>480||!['LIGHT','STRICT'].includes(req.mode))throw new Error('Enter a goal and a duration from 1 to 480 minutes.');
 state.activeSession={id:crypto.randomUUID(),topic:req.topic.trim(),plannedDurationMinutes:req.minutes,startTimestamp:now,accumulatedPausedTime:0,status:'ACTIVE',mode:req.mode,createdAt:now,intervals:[{start:now}]};break;
 }
 case 'PAUSE':if(s?.status==='ACTIVE'){closeInterval(s,now);s.status='PAUSED';s.pauseTimestamp=now;state.resets={};}break;
 case 'RESUME':if(s?.status==='PAUSED'){s.accumulatedPausedTime+=now-(s.pauseTimestamp??now);s.pauseTimestamp=undefined;s.status='ACTIVE';s.intervals.push({start:now});}break;
 case 'END':finish(state,now);break;
 case 'INTERVENE':{
 if(!s||s.status!=='ACTIVE'||s.id!==req.sessionId||tabId===undefined)throw new Error('Session is no longer active.');
 const c=req.context;const source=new URL(sender.url??'');if(!['youtube.com','www.youtube.com','instagram.com','www.instagram.com'].includes(source.hostname)||new URL(c.url).origin!==source.origin)throw new Error('Unsupported page.');
 const classification=ruleBasedClassifier.classify(c,s.topic);if(classification.classification!=='DISTRACTING')throw new Error('Context no longer needs intervention.');
 const prior=state.distractionEvents.findLast(e=>e.sessionId===s.id&&e.tabId===tabId);
 if(prior&&now-prior.timestamp<COOLDOWN_MS)throw new Error('Intervention cooldown.');
 const id=crypto.randomUUID();
 // Store only the useful video identifier or high-level Instagram section, never DM identifiers or query text.
 const url=c.site==='YOUTUBE'?`https://www.youtube.com/${c.section==='WATCH'?`watch?v=${encodeURIComponent(c.videoId??'')}`:c.section.toLowerCase()}`:`https://www.instagram.com/${c.section.toLowerCase()}/`;
 state.distractionEvents.push({id,sessionId:s.id,timestamp:now,site:c.site,section:c.section,url,title:c.site==='YOUTUBE'?c.title?.slice(0,240):undefined,mode:s.mode,reason:classification.reason,tabId});result.eventId=id;break;
 }
 case 'ACTION':{
 const e=state.distractionEvents.find(e=>e.id===req.eventId&&e.tabId===tabId);
 if(!s||s.status!=='ACTIVE'||!e||e.sessionId!==s.id||e.outcome)throw new Error('This intervention is no longer active.');
 if(req.action==='CONTINUE_ANYWAY'){if(s.mode!=='LIGHT')throw new Error('Strict mode has no bypass.');e.action='CONTINUE_ANYWAY';e.continueReadyAt??=now+FRICTION_MS;result.readyAt=e.continueReadyAt;}
 else if(req.action==='CONTINUE'){if(s.mode!=='LIGHT'||!e.continueReadyAt||now<e.continueReadyAt)throw new Error('Take the full 10 seconds first.');e.outcome='CONTINUED_DISTRACTION';}
 else if(req.action==='GO_BACK'){
 e.action='GO_BACK';const returnUrl=safeReturn(req.returnUrl,s.topic,e.site);
 if(s.mode==='STRICT'){
 state.resets[String(tabId)]={eventId:e.id,sessionId:s.id,topic:s.topic,readyAt:now+FRICTION_MS,returnUrl,tabId:tabId!};
 await persist(state);await chrome.tabs.update(tabId!,{url:chrome.runtime.getURL('reset.html')});return result;
 }else{e.outcome='RETURNED_TO_FOCUS';await persist(state);await chrome.tabs.update(tabId!,{url:returnUrl});return result;}
 }break;
 }
 case 'GET_RESET':case 'FINISH_RESET':{
 if(!trustedPage)throw new Error('Unsupported reset request.');const r=state.resets[String(tabId)];
 if(req.type==='GET_RESET')result.reset=r;
 else if(r){if(now<r.readyAt)throw new Error('Reset is still in progress.');const e=state.distractionEvents.find(e=>e.id===r.eventId);if(e&&s?.id===r.sessionId&&s.status==='ACTIVE')e.outcome='RESET_COMPLETED';delete state.resets[String(tabId)];await persist(state);await chrome.tabs.update(tabId!,{url:r.returnUrl});return result;}break;
 }
 default:throw new Error('Unknown extension request.');
 }
 if(!['GET_STATE','GET_RESET'].includes(req.type)||JSON.stringify(state)!==before)await persist(state);result.state=state;return result;
}
// A single writer serializes messages from every tab and popup to avoid lost updates.
let queue:Promise<unknown>=Promise.resolve();
chrome.runtime.onMessage.addListener((request:Request,sender,respond)=>{queue=queue.then(()=>handle(request,sender)).then(respond).catch((error:unknown)=>respond({ok:false,error:error instanceof Error?error.message:'Could not update local state.'}));return true;});
function reconcile(){queue=queue.then(async()=>{const state=await readState();await maintain(state);await persist(state);}).catch(()=>{});}
chrome.alarms.onAlarm.addListener(reconcile);chrome.runtime.onStartup.addListener(reconcile);chrome.runtime.onInstalled.addListener(reconcile);
chrome.tabs.onRemoved.addListener(tabId=>{queue=queue.then(async()=>{const state=await readState();delete state.resets[String(tabId)];await writeState(state);}).catch(()=>{});});
