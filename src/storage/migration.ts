import type {AppState,FocusSession,FocusPreset,FocusSchedule} from '../shared/types.ts';
import {validSchedule} from '../shared/scheduling.ts';
import {emptyShortVideoState,readShortVideoState} from '../shared/shortVideo.ts';
export function defaultPresets():FocusPreset[]{return [
 {id:'default-dbms',name:'Study DBMS',goal:'Study DBMS',durationMinutes:25,mode:'LIGHT'},
 {id:'default-deep-work',name:'Deep Work',goal:'Deep Work',durationMinutes:60,mode:'STRICT'},
];}
export const emptyState=():AppState=>({schemaVersion:3,activeSession:null,sessionHistory:[],distractionEvents:[],resets:{},presets:defaultPresets(),schedules:[],scheduleLogs:[],dmCheckins:[],dmDwell:null,shortVideo:emptyShortVideoState()});
export function validPreset(p:FocusPreset):boolean{return !!p&&typeof p.id==='string'&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=60&&typeof p.goal==='string'&&p.goal.trim().length>0&&p.goal.length<=120&&Number.isFinite(p.durationMinutes)&&p.durationMinutes>=1&&p.durationMinutes<=480&&['LIGHT','STRICT'].includes(p.mode);}
function session(v:unknown):v is FocusSession {if(!v||typeof v!=='object')return false;const s=v as FocusSession;return typeof s.id==='string'&&typeof s.topic==='string'&&Number.isFinite(s.startTimestamp)&&Number.isFinite(s.accumulatedPausedTime)&&s.accumulatedPausedTime>=0&&Number.isFinite(s.plannedDurationMinutes)&&s.plannedDurationMinutes>0&&['ACTIVE','PAUSED','COMPLETED','CANCELLED'].includes(s.status)&&['LIGHT','STRICT'].includes(s.mode)&&(s.status!=='PAUSED'||Number.isFinite(s.pauseTimestamp))&&Array.isArray(s.intervals)&&s.intervals.every(i=>!!i&&Number.isFinite(i.start)&&(i.end===undefined||Number.isFinite(i.end)));}
export function migrateState(value:unknown):AppState {
 const base=emptyState();if(!value||typeof value!=='object')return base;
 const raw=value as Partial<AppState>;
 // Never silently downgrade a future schema and overwrite its data.
 if(typeof raw.schemaVersion==='number'&&raw.schemaVersion>base.schemaVersion)throw new Error('Storage was created by a newer extension version.');
 return {...base,
 shortVideo:readShortVideoState(raw.shortVideo),
 activeSession:session(raw.activeSession)&&['ACTIVE','PAUSED'].includes(raw.activeSession.status)?raw.activeSession:null,
 sessionHistory:Array.isArray(raw.sessionHistory)?raw.sessionHistory.filter(session):[],
 distractionEvents:Array.isArray(raw.distractionEvents)?raw.distractionEvents.filter(e=>!!e&&typeof e.id==='string'&&Number.isFinite(e.timestamp)&&['YOUTUBE','INSTAGRAM'].includes(e.site)):[],
 resets:raw.resets&&typeof raw.resets==='object'?Object.fromEntries(Object.entries(raw.resets).filter(([,r])=>!!r&&typeof r.eventId==='string'&&Number.isFinite(r.readyAt))):{},
 // Seed once only: deleting both defaults must leave the user's empty list empty.
 presets:Array.isArray(raw.presets)?raw.presets.filter(validPreset):base.presets,
 schedules:Array.isArray(raw.schedules)?raw.schedules.filter((s:FocusSchedule)=>!!s&&validSchedule(s)&&Number.isFinite(s.createdAt)&&Number.isFinite(s.lastHandledAt)):[],
 scheduleLogs:Array.isArray(raw.scheduleLogs)?raw.scheduleLogs.filter(e=>!!e&&Number.isFinite(e.scheduledAt)&&Number.isFinite(e.timestamp)):[],
 dmCheckins:Array.isArray(raw.dmCheckins)?raw.dmCheckins.filter(e=>!!e&&e.type==='dm_checkin'&&typeof e.id==='string'&&Number.isFinite(e.timestamp)):[],
 dmDwell:raw.dmDwell&&typeof raw.dmDwell.sessionId==='string'&&Number.isFinite(raw.dmDwell.accumulatedMs)&&Number.isFinite(raw.dmDwell.nextPromptMs)&&Number.isFinite(raw.dmDwell.updatedAt)&&raw.dmDwell.tabs&&Object.values(raw.dmDwell.tabs).every(t=>t&&typeof t.direct==='boolean'&&typeof t.visible==='boolean'&&Number.isFinite(t.seenAt))?raw.dmDwell:null,
 };
}
