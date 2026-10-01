import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import {send} from '../shared/messages';
import type {ResetState} from '../shared/types';
import {STATE_KEY} from '../shared/constants';
import './reset.css';
async function resetRequest(type:'GET_RESET'|'FINISH_RESET'){const tab=await chrome.tabs.getCurrent();if(tab?.id===undefined)throw new Error('Open this reset in a browser tab.');return send({type,tabId:tab.id});}
function Reset(){const [reset,setReset]=useState<ResetState>();const [now,setNow]=useState(Date.now());const [loaded,setLoaded]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{let cancelled=false;async function load(){try{const r=(await resetRequest('GET_RESET')).reset;if(!cancelled){setReset(r);setLoaded(true);}}catch(e){if(!cancelled){setError(e instanceof Error?e.message:'Unable to read reset state.');setLoaded(true);}}}void load();const interval=setInterval(()=>setNow(Date.now()),200);const listener=(changes:Record<string,chrome.storage.StorageChange>)=>{if(changes[STATE_KEY])void load();};chrome.storage.onChanged.addListener(listener);return()=>{cancelled=true;clearInterval(interval);chrome.storage.onChanged.removeListener(listener);};},[]);
 const seconds=reset?Math.max(0,Math.ceil((reset.readyAt-now)/1000)):0;
 useEffect(()=>{if(!reset||seconds>0)return;const timer=setTimeout(()=>{void resetRequest('FINISH_RESET').catch(e=>setError(e instanceof Error?e.message:'Please reload to retry.'));},800);return()=>clearTimeout(timer);},[reset?.eventId,seconds]);
 return <main><div className="brand">Ⅱ <span>WAIT A SECOND</span></div><section><div className="eyebrow">A MOMENT TO COME BACK</div><h1>{reset?(seconds?'10 seconds to rebuild your focus.':`Back to ${reset.topic}.`):loaded?'Your focus space.':'One moment…'}</h1>{reset?<><p>You were working on</p><h2>{reset.topic}</h2><div className="count" role="timer" aria-label={`${seconds} seconds remaining`}>{seconds||'✓'}</div><p>Take a moment.<br/>Then get back to it.</p><div className="rail"><div style={{width:`${(10-seconds)*10}%`}}/></div><small>Your focus page will open when the reset is complete.</small></>:loaded&&<p>The session was paused, ended, or this reset is no longer active.<br/>Open Wait a Second from the toolbar to manage your session.</p>}{error&&<p className="error" role="alert">{error}</p>}</section><footer>The problem isn’t screen time. It’s lost intention.</footer></main>;
}
createRoot(document.getElementById('root')!).render(<Reset/>);
