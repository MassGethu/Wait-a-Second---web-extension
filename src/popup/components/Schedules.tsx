import {useState} from 'react';
import type {AppState,FocusSchedule} from '../../shared/types';
import type {Request} from '../../shared/messages';
import {nextFireTime} from '../../shared/scheduling';
const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const labels={started:'Started',started_late:'Started with remaining time',skipped_busy:'Skipped: a session was already open',skipped_expired:'Skipped: the time window ended',skipped_missing_preset:'Skipped: preset missing'};
export function Schedules({state,busy,act}:{state:AppState;busy:boolean;act:(request:Request)=>Promise<boolean>}){
 const [draft,setDraft]=useState<FocusSchedule>();
 const fresh=()=>setDraft({id:crypto.randomUUID(),presetId:state.presets[0]?.id??'',days:[1,2,3,4,5],time:'09:00',enabled:true,createdAt:Date.now(),lastHandledAt:Date.now()});
 return <section className="manager"><h1>Schedules</h1><p className="notice">Scheduled sessions only run while the browser is open. If Chrome opens late, a session starts with the remaining time only. Active or paused sessions take priority.</p><p className="manager-note">Times use your device’s local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. No start notifications.</p>
 {state.schedules.map(s=>{const p=state.presets.find(p=>p.id===s.presetId);const next=nextFireTime(s,Date.now());return <article className="saved-card" key={s.id}><h2>{p?.name??'Missing preset'}</h2><p>{s.days.map(d=>days[d]).join(', ')} · {s.time}</p><small>{next?`Next: ${new Date(next).toLocaleString()}`:'Disabled'}</small><label className="toggle"><input type="checkbox" checked={s.enabled} disabled={busy} onChange={e=>void act({type:'SAVE_SCHEDULE',schedule:{...s,enabled:e.target.checked}})}/>Enabled</label><div className="row-actions"><button disabled={busy} onClick={()=>setDraft({...s,days:[...s.days]})}>Edit</button><button disabled={busy} onClick={()=>{void act({type:'DELETE_SCHEDULE',id:s.id});if(draft?.id===s.id)setDraft(undefined);}}>Delete</button></div></article>;})}
 {!state.schedules.length&&<p className="manager-note">No recurring sessions yet.</p>}
 {!draft?<button className="primary wide" disabled={!state.presets.length} onClick={fresh}>{state.presets.length?'New schedule':'Create a preset first'}</button>:<form className="editor" onSubmit={e=>{e.preventDefault();void act({type:'SAVE_SCHEDULE',schedule:draft}).then(ok=>{if(ok)setDraft(undefined);});}}>
 <label>Preset<select required value={draft.presetId} onChange={e=>setDraft({...draft,presetId:e.target.value})}>{state.presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <fieldset><legend>Repeat on</legend><div className="day-picker">{days.map((day,index)=><label key={day}><input type="checkbox" checked={draft.days.includes(index)} onChange={e=>setDraft({...draft,days:e.target.checked?[...draft.days,index]:draft.days.filter(d=>d!==index)})}/>{day}</label>)}</div></fieldset>
 <label>Local start time<input type="time" required value={draft.time} onChange={e=>setDraft({...draft,time:e.target.value})}/></label>
 <label className="toggle"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>Enabled</label>
 <div className="row-actions"><button className="primary" disabled={busy||!draft.days.length}>Save schedule</button><button type="button" onClick={()=>setDraft(undefined)}>Cancel</button></div></form>}
 {state.scheduleLogs.length>0&&<div className="schedule-log"><h2>Recent schedule activity</h2>{state.scheduleLogs.slice(-8).reverse().map((log,i)=><p key={`${log.scheduleId}:${log.scheduledAt}:${i}`}><strong>{log.presetName}</strong><br/>{labels[log.outcome]}<br/><small>{new Date(log.scheduledAt).toLocaleString()}</small></p>)}</div>}
 </section>;
}
