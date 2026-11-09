import {send} from '../shared/messages';
import {shortVideoRoute, SHORT_VIDEO_HEARTBEAT_MS} from '../shared/shortVideo';
import {SHORT_VIDEO_DOCUMENT_CHECK} from '../shared/constants';

/** Reports presence and a page ordinal. Clip IDs stay in this document's memory. */
export class ShortVideoReporter {
  private readonly documentKey = crypto.randomUUID();
  private enabled = false;
  private pageHidden = false;
  private viewing = false;
  private clip?: string;
  private page = 0;
  private heartbeat?: number;

  constructor(private readonly isObscured: () => boolean) {
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    navigation?.addEventListener('currententrychange', this.refresh);
    window.addEventListener('popstate', this.refresh);
    window.addEventListener('focus', this.refresh);
    window.addEventListener('blur', this.refresh);
    document.addEventListener('visibilitychange', this.refresh);
    document.addEventListener('yt-navigate-finish', this.refresh);
    window.addEventListener('pagehide', () => {
      this.pageHidden = true;
      this.refresh();
    });
    window.addEventListener('pageshow', () => {
      this.pageHidden = false;
      this.refresh();
    });
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
      if (message?.type === SHORT_VIDEO_DOCUMENT_CHECK) respond(this.pageHidden ? null : this.documentKey);
    });
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.refresh();
  }

  refresh = (): void => {
    const route = this.enabled && !this.pageHidden && !document.hidden && document.hasFocus() &&
      !this.isObscured() ? shortVideoRoute(new URL(location.href)) : undefined;
    if (!route) {
      window.clearTimeout(this.heartbeat);
      this.heartbeat = undefined;
      if (this.viewing) this.report(false);
      this.viewing = false;
      this.clip = undefined;
      this.page = 0;
      return;
    }

    const transitioned = this.clip !== undefined && route.clip !== undefined && route.clip !== this.clip;
    if (transitioned) this.page++;
    if (route.clip !== undefined) this.clip = route.clip;
    if (this.viewing && !transitioned && this.heartbeat !== undefined) return;
    this.viewing = true;
    this.report(true);
    window.clearTimeout(this.heartbeat);
    this.heartbeat = window.setTimeout(() => {
      this.heartbeat = undefined;
      this.refresh();
    }, SHORT_VIDEO_HEARTBEAT_MS);
  };

  private report(viewing: boolean): void {
    // A lost report is retried by the next heartbeat. The worker expires stale visits.
    void send({ type: 'SHORT_VIDEO_REPORT', viewing, page: this.page, documentKey: this.documentKey }).catch(() => {});
  }
}
