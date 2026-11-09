import css from './overlay.css?inline';
import type {FocusSession,SiteContext} from '../../shared/types';
import {characterFeedback,normalizeSentence,retypeSentence,sentenceMatches} from '../../shared/retyping';
import {installInputKeyboardGuard} from './keyboardGuard';
export class OverlayController {
 private host?:HTMLDivElement;
 private previous?:HTMLElement;
 private shadow?:ShadowRoot;
 private kind?:'distraction'|'dm';
 constructor(private readonly onVisibilityChange:()=>void=()=>{}){
  // Constructed at document_start, before site shortcut listeners are normally registered.
  installInputKeyboardGuard(()=>({host:this.host,shadow:this.shadow}),reverse=>this.cycleFocus(reverse));
 }
 get visible(){return !!this.host;}
 get isCheckin(){return this.kind==='dm'&&this.visible;}
 destroy(){const wasVisible=this.visible;this.host?.remove();this.host=undefined;this.shadow=undefined;this.kind=undefined;this.previous?.focus();document.removeEventListener('keydown',this.key,true);document.removeEventListener('focusin',this.focus,true);if(wasVisible)this.onVisibilityChange();}
 private controls(){return Array.from(this.shadow?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')??[]);}
 private cycleFocus(reverse:boolean){const list=this.controls();const index=list.indexOf(this.shadow?.activeElement as HTMLElement);list[(index+(reverse?-1:1)+list.length)%list.length]?.focus();}
 private focus=()=>{if(this.host&&document.activeElement!==this.host)this.controls()[0]?.focus();};
 private key=(event:KeyboardEvent)=>{if(!this.host)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();}if(event.key==='Tab'){event.preventDefault();event.stopImmediatePropagation();this.cycleFocus(event.shiftKey);}};
 private q<T extends HTMLElement>(selector:string){return this.shadow!.querySelector<T>(selector)!;}
 private mount(s:FocusSession,context:string,kind:'distraction'|'dm'){
  this.destroy();this.kind=kind;this.previous=document.activeElement as HTMLElement;
  this.host=document.createElement('div');this.host.id='wait-a-second-root';this.shadow=this.host.attachShadow({mode:'closed'});
  this.shadow.innerHTML=`<style>${css}</style><div class="veil"><section class="card" role="dialog" aria-modal="true" aria-labelledby="was-heading"><div class="mark" aria-hidden="true">Ⅱ</div><div class="eyebrow">A MOMENT OF INTENTION</div><h1 id="was-heading">Wait a Second</h1><span class="context"></span><p class="intro"></p><h2></h2><p class="description"></p><div class="retype"></div><div class="actions"></div><p class="error" role="alert"></p><p class="foot">Don’t block the website. Block the distraction.</p></section></div>`;
  this.q('.context').textContent=context;this.q('h2').textContent=s.topic;
  document.documentElement.append(this.host);document.addEventListener('keydown',this.key,true);document.addEventListener('focusin',this.focus,true);
  this.onVisibilityChange();
 }
 private button(label:string,fn:()=>Promise<void>,primary=false){
  const button=document.createElement('button');button.textContent=label;if(primary)button.className='primary';
  button.onclick=()=>{button.disabled=true;void fn().catch(error=>{if(this.shadow){this.q('.error').textContent=error instanceof Error?error.message:'Please try again.';button.disabled=false;}});};
  this.q('.actions').append(button);return button;
 }
 show(s:FocusSession,c:SiteContext,onBack:()=>Promise<void>,onRetype:()=>Promise<void>,onContinue:()=>Promise<void>){
  this.mount(s,`${c.site==='YOUTUBE'?'YouTube':'Instagram'} · ${c.section.toLowerCase().replaceAll('_',' ')}`,'distraction');
  this.q('.intro').textContent=s.mode==='STRICT'?'You chose Strict Focus. You’re working on:':'You’re currently focusing on:';
  this.q('.description').textContent='This content looks unrelated to your goal.';
  const back=this.button('Go Back',onBack,true);
  if(s.mode==='LIGHT'){
   const next=this.button('Continue Anyway',async()=>{
    await onRetype();if(!this.shadow)return;next.remove();
    this.q('.description').textContent='Retype this choice to continue. Your typing stays here and is never saved.';
    const target=retypeSentence(c,s.topic);const box=this.q('.retype');
    const label=document.createElement('label');label.htmlFor='was-retype';label.textContent=target;
    const input=document.createElement('input');input.id='was-retype';input.type='text';input.autocomplete='off';input.spellcheck=false;input.setAttribute('autocorrect','off');input.setAttribute('autocapitalize','off');input.setAttribute('aria-describedby','was-progress');input.maxLength=target.length*3+100;
    const feedback=document.createElement('div');feedback.className='feedback';feedback.setAttribute('aria-hidden','true');
    const status=document.createElement('p');status.id='was-progress';status.setAttribute('role','status');status.className='foot';
    box.append(label,input,feedback,status);
    const proceed=this.button('Continue',async()=>{if(!sentenceMatches(input.value,target))return;await onContinue();});
    const update=()=>{
     const states=characterFeedback(input.value,target);const expected=Array.from(normalizeSentence(target));
     feedback.replaceChildren(...expected.map((char,i)=>{const span=document.createElement('span');span.textContent=char;span.className=states[i];return span;}));
     const match=sentenceMatches(input.value,target);proceed.disabled=!match;
     status.textContent=match?'Sentence matched. You can continue.':`${states.filter(s=>s==='correct').length} of ${expected.length} characters match.${normalizeSentence(input.value).length>normalizeSentence(target).length?' Remove extra characters.':''}`;
    };
    const block=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
    input.addEventListener('paste',block);input.addEventListener('drop',block);
    input.addEventListener('beforeinput',event=>{if(['insertFromPaste','insertFromDrop','insertReplacementText'].includes(event.inputType))block(event);});
    input.addEventListener('input',update);update();input.focus();
   });
  }
  back.focus();
 }
 showCheckin(s:FocusSession,minutes:number,onWork:()=>Promise<void>,onReturn:()=>Promise<void>){
  this.mount(s,'Instagram · Messages','dm');
  this.q('#was-heading').textContent='A quick check-in';
  this.q('.intro').textContent=`You've been in Instagram messages for ${minutes} min. Is this for your focus goal:`;
  this.q('.description').textContent='Only time in visible messaging tabs is counted. Messages are never read.';
  const yes=this.button("Yes, it's for work (+10 min)",onWork,true);this.button('No, take me back',onReturn);yes.focus();
 }
}
