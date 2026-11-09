import {useEffect,useState} from 'react';
import {send} from '../shared/messages';
import type {Request} from '../shared/messages';
import type {AppState} from '../shared/types';
import {STATE_KEY} from '../shared/constants';
import {SessionSetup} from './components/SessionSetup';
import {ActiveSession} from './components/ActiveSession';
import {Presets} from './components/Presets';
import {Schedules} from './components/Schedules';
import {Statistics} from './components/Statistics';
export function App(){const [state,setState]=useState<AppState>();const [view,setView]=useState<'focus'|'stats'|'presets'|'schedules'>('focus');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function load(){try{setState((await send({type:'GET_STATE'})).state);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not read local storage.');}}
 useEffect(()=>{void load();const listener=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&changes[STATE_KEY])setState(changes[STATE_KEY].newValue as AppState);};chrome.storage.onChanged.addListener(listener);return()=>chrome.storage.onChanged.removeListener(listener);},[]);
 async function act(req:Request){setBusy(true);setError('');try{const response=await send(req);if(response.state)setState(response.state);if(req.type==='START_PRESET')setView('focus');return true;}catch(e){setError(e instanceof Error?e.message:'Please try again.');return false;}finally{setBusy(false);}}
 return <main><header><div className="brand"><span className="brand-mark">Ⅱ</span><div>WAIT A SECOND<small>Protect your intention.</small></div></div><span className="local-badge">LOCAL</span></header><nav aria-label="Main">{(['focus','presets','schedules','stats'] as const).map(tab=><button key={tab} className={view===tab?'active-tab':''} onClick={()=>setView(tab)}>{tab==='stats'?'Statistics':tab.charAt(0).toUpperCase()+tab.slice(1)}</button>)}</nav>{error&&<div className="error" role="alert">{error}{!state&&<button onClick={()=>void load()}>Retry</button>}</div>}{!state?<p className="loading">Opening your focus space…</p>:view==='presets'?<Presets state={state} busy={busy} act={act}/>:view==='schedules'?<Schedules state={state} busy={busy} act={act}/>:view==='stats'?<Statistics state={state} busy={busy} onToggleTracking={enabled=>void act({type:'SET_SHORT_VIDEO_TRACKING',enabled})}/>:state.activeSession?<ActiveSession session={state.activeSession} busy={busy} act={type=>void act({type})}/>:<SessionSetup busy={busy} start={(topic,minutes,mode)=>void act({type:'START',topic,minutes,mode})}/>}<footer><span aria-hidden="true">◇</span> Processed locally on your device.</footer></main>;
}
