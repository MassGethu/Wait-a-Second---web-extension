import type {FocusSession} from './types.ts';
export function elapsed(s:FocusSession,now=Date.now()):number {
 return Math.min(s.plannedDurationMinutes*60000,Math.max(0,(s.completedAt ?? (s.status==='PAUSED'?s.pauseTimestamp:now) ?? now)-s.startTimestamp-s.accumulatedPausedTime));
}
export function remaining(s:FocusSession,now=Date.now()):number{return Math.max(0,s.plannedDurationMinutes*60000-elapsed(s,now));}
export function clock(ms:number):string {const seconds=Math.ceil(ms/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
