import {youtubeAdapter} from './youtube/youtubeAdapter';
import {instagramAdapter} from './instagram/instagramAdapter';
import {OverlayController} from './overlay/OverlayController';
import {ruleBasedClassifier} from '../shared/classifier';
import {readState} from '../storage/storageRepository';
import {remaining} from '../shared/timer';
import {send} from '../shared/messages';
import {COOLDOWN_MS,POLL_MS,STATE_KEY} from '../shared/constants';
import type {FocusSession} from '../shared/types';
const adapter=location.hostname.endsWith('youtube.com')?youtubeAdapter:instagramAdapter;
const overlay=new OverlayController();let session:FocusSession|null=null;let interval:number|undefined;let debounce:number|undefined;let currentUrl='';let bypass='';let lastShown=0;let busy=false;let revision=0;
function schedule(){clearTimeout(debounce);debounce=window.setTimeout(()=>{void evaluate();},200);}
async function evaluate(){
 if(!session||session.status!=='ACTIVE'||remaining(session)===0){overlay.destroy();return;}
 if(location.href!==currentUrl){currentUrl=location.href;bypass='';overlay.destroy();revision++;}
 if(busy||overlay.visible||bypass===currentUrl||Date.now()-lastShown<COOLDOWN_MS)return;
 const c=adapter.detectContext();if(ruleBasedClassifier.classify(c,session.topic).classification!=='DISTRACTING')return;
 busy=true;const s=session;const version=revision;const url=currentUrl;
 try{const response=await send({type:'INTERVENE',sessionId:s.id,context:c});if(version!==revision||session?.id!==s.id||session.status!=='ACTIVE'||url!==location.href)return;
 const eventId=response.eventId!;lastShown=Date.now();document.querySelectorAll('video,audio').forEach(media=>(media as HTMLMediaElement).pause());
 overlay.show(s,c,async()=>{await send({type:'ACTION',eventId,action:'GO_BACK'});},async()=>{const response=await send({type:'ACTION',eventId,action:'CONTINUE_ANYWAY'});return response.readyAt!;},async()=>{await send({type:'ACTION',eventId,action:'CONTINUE'});bypass=url;overlay.destroy();});
 }catch{/* Stale sessions, worker restarts and cooldowns fail open. */}finally{busy=false;}
}
async function sync(){try{const next=(await readState()).activeSession;if(next?.id!==session?.id||next?.status!==session?.status){revision++;overlay.destroy();bypass='';lastShown=0;}session=next;clearInterval(interval);interval=undefined;if(session?.status==='ACTIVE'){interval=window.setInterval(schedule,POLL_MS);schedule();}}catch{session=null;overlay.destroy();clearInterval(interval);}}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[STATE_KEY])void sync();});
window.addEventListener('popstate',schedule);document.addEventListener('yt-navigate-finish',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session?.status==='ACTIVE')schedule();});
void sync();
