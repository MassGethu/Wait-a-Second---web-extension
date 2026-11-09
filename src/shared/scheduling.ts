import type {FocusSchedule} from './types.ts';
export function validSchedule(value:FocusSchedule):boolean {
 return typeof value.id==='string'&&typeof value.presetId==='string'&&Array.isArray(value.days)&&value.days.length>0&&value.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)&&typeof value.enabled==='boolean';
}
function atLocalDay(schedule:FocusSchedule,day:Date):number {
 const [hours,minutes]=schedule.time.split(':').map(Number);
 // Calendar construction: spring gaps move forward; autumn folds choose first occurrence.
 return +new Date(day.getFullYear(),day.getMonth(),day.getDate(),hours,minutes,0,0);
}
export function nextFireTime(schedule:FocusSchedule,after:number):number|undefined {
 if(!schedule.enabled||!validSchedule(schedule))return undefined;
 for(let offset=0;offset<=8;offset++){
  const day=new Date(after);day.setHours(12,0,0,0);day.setDate(day.getDate()+offset);
  const when=atLocalDay(schedule,day);if(schedule.days.includes(day.getDay())&&when>after)return when;
 }
}
export function dueOccurrences(schedule:FocusSchedule,after:number,now:number):number[]{
 const result:number[]=[];let next=nextFireTime(schedule,Math.max(after,schedule.createdAt));
 // Walk missed calendar occurrences; the worker retains the latest 200 log entries.
 while(next!==undefined&&next<=now){result.push(next);next=nextFireTime(schedule,next);}
 return result;
}
export function missedStartPolicy(scheduledAt:number,minutes:number,now:number,busy:boolean):'start'|'skip_expired'|'skip_busy'{
 if(busy)return 'skip_busy';return scheduledAt+minutes*60_000<=now?'skip_expired':'start';
}
