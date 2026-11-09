import {youtubeAdapter} from './youtube/youtubeAdapter';
import {instagramAdapter} from './instagram/instagramAdapter';
import {OverlayController} from './overlay/OverlayController';
import {ShortVideoReporter} from './shortVideoReporter';
import {ruleBasedClassifier} from '../shared/classifier';
import {readState} from '../storage/storageRepository';
import {remaining} from '../shared/timer';
import {send} from '../shared/messages';
import {COOLDOWN_MS,POLL_MS,STATE_KEY,DM_HEARTBEAT_MS} from '../shared/constants';
import type {FocusSession} from '../shared/types';
const instagram=location.hostname.endsWith('instagram.com');
const adapter=instagram?instagramAdapter:youtubeAdapter;
const overlay:OverlayController=new OverlayController(()=>queueMicrotask(shortVideo.refresh));
const shortVideo=new ShortVideoReporter(()=>overlay.visible);
let session:FocusSession|null=null;let interval:number|undefined;let debounce:number|undefined;
let currentUrl='';let bypass='';let lastShown=0;let busy=false;let revision=0;
let dmTabId:number|undefined;let lastReport=0;let reportSignature='';let dmBusy=false;let checkinId:string|undefined;
function schedule(){clearTimeout(debounce);debounce=window.setTimeout(()=>{void evaluate();},200);}
async function reportDM(force=false){
 if(!instagram||!session||dmBusy)return;
 // Route-only detector. Never inspect Instagram DOM or identify individual chats.
 const direct=instagramAdapter.detectContext().section==='DIRECT_MESSAGES';
 const visible=!document.hidden;const signature=`${session.id}:${session.status}:${direct}:${visible}`;
 if(!force&&signature===reportSignature&&Date.now()-lastReport<DM_HEARTBEAT_MS)return;
 dmBusy=true;lastReport=Date.now();reportSignature=signature;const id=session.id;const version=revision;
 try{
  const response=await send({type:'DM_REPORT',sessionId:id,direct,visible});dmTabId=response.tabId;
  if(version!==revision||session?.id!==id||session.status!=='ACTIVE'||document.hidden||instagramAdapter.detectContext().section!=='DIRECT_MESSAGES')return;
  const prompt=response.dmCheckin;
  if(prompt&&!overlay.visible){
   checkinId=prompt.eventId;
   const act=async(action:'WORK'|'RETURN')=>{await send({type:'DM_ACTION',eventId:prompt.eventId,action});overlay.destroy();checkinId=undefined;};
   overlay.showCheckin(session,prompt.minutes,()=>act('WORK'),()=>act('RETURN'));
  }else if(!prompt&&overlay.isCheckin){overlay.destroy();checkinId=undefined;}
 }catch{/* A lost lease/session is harmless; the next visible report can retry. */}
 finally{dmBusy=false;if(session&&`${session.id}:${session.status}:${instagramAdapter.detectContext().section==='DIRECT_MESSAGES'}:${!document.hidden}`!==reportSignature)void reportDM(true);}
}
async function evaluate(){
 if(location.href!==currentUrl){currentUrl=location.href;bypass='';if(!overlay.isCheckin||!instagram||instagramAdapter.detectContext().section!=='DIRECT_MESSAGES'){overlay.destroy();checkinId=undefined;}revision++;}
 await reportDM();
 if(!session||session.status!=='ACTIVE'||remaining(session)===0){overlay.destroy();return;}
 if(busy||overlay.visible||bypass===currentUrl||Date.now()-lastShown<COOLDOWN_MS)return;
 const c=adapter.detectContext();if(ruleBasedClassifier.classify(c,session.topic).classification!=='DISTRACTING')return;
 busy=true;const s=session;const version=revision;const url=currentUrl;
 try{
  const response=await send({type:'INTERVENE',sessionId:s.id,context:c});
  if(version!==revision||session?.id!==s.id||session.status!=='ACTIVE'||url!==location.href)return;
  const eventId=response.eventId!;lastShown=Date.now();document.querySelectorAll('video,audio').forEach(media=>(media as HTMLMediaElement).pause());
  overlay.show(s,c,async()=>{await send({type:'ACTION',eventId,action:'GO_BACK'});},async()=>{await send({type:'ACTION',eventId,action:'RETYPE_STARTED'});},async()=>{await send({type:'ACTION',eventId,action:'CONTINUE_RETYPE'});bypass=url;overlay.destroy();});
 }catch{/* Stale sessions, worker restarts and cooldowns fail open. */}finally{busy=false;}
}
async function sync(){try{
 const state=await readState();const next=state.activeSession;
 const changed=next?.id!==session?.id||next?.status!==session?.status;
 if(changed){revision++;overlay.destroy();checkinId=undefined;bypass='';lastShown=0;reportSignature='';}
 if(overlay.isCheckin&&(checkinId!==state.dmDwell?.pending?.eventId||dmTabId!==state.dmDwell?.pending?.ownerTab)){overlay.destroy();checkinId=undefined;}
 session=next;
 shortVideo.setEnabled(state.shortVideo.enabled);
 if(changed||interval===undefined){clearInterval(interval);interval=undefined;
  if(session?.status==='ACTIVE'){interval=window.setInterval(schedule,POLL_MS);schedule();}
  // Publish pause visibility once without polling or reading page text while paused.
  if(session?.status==='PAUSED'&&changed)void reportDM(true);
 }
 }catch{session=null;shortVideo.setEnabled(false);overlay.destroy();clearInterval(interval);interval=undefined;}}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[STATE_KEY])void sync();});
window.addEventListener('popstate',schedule);document.addEventListener('yt-navigate-finish',schedule);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&overlay.isCheckin){overlay.destroy();checkinId=undefined;}void reportDM(true);if(!document.hidden)schedule();});
window.addEventListener('pagehide',()=>{if(instagram&&session)void send({type:'DM_REPORT',sessionId:session.id,direct:false,visible:false}).catch(()=>{});});
void sync();
