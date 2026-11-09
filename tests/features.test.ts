import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSentence,sentenceMatches,retypeSentence,characterFeedback} from '../src/shared/retyping.ts';
import {newDwell,reportDwell,advanceDwell,dwellDue,snoozeDwell} from '../src/shared/dmDwell.ts';
import {DM_LEAVE_RESET_MS,DM_DWELL_THRESHOLD_MS,DM_SNOOZE_MS} from '../src/shared/constants.ts';
import {nextFireTime,dueOccurrences,missedStartPolicy} from '../src/shared/scheduling.ts';
import {emptyState,migrateState} from '../src/storage/migration.ts';
import {runSchedules} from '../src/background/scheduler.ts';
import {startSession} from '../src/background/sessionState.ts';
import {dailyStats} from '../src/storage/statisticsRepository.ts';
import type {FocusSchedule,FocusSession,SiteContext} from '../src/shared/types.ts';
const schedule=(time='09:00',days=[1]):FocusSchedule=>({id:'s',presetId:'default-dbms',time,days,enabled:true,createdAt:0,lastHandledAt:0});
const session:FocusSession={id:'existing',topic:'DBMS',plannedDurationMinutes:25,startTimestamp:1000,createdAt:1000,accumulatedPausedTime:0,status:'ACTIVE',mode:'LIGHT',intervals:[{start:1000}]};

test('retyping uses real goal, section and normalized matching without dropping punctuation',()=>{
 const c:SiteContext={site:'INSTAGRAM',section:'REELS',url:'https://www.instagram.com/reels/'};
 const target=retypeSentence(c,'Study DBMS');
 assert.equal(target,'I am choosing Instagram Reels over my goal: Study DBMS.');
 assert(sentenceMatches('  I AM choosing Instagram  Reels\n over my goal: Study DBMS.  ',target));
 assert(!sentenceMatches(target.slice(0,-1),target));assert(!sentenceMatches(target+'x',target));
 assert.equal(normalizeSentence('\tA\n  B  '),'a b');
 assert.deepEqual(characterFeedback('Ax','Abc'),['correct','incorrect','pending']);
 for(const [site,section,label] of [['INSTAGRAM','EXPLORE','Instagram Explore'],['INSTAGRAM','FEED','Instagram Feed'],['YOUTUBE','SHORTS','YouTube Shorts'],['YOUTUBE','WATCH','this video']] as const)assert.equal(retypeSentence({...c,site,section},'goal'),`I am choosing ${label} over my goal: goal.`);
});

test('DM dwell counts visible time once across tabs and stops for hidden/paused sessions',()=>{
 const d=newDwell('s',0);reportDwell(d,1,true,true,0,true);
 reportDwell(d,2,true,true,5000,true);assert.equal(d.accumulatedMs,5000);
 reportDwell(d,1,true,false,10000,true);assert.equal(d.accumulatedMs,10000);
 reportDwell(d,2,true,false,12000,true);assert.equal(d.accumulatedMs,12000);
 advanceDwell(d,120000,true);assert.equal(d.accumulatedMs,12000); // Hidden DM is not a departure.
 reportDwell(d,1,true,true,120000,false);advanceDwell(d,125000,false);assert.equal(d.accumulatedMs,12000);
 advanceDwell(d,130000,true);assert.equal(d.accumulatedMs,17000);
});

test('DM visit survives brief exits/chat switches; resets after 30 seconds away',()=>{
 const d=newDwell('s',0);reportDwell(d,1,true,true,0,true);reportDwell(d,1,false,true,5000,true);
 reportDwell(d,1,true,true,5000+DM_LEAVE_RESET_MS-1,true);assert.equal(d.accumulatedMs,5000);
 reportDwell(d,1,true,true,35000,true);assert.equal(d.accumulatedMs,5001);
 reportDwell(d,1,false,true,35000,true);reportDwell(d,1,true,true,65000,true);assert.equal(d.accumulatedMs,0);
});

test('DM threshold, global prompt owner, snooze and stale visibility lease',()=>{
 const d=newDwell('s',0);reportDwell(d,1,true,true,0,true);
 for(let t=5000;t<=DM_DWELL_THRESHOLD_MS;t+=5000)reportDwell(d,1,true,true,t,true);
 assert(dwellDue(d,1,DM_DWELL_THRESHOLD_MS));d.pending={eventId:'event',ownerTab:1};
 reportDwell(d,1,true,true,DM_DWELL_THRESHOLD_MS+5000,true);assert.equal(d.accumulatedMs,DM_DWELL_THRESHOLD_MS);
 reportDwell(d,1,true,false,DM_DWELL_THRESHOLD_MS+6000,true);assert.equal(d.pending.ownerTab,undefined);
 snoozeDwell(d);assert.equal(d.nextPromptMs,DM_DWELL_THRESHOLD_MS+DM_SNOOZE_MS);
 assert(!dwellDue(d,1,DM_DWELL_THRESHOLD_MS+6000));
 const stale=newDwell('s',0);reportDwell(stale,1,true,true,0,true);advanceDwell(stale,3600000,true);assert.equal(stale.accumulatedMs,15000);
});

