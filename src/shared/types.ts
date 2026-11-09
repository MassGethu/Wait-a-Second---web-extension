import type {ShortVideoState} from './shortVideo.ts';

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
export type InterventionOutcome = 'RETURNED_TO_FOCUS'|'CONTINUED_DISTRACTION'|'RESET_COMPLETED'|'continued_after_retype';
export interface DistractionEvent {id:string;sessionId:string;timestamp:number;site:SupportedSite;section:SiteSection;url:string;title?:string;mode:FocusMode;action?:InterventionAction;outcome?:InterventionOutcome;reason:string;tabId:number;retypeStarted?:boolean}
export interface ResetState {eventId:string;sessionId:string;topic:string;readyAt:number;returnUrl:string;tabId:number}
export interface AppState {schemaVersion:3;presets:FocusPreset[];schedules:FocusSchedule[];scheduleLogs:ScheduleLog[];dmCheckins:DmCheckinEvent[];dmDwell:DmDwell|null;activeSession:FocusSession|null;sessionHistory:FocusSession[];distractionEvents:DistractionEvent[];resets:Record<string,ResetState>;shortVideo:ShortVideoState}

export interface FocusPreset {id:string;name:string;goal:string;durationMinutes:number;mode:FocusMode}
export interface FocusSchedule {id:string;presetId:string;days:number[];time:string;enabled:boolean;createdAt:number;lastHandledAt:number}
export interface ScheduleLog {scheduleId:string;scheduledAt:number;timestamp:number;outcome:'started'|'started_late'|'skipped_busy'|'skipped_expired'|'skipped_missing_preset';presetName:string}
export interface DmCheckinEvent {type:'dm_checkin';id:string;sessionId:string;timestamp:number;minutes:number;outcome?:'work_confirmed'|'returned'}
export interface DmTab {direct:boolean;visible:boolean;seenAt:number}
export interface DmDwell {sessionId:string;accumulatedMs:number;nextPromptMs:number;updatedAt:number;leftAt?:number;tabs:Record<string,DmTab>;pending?:{eventId:string;ownerTab?:number}}
