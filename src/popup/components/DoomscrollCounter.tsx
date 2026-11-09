import type {ViewerTotals} from '../../shared/shortVideo';
import {addViewerTotals,emptyViewerTotals} from '../../shared/shortVideo';
import type {AppState} from '../../shared/types';
import {shortVideoStats} from '../../storage/statisticsRepository';

function duration(ms: number): string {
  const seconds = Math.floor(ms / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remaining = seconds % 60;
  return hours ? `${hours}h ${minutes}m ${remaining}s` : minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

function ViewerTable({title, reels, shorts}: {title: string; reels: ViewerTotals; shorts: ViewerTotals}) {
  const total = emptyViewerTotals();
  addViewerTotals(total, reels);
  addViewerTotals(total, shorts);
  return <table className="viewer-table">
    <caption>{title}</caption>
    <thead><tr><th scope="col">Viewer</th><th scope="col">Time</th><th scope="col">Episodes</th><th scope="col">Transitions</th></tr></thead>
    <tbody>
      {([['Reels', reels], ['Shorts', shorts], ['Combined', total]] as const).map(([label, value]) =>
        <tr key={label}><th scope="row">{label}</th><td>{duration(value.viewerMs)}</td><td>{value.episodes}</td><td>{value.transitions}</td></tr>
      )}
    </tbody>
  </table>;
}

export function DoomscrollCounter({state, dayStarts, busy, onToggle}: {
  state: AppState; dayStarts: number[]; busy: boolean; onToggle: (enabled: boolean) => void
}) {
  const {during, outside, current} = shortVideoStats(state, dayStarts);
  return <section className="metric doomscroll" aria-labelledby="doomscroll-title">
    <h2 id="doomscroll-title">Doomscroll Counter</h2>
    <label className="doomscroll-toggle">
      <input type="checkbox" checked={state.shortVideo.enabled} disabled={busy}
        onChange={event => onToggle(event.currentTarget.checked)} />
      Track Reels and Shorts
    </label>
    {!state.shortVideo.enabled && <p>Tracking is off. Previously recorded totals stay on this device.</p>}
    <ViewerTable title="During focus" reels={during.REELS} shorts={during.SHORTS} />
    <ViewerTable title="Outside focus" reels={outside.REELS} shorts={outside.SHORTS} />
    {current && <p><b>Current session</b> · {duration(current.viewerMs)} · {current.episodes} {current.episodes === 1 ? 'episode' : 'episodes'}
      {' · '}{current.transitions} detected {current.transitions === 1 ? 'transition' : 'transitions'}</p>}
    <p>Time in the focused viewer tab, including paused videos. An episode starts when a viewer becomes active.
      Transitions count detected clip changes in either direction.</p>
  </section>;
}
