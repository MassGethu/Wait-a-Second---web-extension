import type {AppState} from '../shared/types.ts';
export function dailyStats(state:AppState,now=Date.now()) {
 const days=Array.from({length:7},(_,i)=>{const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-6+i);const end=new Date(start);end.setDate(end.getDate()+1);return {start:+start,end:+end,label:start.toLocaleDateString(undefined,{weekday:'short'}),minutes:0,attempts:0,redirects:0,youtube:0,instagram:0};});
 for(const s of [...state.sessionHistory,...(state.activeSession?[state.activeSession]:[])]){let budget=s.plannedDurationMinutes*60000;for(const interval of s.intervals){const end=Math.min(interval.end??now,s.completedAt??Infinity,interval.start+budget);for(const day of days)day.minutes+=Math.max(0,Math.min(end,day.end)-Math.max(interval.start,day.start))/60000;budget=Math.max(0,budget-Math.max(0,end-interval.start));}}
 for(const e of state.distractionEvents){const day=days.find(d=>e.timestamp>=d.start&&e.timestamp<d.end);if(!day)continue;day.attempts++;if(e.outcome==='RETURNED_TO_FOCUS'||e.outcome==='RESET_COMPLETED')day.redirects++;if(e.site==='YOUTUBE')day.youtube++;else day.instagram++;}
 return days;
}
