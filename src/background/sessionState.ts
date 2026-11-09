import type {AppState,FocusMode,FocusSession} from '../shared/types.ts';
import {remaining} from '../shared/timer.ts';
import {newDwell} from '../shared/dmDwell.ts';
export function closeInterval(s:FocusSession,now:number){const last=s.intervals.at(-1);if(last&&last.end===undefined)last.end=now;}
export function startSession(state:AppState,topic:string,minutes:number,mode:FocusMode,now:number){
 if(state.activeSession)throw new Error('End your current session first.');
 if(typeof topic!=='string'||!topic.trim()||topic.length>120||!Number.isFinite(minutes)||minutes<=0||minutes>480||!['LIGHT','STRICT'].includes(mode))throw new Error('Enter a valid goal, duration and mode.');
 state.activeSession={id:crypto.randomUUID(),topic:topic.trim(),plannedDurationMinutes:minutes,startTimestamp:now,accumulatedPausedTime:0,status:'ACTIVE',mode,createdAt:now,intervals:[{start:now}]};
 state.dmDwell=newDwell(state.activeSession.id,now);
}
export function finish(state:AppState,now:number){const s=state.activeSession;if(!s)return;closeInterval(s,now);s.completedAt=s.status==='PAUSED'?s.pauseTimestamp:now;s.status='COMPLETED';state.sessionHistory.push(s);state.activeSession=null;state.resets={};state.dmDwell=null;}
export function maintain(state:AppState,now=Date.now()){
 const s=state.activeSession;if(s?.status==='ACTIVE'&&remaining(s,now)===0)finish(state,s.startTimestamp+s.accumulatedPausedTime+s.plannedDurationMinutes*60000);
 const cutoff=now-90*86400000;state.sessionHistory=state.sessionHistory.filter(s=>(s.completedAt??0)>cutoff);state.distractionEvents=state.distractionEvents.filter(e=>e.timestamp>cutoff);state.dmCheckins=state.dmCheckins.filter(e=>e.timestamp>cutoff);state.scheduleLogs=state.scheduleLogs.filter(e=>e.timestamp>cutoff).slice(-200);
}
