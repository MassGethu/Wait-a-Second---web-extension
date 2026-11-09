/** Closed shadow roots retarget document/window events to the host. Inspect our own
 * shadow.activeElement rather than expecting input in the external composedPath. */
export function isOverlayInputEvent(event:Event,host:HTMLElement|undefined,shadow:ShadowRoot|undefined):boolean {
 return !!host&&!!shadow&&shadow.activeElement?.tagName==='INPUT'&&event.composedPath().includes(host);
}
export function installInputKeyboardGuard(getElements:()=>{host?:HTMLElement;shadow?:ShadowRoot},onTab:(reverse:boolean)=>void):()=>void {
 const handler=(event:KeyboardEvent)=>{
  const {host,shadow}=getElements();if(!isOverlayInputEvent(event,host,shadow))return;
  // Do not prevent ordinary editing defaults. Stopping here protects host capture
  // and bubble handlers, including document-level YouTube shortcut handlers.
  event.stopImmediatePropagation();
  if(event.key==='Tab'&&event.type==='keydown'){event.preventDefault();onTab(event.shiftKey);}
  if(event.key==='Escape')event.preventDefault();
 };
 const types=['keydown','keyup','keypress'] as const;
 for(const type of types)window.addEventListener(type,handler,true);
 return ()=>{for(const type of types)window.removeEventListener(type,handler,true);};
}
