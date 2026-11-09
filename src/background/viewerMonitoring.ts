import {maintainShortVideo, reportViewer, shortVideoRoute} from '../shared/shortVideo';
import {SHORT_VIDEO_DOCUMENT_CHECK} from '../shared/constants';
import type {Request} from '../shared/messages';
import type {AppState} from '../shared/types';

const RUN_KEY = 'shortVideoBrowserRun';
const DOCUMENT_CHECK_TIMEOUT_MS = 750;
let browserRun: Promise<string> | undefined;

function browserRunId(): Promise<string> {
  // Session storage survives worker suspension and is cleared when Chrome restarts.
  return browserRun ??= (async () => {
    const saved = (await chrome.storage.session.get(RUN_KEY))[RUN_KEY];
    if (typeof saved === 'string') return saved;
    const id = crypto.randomUUID();
    await chrome.storage.session.set({ [RUN_KEY]: id });
    return id;
  })().catch(error => {
    browserRun = undefined;
    throw error;
  });
}

export async function maintainViewer(state: AppState, now: number): Promise<boolean> {
  const runId = state.shortVideo.visit ? await browserRunId() : '';
  return maintainShortVideo(state.shortVideo, now, runId);
}

export async function isCurrentViewerDocument(tabId: number, documentKey: string): Promise<boolean> {
  let timer: number | ReturnType<typeof setTimeout> | undefined;
  try {
    const reply = await Promise.race([
      chrome.tabs.sendMessage(tabId, {type:SHORT_VIDEO_DOCUMENT_CHECK}, {frameId:0}),
      new Promise<undefined>(resolve => {
        timer = setTimeout(resolve, DOCUMENT_CHECK_TIMEOUT_MS);
      })
    ]);
    return reply === documentKey;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function receiveViewerReport(state: AppState, now: number,
    request: Extract<Request, {type:'SHORT_VIDEO_REPORT'}>, sender: chrome.runtime.MessageSender): Promise<boolean> {
  const tabId = sender.tab?.id;
  const {documentKey} = request;
  if (!state.shortVideo.enabled || tabId === undefined || sender.frameId !== 0 || !sender.documentId || !sender.url ||
      typeof documentKey !== 'string' || !documentKey || documentKey.length > 64 ||
      typeof request.viewing !== 'boolean' || !Number.isSafeInteger(request.page) || request.page < 0) return false;

  const url = new URL(sender.url);
  const route = request.viewing && (sender.documentLifecycle === undefined || sender.documentLifecycle === 'active')
    ? shortVideoRoute(url) : undefined;
  let platform = route?.platform;
  let windowId = sender.tab!.windowId;
  if (platform) {
    try {
      const tab = await chrome.tabs.get(tabId);
      windowId = tab.windowId;
      const window = tab.active ? await chrome.windows.get(windowId) : undefined;
      if (!window?.focused || window.state === 'minimized') platform = undefined;
    } catch {
      platform = undefined;
    }
  }
  return reportViewer(state, now, { runId: await browserRunId(), tabId, windowId, documentKey }, platform, request.page);
}
