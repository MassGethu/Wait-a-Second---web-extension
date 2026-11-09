import {startSession,closeInterval,finish,maintain} from './sessionState';
import {runSchedules,syncScheduleAlarms} from './scheduler';
import {validPreset} from '../storage/migration';
import {validSchedule} from '../shared/scheduling';
import {advanceDwell,reportDwell,newDwell,dwellDue,snoozeDwell} from '../shared/dmDwell';
import {readState,writeState} from '../storage/storageRepository';
import {remaining} from '../shared/timer';
import {FRICTION_MS,COOLDOWN_MS} from '../shared/constants';
import {ruleBasedClassifier} from '../shared/classifier';
import {stopViewer} from '../shared/shortVideo';
import type {ViewerVisit} from '../shared/shortVideo';
import {isCurrentViewerDocument,maintainViewer,receiveViewerReport} from './viewerMonitoring';
import type {AppState} from '../shared/types';
import type {Request,Response} from '../shared/messages';
async function persist(state:AppState){await writeState(state);const s=state.activeSession;await chrome.action.setBadgeBackgroundColor({color:'#7566ed'});await chrome.action.setBadgeText({text:s?.status==='ACTIVE'?'ON':s?.status==='PAUSED'?'Ⅱ':''});if(s?.status==='ACTIVE')await chrome.alarms.create('session-end',{when:Date.now()+Math.max(remaining(s),1000)});else await chrome.alarms.clear('session-end');}
function safeReturn(value:string|undefined,topic:string,site:string):string{const fallback=site==='YOUTUBE'?`https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`:'https://www.instagram.com/direct/inbox/';if(!value)return fallback;try{const url=new URL(value);if(url.protocol!=='https:')return fallback;if(site==='YOUTUBE'&&['www.youtube.com','youtube.com'].includes(url.hostname)&&url.pathname==='/results')return url.href;if(site==='INSTAGRAM'&&['www.instagram.com','instagram.com'].includes(url.hostname)&&url.pathname.startsWith('/direct/'))return url.href;}catch{}return fallback;}
async function handle(req:Request,sender:chrome.runtime.MessageSender):Promise<Response>{
 const state=await readState();const before=['GET_STATE','GET_RESET'].includes(req.type)?JSON.stringify(state):undefined;const now=Date.now();
 const previousSession=state.activeSession;const viewerChanged=await maintainViewer(state,now);
 maintain(state,now);let result:Response={ok:true};const s=state.activeSession;const tabId=sender.tab?.id ?? ((req.type==='GET_RESET'||req.type==='FINISH_RESET')&&sender.url?.startsWith(chrome.runtime.getURL('reset.html'))?req.tabId:undefined);
 const trustedPage=sender.url?.startsWith(chrome.runtime.getURL(''))===true;
 if(['START','PAUSE','RESUME','END','SAVE_PRESET','DELETE_PRESET','START_PRESET','SAVE_SCHEDULE','DELETE_SCHEDULE','SET_SHORT_VIDEO_TRACKING'].includes(req.type)&&!trustedPage)throw new Error('Open the extension popup to manage your settings.');
 switch(req.type){
 case 'GET_STATE':break;
 case 'SET_SHORT_VIDEO_TRACKING':{
 if(typeof req.enabled!=='boolean')throw new Error('Invalid tracking setting.');
 if(!req.enabled)stopViewer(state,now);
 state.shortVideo.enabled=req.enabled;break;
 }
 case 'SHORT_VIDEO_REPORT':{
 const recorded=await receiveViewerReport(state,now,req,sender);
 if(previousSession!==state.activeSession)await persist(state);
 else if(recorded||viewerChanged)await writeState(state);
 return result;
 }
 case 'START':{
 if(s)throw new Error('End your current session first.');
 if(typeof req.topic!=='string'||!req.topic.trim()||req.topic.length>120||!Number.isFinite(req.minutes)||req.minutes<1||req.minutes>480||!['LIGHT','STRICT'].includes(req.mode))throw new Error('Enter a goal and a duration from 1 to 480 minutes.');
 startSession(state,req.topic,req.minutes,req.mode,now);break;
 }
 case 'PAUSE':if(s?.status==='ACTIVE'){if(state.dmDwell){advanceDwell(state.dmDwell,now,true);for(const t of Object.values(state.dmDwell.tabs))t.visible=false;if(state.dmDwell.pending)state.dmDwell.pending.ownerTab=undefined;}closeInterval(s,now);s.status='PAUSED';s.pauseTimestamp=now;state.resets={};}break;
 case 'RESUME':if(s?.status==='PAUSED'){if(state.dmDwell)advanceDwell(state.dmDwell,now,false);s.accumulatedPausedTime+=now-(s.pauseTimestamp??now);s.pauseTimestamp=undefined;s.status='ACTIVE';s.intervals.push({start:now});}break;
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
 if(req.action==='RETYPE_STARTED'){if(s.mode!=='LIGHT')throw new Error('Strict mode has no bypass.');e.action='CONTINUE_ANYWAY';e.retypeStarted=true;}
 else if(req.action==='CONTINUE_RETYPE'){if(s.mode!=='LIGHT'||!e.retypeStarted)throw new Error('Complete the retyping step first.');e.outcome='continued_after_retype';}
 else if(req.action==='GO_BACK'){
 e.action='GO_BACK';const returnUrl=safeReturn(req.returnUrl,s.topic,e.site);
 if(s.mode==='STRICT'){
 state.resets[String(tabId)]={eventId:e.id,sessionId:s.id,topic:s.topic,readyAt:now+FRICTION_MS,returnUrl,tabId:tabId!};
 await persist(state);await chrome.tabs.update(tabId!,{url:chrome.runtime.getURL('reset.html')});return result;
 }else{e.outcome='RETURNED_TO_FOCUS';await persist(state);await chrome.tabs.update(tabId!,{url:returnUrl});return result;}
 }else throw new Error('Reload the page to use the current intervention flow.');break;
 }
 case 'SAVE_PRESET':{
 if(!validPreset(req.preset))throw new Error('Use a name, goal, mode and duration from 1 to 480 minutes.');
 const p=req.preset;const clean={id:p.id||crypto.randomUUID(),name:p.name.trim(),goal:p.goal.trim(),durationMinutes:p.durationMinutes,mode:p.mode};
 const index=state.presets.findIndex(p=>p.id===clean.id);if(index<0)state.presets.push(clean);else state.presets[index]=clean;break;
 }
 case 'DELETE_PRESET':state.presets=state.presets.filter(p=>p.id!==req.id);state.schedules=state.schedules.filter(s=>s.presetId!==req.id);break;
 case 'START_PRESET':{const p=state.presets.find(p=>p.id===req.id);if(!p)throw new Error('Preset no longer exists.');startSession(state,p.goal,p.durationMinutes,p.mode,now);break;}
 case 'SAVE_SCHEDULE':{
 const q=req.schedule;if(!validSchedule(q)||!state.presets.some(p=>p.id===q.presetId))throw new Error('Choose a preset, at least one day and a local start time.');
 const clean={id:q.id||crypto.randomUUID(),presetId:q.presetId,days:[...new Set(q.days)].sort(),time:q.time,enabled:q.enabled,createdAt:now,lastHandledAt:now};
 const i=state.schedules.findIndex(s=>s.id===clean.id);if(i<0)state.schedules.push(clean);else state.schedules[i]=clean;break;
 }
 case 'DELETE_SCHEDULE':state.schedules=state.schedules.filter(s=>s.id!==req.id);break;
 case 'DM_REPORT':{
 if(tabId===undefined||!sender.url||!['www.instagram.com','instagram.com'].includes(new URL(sender.url).hostname))throw new Error('Unsupported messaging context.');
 if(!s||req.sessionId!==s.id){result.state=state;break;}
 const d=state.dmDwell?.sessionId===s.id?state.dmDwell:(state.dmDwell=newDwell(s.id,now));
 reportDwell(d,tabId,req.direct,req.visible,now,s.status==='ACTIVE');result.tabId=tabId;
 if(s.status==='ACTIVE'&&dwellDue(d,tabId,now)){
  if(!d.pending){const event={type:'dm_checkin' as const,id:crypto.randomUUID(),sessionId:s.id,timestamp:now,minutes:Math.floor(d.accumulatedMs/60000)};state.dmCheckins.push(event);d.pending={eventId:event.id};}
  if(d.pending.ownerTab===undefined)d.pending.ownerTab=tabId;
  if(d.pending.ownerTab===tabId){const event=state.dmCheckins.find(e=>e.id===d.pending!.eventId)!;result.dmCheckin={eventId:event.id,minutes:event.minutes};}
 }break;
 }
 case 'DM_ACTION':{
 if(!['WORK','RETURN'].includes(req.action))throw new Error('Unknown check-in action.');
 const d=state.dmDwell;const event=state.dmCheckins.find(e=>e.id===req.eventId);
 if(!s||s.status!=='ACTIVE'||!d||d.sessionId!==s.id||d.pending?.ownerTab!==tabId||d.pending?.eventId!==event?.id||!event||event.outcome)throw new Error('This check-in is no longer active.');
 if(req.action==='RETURN')await chrome.tabs.update(tabId!,{url:safeReturn(undefined,s.topic,'INSTAGRAM')});
 event.outcome=req.action==='WORK'?'work_confirmed':'returned';snoozeDwell(d);if(req.action==='RETURN')d.nextPromptMs=Number.MAX_SAFE_INTEGER;break;
 }
 case 'GET_RESET':case 'FINISH_RESET':{
 if(!trustedPage)throw new Error('Unsupported reset request.');const r=state.resets[String(tabId)];
 if(req.type==='GET_RESET')result.reset=r;
 else if(r){if(now<r.readyAt)throw new Error('Reset is still in progress.');const e=state.distractionEvents.find(e=>e.id===r.eventId);if(e&&s?.id===r.sessionId&&s.status==='ACTIVE')e.outcome='RESET_COMPLETED';delete state.resets[String(tabId)];await persist(state);await chrome.tabs.update(tabId!,{url:r.returnUrl});return result;}break;
 }
 default:throw new Error('Unknown extension request.');
 }
 if(!['GET_STATE','GET_RESET'].includes(req.type)||JSON.stringify(state)!==before)await persist(state);
 if(['SAVE_PRESET','DELETE_PRESET','SAVE_SCHEDULE','DELETE_SCHEDULE'].includes(req.type))await syncScheduleAlarms(state);
 result.state=state;return result;
}
// A single writer serializes messages from every tab and popup to avoid lost updates.
let queue:Promise<unknown>=Promise.resolve();
chrome.runtime.onMessage.addListener((request:Request,sender,respond)=>{queue=queue.then(()=>handle(request,sender)).then(respond).catch((error:unknown)=>respond({ok:false,error:error instanceof Error?error.message:'Could not update local state.'}));return true;});
function reconcile(startup=false){queue=queue.then(async()=>{
 const state=await readState();const now=Date.now();await maintainViewer(state,now);maintain(state,now);
 if(startup&&state.dmDwell){state.dmDwell.tabs={};state.dmDwell.updatedAt=now;state.dmDwell.leftAt=now;if(state.dmDwell.pending)state.dmDwell.pending.ownerTab=undefined;}
 runSchedules(state,now);await persist(state);await syncScheduleAlarms(state,now);
 }).catch(error=>console.warn('[WaitASecond] Could not reconcile local sessions',error instanceof Error?error.message:'Unknown error'));}