test('next occurrence wraps weekdays and local DST gaps/folds fire once',()=>{
 const original=process.env.TZ;process.env.TZ='America/New_York';
 try{
  const monday=new Date(2026,9,5,10).getTime();const next=nextFireTime(schedule(),monday)!;
  assert.equal(new Date(next).getDay(),1);assert.equal(new Date(next).getDate(),12);assert.equal(new Date(next).getHours(),9);
  const spring=nextFireTime(schedule('02:30',[0]),+new Date(2026,2,7,12))!;
  assert.equal(new Date(spring).getDate(),8);assert.equal(new Date(spring).getHours(),3);assert.equal(new Date(spring).getMinutes(),30);
  const fall=nextFireTime(schedule('01:30',[0]),+new Date(2026,9,31,12))!;
  assert.equal(new Date(fall).getTimezoneOffset(),240); // First 01:30, daylight time.
  assert.equal(new Date(nextFireTime(schedule('01:30',[0]),fall)!).getDate(),8);
  assert.equal(nextFireTime({...schedule(),enabled:false},monday),undefined);
  assert.equal(dueOccurrences(schedule(),+new Date(2026,9,5,8),+new Date(2026,9,5,9,10)).length,1);
 }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});

test('missed-start policy honors expiry, remaining time, active/paused priority and idempotency',()=>{
 assert.equal(missedStartPolicy(1000,25,2000,false),'start');assert.equal(missedStartPolicy(1000,25,1501000,false),'skip_expired');assert.equal(missedStartPolicy(1000,25,2000,true),'skip_busy');
 const now=+new Date(2026,9,5,9,10);const state=emptyState();state.schedules=[{...schedule('09:00',[1]),createdAt:+new Date(2026,9,5,8),lastHandledAt:+new Date(2026,9,5,8)}];
 runSchedules(state,now);assert.equal(state.activeSession?.plannedDurationMinutes,15);assert.equal(state.scheduleLogs[0].outcome,'started_late');
 runSchedules(state,now+1000);assert.equal(state.scheduleLogs.length,1);
 const occupied=emptyState();occupied.schedules=[{...state.schedules[0],lastHandledAt:state.schedules[0].createdAt}];startSession(occupied,'Existing',60,'STRICT',now-30*60000);occupied.activeSession!.status='PAUSED';occupied.activeSession!.pauseTimestamp=now-60000;
 runSchedules(occupied,now);assert.equal(occupied.activeSession?.topic,'Existing');assert.equal(occupied.scheduleLogs[0].outcome,'skipped_busy');
 const expired=emptyState();expired.schedules=[{...occupied.schedules[0],lastHandledAt:occupied.schedules[0].createdAt}];runSchedules(expired,now+30*60000);assert.equal(expired.activeSession,null);assert.equal(expired.scheduleLogs[0].outcome,'skipped_expired');
 const tie=emptyState();tie.schedules=['b','a'].map(id=>({...state.schedules[0],id,lastHandledAt:state.schedules[0].createdAt}));runSchedules(tie,now);assert.deepEqual(tie.scheduleLogs.map(l=>[l.scheduleId,l.outcome]),[['a','started_late'],['b','skipped_busy']]);
});

test('schema migration preserves old sessions/history/events/reset and seeds defaults just once',()=>{
 const event={id:'e',sessionId:'existing',timestamp:2000,site:'YOUTUBE',section:'WATCH',url:'safe',mode:'LIGHT',reason:'test',tabId:1,outcome:'CONTINUED_DISTRACTION',continueReadyAt:3000};
 const old={activeSession:session,sessionHistory:[{...session,id:'history',status:'COMPLETED',completedAt:2000}],distractionEvents:[event],resets:{'1':{eventId:'e',sessionId:'existing',topic:'DBMS',readyAt:9999,returnUrl:'safe',tabId:1}}};
 const migrated=migrateState(old);assert.equal(migrated.schemaVersion,3);assert.deepEqual(migrated.activeSession,session);assert.deepEqual(migrated.sessionHistory,old.sessionHistory);assert.deepEqual(migrated.distractionEvents,old.distractionEvents);assert.deepEqual(migrated.resets,old.resets);
 assert.equal(migrated.presets.length,2);assert.deepEqual(migrateState(migrated),migrated);
 migrated.presets=[];assert.deepEqual(migrateState(migrated).presets,[]);
 assert.throws(()=>migrateState({schemaVersion:99}));assert.equal(migrateState(null).schemaVersion,3);
});

test('DM check-ins and outcomes never inflate distraction/redirect metrics',()=>{
 const state=emptyState();const now=Date.now();state.dmCheckins=[{id:'dm1',type:'dm_checkin',sessionId:'s',timestamp:now,minutes:10,outcome:'work_confirmed'},{id:'dm2',type:'dm_checkin',sessionId:'s',timestamp:now,minutes:20,outcome:'returned'}];
 state.distractionEvents=[{id:'e',sessionId:'s',timestamp:now,site:'YOUTUBE',section:'WATCH',url:'safe',mode:'LIGHT',reason:'test',tabId:1,outcome:'continued_after_retype'}];
 const day=dailyStats(state,now).at(-1)!;assert.equal(day.attempts,1);assert.equal(day.redirects,0);assert.equal(day.retyped,1);assert.equal(day.dmCheckins,2);assert.equal(day.dmWork,1);assert.equal(day.dmReturned,1);
});
