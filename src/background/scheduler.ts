import type {AppState} from '../shared/types.ts';
import {dueOccurrences,missedStartPolicy,nextFireTime} from '../shared/scheduling.ts';
import {SCHEDULE_TICK_MINUTES} from '../shared/constants.ts';
import {startSession} from './sessionState.ts';
export function runSchedules(state:AppState,now:number):void {
 const due=state.schedules.flatMap(schedule=>dueOccurrences(schedule,schedule.lastHandledAt,now).map(at=>({schedule,at}))).sort((a,b)=>a.at-b.at||a.schedule.id.localeCompare(b.schedule.id));
 for(const {schedule,at} of due){
  const preset=state.presets.find(p=>p.id===schedule.presetId);
  // Also catch a session which occupied the slot but expired before a late alarm ran.
  const busy=!!state.activeSession||state.sessionHistory.some(s=>s.startTimestamp<=at&&(s.completedAt??0)>at);
  const policy=preset?missedStartPolicy(at,preset.durationMinutes,now,busy):undefined;
  const outcome=!preset?'skipped_missing_preset':policy==='skip_busy'?'skipped_busy':policy==='skip_expired'?'skipped_expired':now-at>=1000?'started_late':'started';
  if(preset&&policy==='start')startSession(state,preset.goal,(at+preset.durationMinutes*60000-now)/60000,preset.mode,now);
  state.scheduleLogs.push({scheduleId:schedule.id,scheduledAt:at,timestamp:now,outcome,presetName:preset?.name??'Deleted preset'});
 }
 for(const s of state.schedules)s.lastHandledAt=Math.max(s.lastHandledAt,now);
 state.scheduleLogs=state.scheduleLogs.slice(-200);
}
export async function syncScheduleAlarms(state:AppState,now=Date.now()):Promise<void>{
 const desired=new Map<string,number>();
 for(const s of state.schedules){const next=nextFireTime(s,Math.max(now,s.lastHandledAt));if(next!==undefined)desired.set(`schedule:${s.id}`,next);}
 const alarms=await chrome.alarms.getAll();
 for(const alarm of alarms)if(alarm.name.startsWith('schedule:')&&!desired.has(alarm.name))await chrome.alarms.clear(alarm.name);
 for(const [name,when] of desired){const old=alarms.find(a=>a.name===name);if(!old||old.scheduledTime!==when)await chrome.alarms.create(name,{when});}
 if(!alarms.some(a=>a.name==='schedule-tick'))await chrome.alarms.create('schedule-tick',{periodInMinutes:SCHEDULE_TICK_MINUTES});
}
