import {STATE_KEY} from '../shared/constants';
import type {AppState,FocusSession,DistractionEvent} from '../shared/types';
export const emptyState=():AppState=>({activeSession:null,sessionHistory:[],distractionEvents:[],resets:{}});
function session(v:unknown):v is FocusSession {if(!v||typeof v!=='object')return false;const s=v as FocusSession;return typeof s.id==='string'&&typeof s.topic==='string'&&Number.isFinite(s.startTimestamp)&&Number.isFinite(s.accumulatedPausedTime)&&s.accumulatedPausedTime>=0&&Number.isFinite(s.plannedDurationMinutes)&&s.plannedDurationMinutes>0&&['ACTIVE','PAUSED','COMPLETED','CANCELLED'].includes(s.status)&&['LIGHT','STRICT'].includes(s.mode)&&(s.status!=='PAUSED'||Number.isFinite(s.pauseTimestamp))&&Array.isArray(s.intervals)&&s.intervals.every(i=>Number.isFinite(i.start)&&(i.end===undefined||Number.isFinite(i.end)));}
export async function readState():Promise<AppState>{
 const raw=(await chrome.storage.local.get(STATE_KEY))[STATE_KEY] as Partial<AppState>|undefined;
 if(!raw||typeof raw!=='object')return emptyState();
 return {activeSession:session(raw.activeSession)&&['ACTIVE','PAUSED'].includes(raw.activeSession.status)?raw.activeSession:null,sessionHistory:Array.isArray(raw.sessionHistory)?raw.sessionHistory.filter(session):[],distractionEvents:Array.isArray(raw.distractionEvents)?raw.distractionEvents.filter((e):e is DistractionEvent=>!!e&&typeof e.id==='string'&&Number.isFinite(e.timestamp)&&['YOUTUBE','INSTAGRAM'].includes(e.site)):[],resets:raw.resets&&typeof raw.resets==='object'?Object.fromEntries(Object.entries(raw.resets).filter(([,r])=>!!r&&typeof r.eventId==='string'&&Number.isFinite(r.readyAt))):{}};
}
export async function writeState(state:AppState):Promise<void>{await chrome.storage.local.set({[STATE_KEY]:state});}
