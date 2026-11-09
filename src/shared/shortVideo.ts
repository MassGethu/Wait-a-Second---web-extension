import type {AppState} from './types.ts';

export const SHORT_VIDEO_HEARTBEAT_MS = 5_000;
const LEASE_MS = 15_000;
const RETENTION_DAYS = 90;

export type ShortVideoPlatform = 'REELS' | 'SHORTS';
export interface ViewerTotals { viewerMs: number; episodes: number; transitions: number }
interface ViewerBucket extends ViewerTotals { platform: ShortVideoPlatform; sessionId: string | null }
interface ViewerSource { runId: string; tabId: number; windowId: number; documentKey: string }
export interface ViewerVisit extends ViewerSource { platform: ShortVideoPlatform; page: number; seenAt: number }
export interface ShortVideoState { enabled: boolean; days: Record<string, ViewerBucket[]>; visit: ViewerVisit | null }

export function shortVideoRoute(url: URL): { platform: ShortVideoPlatform; clip?: string } | undefined {
  if (url.protocol !== 'https:') return;
  if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
    const match = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)\/?$/);
    if (match) return { platform: 'SHORTS', clip: match[1] };
  }
  if (url.hostname === 'www.instagram.com' || url.hostname === 'instagram.com') {
    if (/^\/reels\/?$/.test(url.pathname)) return { platform: 'REELS' };
    const match = url.pathname.match(/^\/reels?\/([A-Za-z0-9_-]+)\/?$/);
    if (match && !['audio', 'liked', 'saved', 'friends'].includes(match[1])) {
      return { platform: 'REELS', clip: match[1] };
    }
  }
}

export function emptyShortVideoState(): ShortVideoState {
  return { enabled: false, days: {}, visit: null };
}

export function emptyViewerTotals(): ViewerTotals {
  return { viewerMs: 0, episodes: 0, transitions: 0 };
}

export function addViewerTotals(total: ViewerTotals, delta: ViewerTotals): void {
  total.viewerMs += delta.viewerMs;
  total.episodes += delta.episodes;
  total.transitions += delta.transitions;
}

export function localDay(timestamp: number): string {
  const date = new Date(timestamp);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-');
}

function bucket(state: ShortVideoState, at: number, platform: ShortVideoPlatform, sessionId: string | null): ViewerBucket {
  const day = localDay(at);
  const buckets = state.days[day] ??= [];
  const existing = buckets.find(item => item.platform === platform && item.sessionId === sessionId);
  if (existing) return existing;
  const entry = { platform, sessionId, ...emptyViewerTotals() };
  buckets.push(entry);
  return entry;
}

export function maintainShortVideo(state: ShortVideoState, now: number, runId: string): boolean {
  let changed = false;
  const visit = state.visit;
  if (visit && (!state.enabled || visit.runId !== runId || now < visit.seenAt || now - visit.seenAt > LEASE_MS)) {
    state.visit = null;
    changed = true;
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS + 1);
  const firstDay = localDay(+cutoff);
  for (const day of Object.keys(state.days)) {
    if (day >= firstDay) continue;
    delete state.days[day];
    changed = true;
  }
  return changed;
}

function creditViewerTime(state: AppState, visit: ViewerVisit, now: number): void {
  const from = visit.seenAt;
  if (now <= from || now - from > LEASE_MS) return;

  function addRange(start: number, end: number, sessionId: string | null) {
    while (start < end) {
      const nextDay = new Date(start);
      nextDay.setHours(24, 0, 0, 0);
      const until = Math.min(end, +nextDay);
      bucket(state.shortVideo, start, visit.platform, sessionId).viewerMs += until - start;
      start = until;
    }
  }

  // Existing focus intervals own the boundaries, including pauses, expiry and scheduled starts.
  const sessions = state.sessionHistory.filter(session => (session.completedAt ?? 0) > from);
  if (state.activeSession) sessions.push(state.activeSession);
  const intervals = sessions.flatMap(session => session.intervals.map(interval => ({
    start: Math.max(from, interval.start),
    end: Math.min(now, interval.end ?? now, session.completedAt ?? now),
    sessionId: session.id
  }))).filter(interval => interval.start < interval.end).sort((a, b) => a.start - b.start);

  let cursor = from;
  for (const interval of intervals) {
    addRange(cursor, interval.start, null);
    addRange(Math.max(cursor, interval.start), interval.end, interval.sessionId);
    cursor = Math.max(cursor, interval.end);
  }
  addRange(cursor, now, null);
}

export function stopViewer(state: AppState, now: number): void {
  if (state.shortVideo.visit) creditViewerTime(state, state.shortVideo.visit, now);
  state.shortVideo.visit = null;
}

export function reportViewer(state: AppState, now: number, source: ViewerSource,
                             platform: ShortVideoPlatform | undefined, page: number): boolean {
  const tracking = state.shortVideo;
  if (!tracking.enabled) return false;
  const visit = tracking.visit;
  const sameDocument = visit?.tabId === source.tabId && visit.documentKey === source.documentKey;
  if (!platform) {
    if (!sameDocument) return false;
    stopViewer(state, now);
    return true;
  }
  const sessionId = state.activeSession?.status === 'ACTIVE' ? state.activeSession.id : null;
  if (sameDocument && visit.platform === platform && visit.windowId === source.windowId) {
    creditViewerTime(state, visit, now);
    if (page > visit.page) bucket(tracking, now, platform, sessionId).transitions++;
    visit.page = Math.max(visit.page, page);
    visit.seenAt = now;
  } else {
    // If a new document replaces a visit without a stop signal, keep only confirmed time.
    tracking.visit = { ...source, platform, page, seenAt: now };
    bucket(tracking, now, platform, sessionId).episodes++;
  }
  return true;
}

export function readShortVideoState(value: unknown): ShortVideoState {
  const state = emptyShortVideoState();
  if (!value || typeof value !== 'object') return state;
  const raw = value as Partial<ShortVideoState>;
  state.enabled = raw.enabled === true;
  const isPlatform = (platform: unknown) => platform === 'REELS' || platform === 'SHORTS';
  const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;
  for (const [day, entries] of Object.entries(raw.days ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(entries)) continue;
    const valid = entries.filter(entry => entry && isPlatform(entry.platform) &&
      (entry.sessionId === null || typeof entry.sessionId === 'string') &&
      nonnegative(entry.viewerMs) && nonnegative(entry.episodes) && nonnegative(entry.transitions));
    if (valid.length) state.days[day] = valid;
  }
  const visit = raw.visit;
  if (state.enabled && visit && isPlatform(visit.platform) && typeof visit.runId === 'string' &&
      typeof visit.documentKey === 'string' && Number.isInteger(visit.tabId) && Number.isInteger(visit.windowId) &&
      Number.isSafeInteger(visit.page) && nonnegative(visit.page) && nonnegative(visit.seenAt)) {
    state.visit = visit;
  }
  return state;
}
