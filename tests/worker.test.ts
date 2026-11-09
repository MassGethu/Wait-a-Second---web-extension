import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import type {Request,Response} from '../src/shared/messages.ts';
import type {AppState} from '../src/shared/types.ts';
import {STATE_KEY,DM_DWELL_THRESHOLD_MS} from '../src/shared/constants.ts';
import {shortVideoStats} from '../src/storage/statisticsRepository.ts';

test('worker integration: sessions, interventions, messaging and foreground viewer tracking',async()=>{
 let messageListener!:(request:Request,sender:chrome.runtime.MessageSender,respond:(value:Response)=>void)=>boolean;
 let onStartup!:()=>void;
 let onActivated!:(info:{tabId:number;windowId:number})=>void;
 let onUpdated!:(tabId:number,change:{status:string})=>void;
 let onFocusChanged!:(windowId:number)=>void;
 let activeTab=1;
 let focusedWindow=1;
 let documentReachable=true;
 let data:Record<string,unknown>={};
 const browserSession:Record<string,unknown>={};
 const alarms=new Map<string,chrome.alarms.Alarm>();
 const navigation:{id:number;url?:string}[]=[];
 let now=+new Date(2026,9,5,8);
 const originalNow=Date.now;Date.now=()=>now;
 const originalChrome=globalThis.chrome;
 const noListener={addListener:()=>{}};
 // Small API mock: actual worker code, including its message queue, runs below.
 const mock={storage:{local:{get:async()=>structuredClone(data),set:async(value:Record<string,unknown>)=>{data=structuredClone(value);}},
 session:{get:async()=>({...browserSession}),set:async(value:Record<string,unknown>)=>Object.assign(browserSession,value)}},
 action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
 alarms:{getAll:async()=>[...alarms.values()],clear:async(name:string)=>alarms.delete(name),create:async(name:string,value:chrome.alarms.AlarmCreateInfo)=>{alarms.set(name,{name,scheduledTime:value.when??now+60000,periodInMinutes:value.periodInMinutes});},onAlarm:noListener},
 runtime:{getURL:(path:string)=>`chrome-extension://test/${path}`,onMessage:{addListener:(fn:typeof messageListener)=>{messageListener=fn;}},onStartup:{addListener:(fn:()=>void)=>{onStartup=fn;}},onInstalled:noListener},
 tabs:{update:async(id:number,options:{url?:string})=>{navigation.push({id,...options});},
 get:async(id:number)=>({id,windowId:1,active:id===activeTab}),
 sendMessage:async(id:number)=>documentReachable?`document-${id}`:new Promise(()=>{}),
 onActivated:{addListener:(fn:typeof onActivated)=>{onActivated=fn;}},
 onUpdated:{addListener:(fn:typeof onUpdated)=>{onUpdated=fn;}},onReplaced:noListener,onRemoved:noListener},
 windows:{get:async(id:number)=>({focused:id===focusedWindow,state:'normal'}),
 onFocusChanged:{addListener:(fn:typeof onFocusChanged)=>{onFocusChanged=fn;}}}};
 globalThis.chrome=mock as unknown as typeof chrome;
 const popup={url:'chrome-extension://test/popup.html'};
 const tab=(id:number,url='https://www.instagram.com/direct/inbox/'):chrome.runtime.MessageSender=>({url,tab:{id} as chrome.tabs.Tab});
 const call=(request:Request,sender:chrome.runtime.MessageSender=popup)=>new Promise<Response>(resolve=>messageListener(request,sender,resolve));
 const get=()=>data[STATE_KEY] as AppState;
 try{
  const bundle=await build({entryPoints:['src/background/serviceWorker.ts'],bundle:true,write:false,format:'esm',platform:'browser'});
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  assert((await call({type:'GET_STATE'})).ok);assert.equal(get().schemaVersion,3);assert.equal(get().presets.length,2);assert(alarms.has('schedule-tick'));
  assert.equal((await call({type:'START_PRESET',id:'default-dbms'},tab(7))).ok,false);
  assert((await call({type:'SAVE_SCHEDULE',schedule:{id:'schedule',presetId:'default-dbms',days:[1],time:'09:00',enabled:true,createdAt:0,lastHandledAt:0}})).ok);
  assert.equal(new Date(alarms.get('schedule:schedule')!.scheduledTime).getHours(),9);
  now+=70*60000;onStartup();await call({type:'GET_STATE'});
  assert.equal(get().activeSession?.plannedDurationMinutes,15);assert.equal(get().scheduleLogs[0].outcome,'started_late');
  onStartup();await call({type:'GET_STATE'});assert.equal(get().scheduleLogs.length,1);
  await call({type:'END'});await call({type:'DELETE_PRESET',id:'default-dbms'});assert.equal(get().schedules.length,0);assert(!alarms.has('schedule:schedule'));
  await call({type:'START',topic:'Study DBMS',minutes:60,mode:'LIGHT'});
  const context={site:'YOUTUBE' as const,section:'SHORTS' as const,url:'https://www.youtube.com/shorts/example'};
  const yt=tab(1,context.url);let response=await call({type:'INTERVENE',sessionId:get().activeSession!.id,context},yt);const eventId=response.eventId!;
  assert.equal((await call({type:'ACTION',eventId,action:'CONTINUE_RETYPE'},yt)).ok,false);
  assert((await call({type:'ACTION',eventId,action:'RETYPE_STARTED'},yt)).ok);
  assert((await call({type:'ACTION',eventId,action:'CONTINUE_RETYPE'},yt)).ok);
  assert.equal(get().distractionEvents[0].outcome,'continued_after_retype');assert(!('continueReadyAt' in get().distractionEvents[0]));
  const sessionId=get().activeSession!.id;
  const report=(id:number,visible=true,direct=true)=>call({type:'DM_REPORT',sessionId,direct,visible},tab(id));
  await report(7);await report(8);
  for(let elapsed=5000;elapsed<=DM_DWELL_THRESHOLD_MS;elapsed+=5000){now+=5000;response=await report(7);await report(8);}
  assert(response.dmCheckin);const checkin=response.dmCheckin!.eventId;
  assert.equal(get().dmCheckins.length,1);assert.equal((await report(8)).dmCheckin,undefined);
  assert.equal((await call({type:'DM_ACTION',eventId:checkin,action:'WORK'},tab(8))).ok,false);
  await report(7,false);assert.equal((await report(8)).dmCheckin?.eventId,checkin);assert.equal(get().dmCheckins.length,1);
  assert((await call({type:'DM_ACTION',eventId:checkin,action:'WORK'},tab(8))).ok);assert.equal(get().dmCheckins[0].outcome,'work_confirmed');assert.equal((await report(8)).dmCheckin,undefined);
  const dwell=get().dmDwell!.accumulatedMs;await call({type:'PAUSE'});now+=120000;await report(8);await call({type:'RESUME'});assert.equal(get().dmDwell!.accumulatedMs,dwell);
  await call({type:'END'});await call({type:'START',topic:'Study DBMS',minutes:60,mode:'STRICT'});
  response=await call({type:'INTERVENE',sessionId:get().activeSession!.id,context},yt);const strictId=response.eventId!;
  assert.equal((await call({type:'ACTION',eventId:strictId,action:'RETYPE_STARTED'},yt)).ok,false);
  await call({type:'ACTION',eventId:strictId,action:'GO_BACK'},yt);assert.equal(navigation.at(-1)?.url,'chrome-extension://test/reset.html');
  const resetSender={url:'chrome-extension://test/reset.html'};
  assert.equal((await call({type:'FINISH_RESET',tabId:1},resetSender)).ok,false);now+=10000;
  assert((await call({type:'FINISH_RESET',tabId:1},resetSender)).ok);assert.equal(get().distractionEvents.at(-1)?.outcome,'RESET_COMPLETED');
  const strictSessionId=get().activeSession!.id;
  await call({type:'DM_REPORT',sessionId:strictSessionId,direct:true,visible:true},tab(7));
  for(let elapsed=5000;elapsed<=DM_DWELL_THRESHOLD_MS;elapsed+=5000){now+=5000;response=await call({type:'DM_REPORT',sessionId:strictSessionId,direct:true,visible:true},tab(7));}
  assert(response.dmCheckin);await call({type:'DM_ACTION',eventId:response.dmCheckin!.eventId,action:'RETURN'},tab(7));
  assert.equal(navigation.at(-1)?.url,'https://www.instagram.com/direct/inbox/');assert.equal(get().dmCheckins.at(-1)?.outcome,'returned');assert.equal(get().dmDwell!.pending,undefined);
  assert.equal(Object.keys(get().resets).length,0);assert.equal(get().distractionEvents.length,2);
  assert(!JSON.stringify(get()).includes('typedSentence'));

  await call({type:'END'});
  const viewer=(id:number,url:string,documentId=`document-${id}`)=>({
   ...tab(id,url),frameId:0,documentId,documentLifecycle:'active' as const
  });
  const shorts=viewer(1,'https://www.youtube.com/shorts/private-clip-id');
  const reels=viewer(2,'https://www.instagram.com/reels/');
  const view=(sender:chrome.runtime.MessageSender,page=0,viewing=true)=>
   call({type:'SHORT_VIDEO_REPORT',page,viewing,documentKey:sender.documentId!},sender);
  await view(shorts);assert.equal(get().shortVideo.visit,null);
  assert.equal((await call({type:'SET_SHORT_VIDEO_TRACKING',enabled:true},shorts)).ok,false);
  await call({type:'SET_SHORT_VIDEO_TRACKING',enabled:true});
  await view(viewer(1,'https://www.youtube.com/watch?v=regular'));
  await view({...shorts,frameId:1});
  await view(reels);assert.equal(get().shortVideo.visit,null,'Unfocused tabs and unsupported views do not count');
  await view(shorts);
  onUpdated(1,{status:'complete'});await call({type:'GET_STATE'});
  assert.equal(get().shortVideo.visit?.documentKey,shorts.documentId,'Same document navigation preserves the visit');
  now+=2000;await view({...shorts,url:'https://www.youtube.com/shorts/next'},1);
  now+=1000;await view(shorts,1);
  await call({type:'START',topic:'Study',minutes:1,mode:'LIGHT'});
  now+=3000;await call({type:'PAUSE'});
  now+=2000;await call({type:'RESUME'});
  now+=2000;await view(shorts,2);
  const totals=()=>shortVideoStats(get(),[now]);
  assert.deepEqual(totals().outside.SHORTS,{viewerMs:5000,episodes:1,transitions:1});
  assert.deepEqual(totals().during.SHORTS,{viewerMs:5000,episodes:0,transitions:1});
  assert.deepEqual(totals().current,totals().during.SHORTS);
  await view({...shorts,documentId:'old-document'},0,false);
  assert.equal(get().shortVideo.visit?.documentKey,shorts.documentId);

  now+=1000;activeTab=2;onActivated({tabId:2,windowId:1});await view(reels);
  assert.equal(get().shortVideo.visit?.platform,'REELS');
  assert.equal(totals().during.SHORTS.viewerMs,6000);
  now+=2000;focusedWindow=-1;onFocusChanged(-1);await view(reels,1);
  assert.equal(get().shortVideo.visit,null);
  assert.deepEqual(totals().during.REELS,{viewerMs:2000,episodes:1,transitions:0});
  focusedWindow=1;await view(reels);
  now+=1000;await call({type:'SET_SHORT_VIDEO_TRACKING',enabled:false});
  await view(reels,1);assert.equal(get().shortVideo.visit,null);
  assert.deepEqual(totals().during.REELS,{viewerMs:3000,episodes:2,transitions:0});
  await call({type:'SET_SHORT_VIDEO_TRACKING',enabled:true});
  await view(reels);
  now+=2500;documentReachable=false;onUpdated(2,{status:'complete'});await call({type:'GET_STATE'});
  assert.equal(get().shortVideo.visit,null);
  assert.deepEqual(totals().during.REELS,{viewerMs:3000,episodes:3,transitions:0});
  assert(!JSON.stringify(get().shortVideo).includes('private-clip-id'));
 }finally{Date.now=originalNow;globalThis.chrome=originalChrome;}
});
