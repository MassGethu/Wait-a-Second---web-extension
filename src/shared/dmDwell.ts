import {DM_DWELL_THRESHOLD_MS,DM_LEASE_MS,DM_LEAVE_RESET_MS,DM_SNOOZE_MS} from './constants.ts';
import type {DmDwell} from './types.ts';
export function newDwell(sessionId:string,now:number):DmDwell {
 return {sessionId,accumulatedMs:0,nextPromptMs:DM_DWELL_THRESHOLD_MS,updatedAt:now,tabs:{}};
}
// Integrate the UNION of visible leases. Concurrent visible windows never double-count.
export function advanceDwell(d:DmDwell,now:number,active:boolean):void {
 const visibleUntil=Math.max(d.updatedAt,...Object.values(d.tabs).filter(t=>t.direct&&t.visible).map(t=>t.seenAt+DM_LEASE_MS));
 if(active&&!d.pending)d.accumulatedMs+=Math.max(0,Math.min(now,visibleUntil)-d.updatedAt);
 d.updatedAt=now;
 const direct=Object.values(d.tabs).some(t=>t.direct);
 if(direct)d.leftAt=undefined;else d.leftAt??=now;
 if(d.leftAt!==undefined&&now-d.leftAt>=DM_LEAVE_RESET_MS){d.accumulatedMs=0;d.nextPromptMs=DM_DWELL_THRESHOLD_MS;d.pending=undefined;}
 const owner=d.pending?.ownerTab;
 if(owner!==undefined){const t=d.tabs[String(owner)];if(!active||!t?.direct||!t.visible||now-t.seenAt>DM_LEASE_MS)d.pending!.ownerTab=undefined;}
}
export function reportDwell(d:DmDwell,tabId:number,direct:boolean,visible:boolean,now:number,active:boolean):void {
 advanceDwell(d,now,active);
 d.tabs[String(tabId)]={direct,visible,seenAt:now};
 advanceDwell(d,now,active);
}
export function dwellDue(d:DmDwell,tabId:number,now:number):boolean {
 const t=d.tabs[String(tabId)];return !!t?.direct&&t.visible&&now-t.seenAt<=DM_LEASE_MS&&d.accumulatedMs>=d.nextPromptMs;
}
export function snoozeDwell(d:DmDwell):void {d.nextPromptMs=d.accumulatedMs+DM_SNOOZE_MS;d.pending=undefined;}