chrome.alarms.onAlarm.addListener(()=>reconcile());
chrome.runtime.onStartup.addListener(()=>reconcile(true));chrome.runtime.onInstalled.addListener(()=>reconcile());
function stopViewerWhen(matches:(visit:ViewerVisit)=>boolean|Promise<boolean>, creditTail=true){
 queue=queue.then(async()=>{
  const state=await readState();const visit=state.shortVideo.visit;
  if(!visit||!await matches(visit))return;
  const now=Date.now();const previousSession=state.activeSession;
  await maintainViewer(state,now);maintain(state,now);
  if(creditTail)stopViewer(state,now);else state.shortVideo.visit=null;
  if(previousSession!==state.activeSession)await persist(state);else await writeState(state);
 }).catch(()=>{});
}
chrome.tabs.onActivated.addListener(({tabId,windowId})=>stopViewerWhen(visit=>visit.windowId===windowId&&visit.tabId!==tabId));
chrome.windows.onFocusChanged.addListener(windowId=>stopViewerWhen(visit=>visit.windowId!==windowId));
chrome.tabs.onReplaced.addListener((_newId,oldId)=>stopViewerWhen(visit=>visit.tabId===oldId));
chrome.tabs.onUpdated.addListener((tabId,change)=>{
 if(change.status!=='complete')return;
 // Same-document history changes can also change tab status. Only discard a lost document.
 stopViewerWhen(async visit=>visit.tabId===tabId&&!(await isCurrentViewerDocument(tabId,visit.documentKey)),false);
});
chrome.tabs.onRemoved.addListener(tabId=>{queue=queue.then(async()=>{
 const state=await readState();delete state.resets[String(tabId)];
 const now=Date.now();const previousSession=state.activeSession;
 if(state.shortVideo.visit?.tabId===tabId){await maintainViewer(state,now);maintain(state,now);stopViewer(state,now);}
 if(state.dmDwell){advanceDwell(state.dmDwell,Date.now(),state.activeSession?.status==='ACTIVE');delete state.dmDwell.tabs[String(tabId)];advanceDwell(state.dmDwell,Date.now(),state.activeSession?.status==='ACTIVE');}
 if(previousSession!==state.activeSession)await persist(state);else await writeState(state);
 }).catch(()=>{});});
// Recover alarms and persist migration even when a dormant worker is first woken by a message.
reconcile();
