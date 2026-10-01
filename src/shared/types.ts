export type FocusMode = 'LIGHT' | 'STRICT';
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type SupportedSite = 'YOUTUBE' | 'INSTAGRAM';
export type SiteSection = 'HOME' | 'WATCH' | 'SHORTS' | 'SEARCH' | 'DIRECT_MESSAGES' | 'REELS' | 'EXPLORE' | 'FEED' | 'PROFILE' | 'UNKNOWN';
export interface SiteContext {site:SupportedSite;section:SiteSection;url:string;title?:string;videoId?:string}
export interface SiteAdapter {detectContext():SiteContext}
export interface ClassificationResult {classification:'ALLOW'|'DISTRACTING'|'UNKNOWN';reason:string}
export interface FocusInterval {start:number;end?:number}
export interface FocusSession {id:string;topic:string;plannedDurationMinutes:number;startTimestamp:number;pauseTimestamp?:number;accumulatedPausedTime:number;status:SessionStatus;mode:FocusMode;createdAt:number;completedAt?:number;intervals:FocusInterval[]}
export type InterventionAction = 'GO_BACK' | 'CONTINUE_ANYWAY';
export type InterventionOutcome = 'RETURNED_TO_FOCUS'|'CONTINUED_DISTRACTION'|'RESET_COMPLETED';
export interface DistractionEvent {id:string;sessionId:string;timestamp:number;site:SupportedSite;section:SiteSection;url:string;title?:string;mode:FocusMode;action?:InterventionAction;outcome?:InterventionOutcome;reason:string;tabId:number;continueReadyAt?:number}
export interface ResetState {eventId:string;sessionId:string;topic:string;readyAt:number;returnUrl:string;tabId:number}
export interface AppState {activeSession:FocusSession|null;sessionHistory:FocusSession[];distractionEvents:DistractionEvent[];resets:Record<string,ResetState>}
