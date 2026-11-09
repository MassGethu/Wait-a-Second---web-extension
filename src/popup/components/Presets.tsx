import {useState} from 'react';
import type {AppState,FocusPreset} from '../../shared/types';
import type {Request} from '../../shared/messages';
interface Props {state:AppState;busy:boolean;act:(request:Request)=>Promise<boolean>}
export function Presets({state,busy,act}:Props){
 const [draft,setDraft]=useState<FocusPreset>();
 const fresh=()=>setDraft({id:crypto.randomUUID(),name:'',goal:'',durationMinutes:25,mode:'LIGHT'});
 return <section className="manager"><h1>Focus presets</h1><p className="manager-note">Save your intention. Start again with one click.</p>
 {state.presets.map(p=><article className="saved-card" key={p.id}><h2>{p.name}</h2><p>{p.goal}</p><small>{p.durationMinutes} min · {p.mode==='LIGHT'?'Light':'Strict'}</small><div className="row-actions"><button className="primary" disabled={busy||!!state.activeSession} onClick={()=>void act({type:'START_PRESET',id:p.id})}>Start</button><button disabled={busy} onClick={()=>setDraft({...p})}>Edit</button><button disabled={busy} onClick={()=>{void act({type:'DELETE_PRESET',id:p.id});if(draft?.id===p.id)setDraft(undefined);}}>Delete</button></div></article>)}
 {!state.presets.length&&<p>No presets yet. Create one below.</p>}
 <p className="manager-note">Deleting a preset also removes its schedules. A running session keeps its original goal and duration.</p>
 {!draft?<button className="primary wide" onClick={fresh}>New preset</button>:<form className="editor" onSubmit={e=>{e.preventDefault();void act({type:'SAVE_PRESET',preset:draft}).then(ok=>{if(ok)setDraft(undefined);});}}>
 <label>Name<input value={draft.name} maxLength={60} required onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <label>Focus goal<input value={draft.goal} maxLength={120} required onChange={e=>setDraft({...draft,goal:e.target.value})}/></label>
 <label>Duration (minutes)<input type="number" min={1} max={480} required value={draft.durationMinutes} onChange={e=>setDraft({...draft,durationMinutes:Number(e.target.value)})}/></label>
 <label>Mode<select value={draft.mode} onChange={e=>setDraft({...draft,mode:e.target.value as FocusPreset['mode']})}><option value="LIGHT">Light</option><option value="STRICT">Strict</option></select></label>
 <div className="row-actions"><button className="primary" disabled={busy}>Save preset</button><button type="button" onClick={()=>setDraft(undefined)}>Cancel</button></div></form>}
 </section>;
}
