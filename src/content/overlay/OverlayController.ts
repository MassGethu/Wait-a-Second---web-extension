import css from './overlay.css?inline';
import type {FocusSession,SiteContext} from '../../shared/types';
export class OverlayController {
 private host?:HTMLDivElement;private timer?:number;private previous?:HTMLElement;private shadow?:ShadowRoot;
 get visible(){return !!this.host;}
 destroy(){if(this.timer)clearInterval(this.timer);this.timer=undefined;this.host?.remove();this.host=undefined;this.shadow=undefined;this.previous?.focus();document.removeEventListener('keydown',this.key,true);document.removeEventListener('focusin',this.focus,true);}
 private focus=()=>{if(this.host&&document.activeElement!==this.host)this.shadow?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();};
 private key=(event:KeyboardEvent)=>{if(!this.host)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();}if(event.key==='Tab'){const buttons=Array.from(this.shadow?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);event.preventDefault();event.stopImmediatePropagation();const index=buttons.indexOf(this.shadow?.activeElement as HTMLButtonElement);buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}};
 show(s:FocusSession,c:SiteContext,onBack:()=>Promise<void>,onWait:()=>Promise<number>,onContinue:()=>Promise<void>){
 this.destroy();this.previous=document.activeElement as HTMLElement;this.host=document.createElement('div');this.host.id='wait-a-second-root';this.shadow=this.host.attachShadow({mode:'closed'});
 this.shadow.innerHTML=`<style>${css}</style><div class="veil"><section class="card" role="dialog" aria-modal="true" aria-labelledby="was-heading"><div class="mark" aria-hidden="true">Ⅱ</div><div class="eyebrow">A MOMENT OF INTENTION</div><h1 id="was-heading">Wait a Second</h1><span class="context"></span><p class="intro"></p><h2></h2><p class="description">This content looks unrelated to your goal.</p><div class="count" hidden></div><div class="actions"><button class="primary back">Go Back</button></div><p class="error" role="alert"></p><p class="foot">Don’t block the website. Block the distraction.</p></section></div>`;
 const q=<T extends HTMLElement>(selector:string)=>this.shadow!.querySelector<T>(selector)!;
 q('.context').textContent=`${c.site==='YOUTUBE'?'YouTube':'Instagram'} · ${c.section.toLowerCase().replaceAll('_',' ')}`;q('.intro').textContent=s.mode==='STRICT'?'You chose Strict Focus. You’re working on:':'You’re currently focusing on:';q('h2').textContent=s.topic;
 const run=async(button:HTMLButtonElement,fn:()=>Promise<void>)=>{button.disabled=true;try{await fn();}catch(e){if(this.shadow){q('.error').textContent=e instanceof Error?e.message:'Please try again.';button.disabled=false;}}};
 const back=q<HTMLButtonElement>('.back');back.onclick=()=>{void run(back,onBack);};
 if(s.mode==='LIGHT'){
 const next=document.createElement('button');next.textContent='Continue Anyway';q('.actions').append(next);let ready=false;
 next.onclick=()=>{void run(next,async()=>{if(ready){await onContinue();return;}const readyAt=await onWait();if(!this.shadow)return;q('.description').textContent='Take 10 seconds. Is this where you want your attention?';const count=q('.count');count.hidden=false;const tick=()=>{if(!this.shadow)return;const seconds=Math.max(0,Math.ceil((readyAt-Date.now())/1000));count.textContent=String(seconds);next.textContent=seconds?'A moment to reconsider…':'Continue';if(!seconds){clearInterval(this.timer);this.timer=undefined;ready=true;next.disabled=false;count.hidden=true;q('.description').textContent='Your choice. Continue, or return to what matters.';}};tick();this.timer=window.setInterval(tick,200);});};
 }
 document.documentElement.append(this.host);document.addEventListener('keydown',this.key,true);document.addEventListener('focusin',this.focus,true);back.focus();
 }
}
