<<<<<<< HEAD
# Wait-a-Second---web-extension
Web extension of the Wait a Second app
=======
# Wait a Second

**Don’t block the website. Block the distraction.**

A local Chrome extension hackathon prototype that protects your intention on YouTube and Instagram Web. React, TypeScript, Vite, Manifest V3; no backend or cloud AI.

## Problem

A website can help you work and distract you moments later. A DBMS lecture and an unrelated entertainment video should not be treated as the same activity.

## Solution / How it works

Open the toolbar popup, enter a specific focus goal, choose 1–480 minutes and Light or Strict, then start. Content scripts classify only during active sessions. A deterministic, replaceable rule-based classifier produces ALLOW, DISTRACTING or UNKNOWN. Uncertain content is left alone.

## Focus sessions

Start, pause, resume and end from the popup. Timestamp-based timing survives popup closure and service-worker suspension. Chrome alarms finish sessions; requests also reconcile expired sessions. Paused time is excluded, and separate focus intervals support accurate local calendar-day statistics. Ending or pausing removes interventions on open supported tabs. An ON/Ⅱ badge indicates active/paused status.

## Light Mode

An isolated, full-screen overlay offers **Go Back** or **Continue Anyway**. Continue Anyway starts a ten-second wait; only after it finishes does **Continue** unlock. The background validates the deadline. Continuing allows the current URL for the rest of that visit, until a route or session-state change. Videos are paused when an intervention appears; resume playback yourself after continuing.

## Strict Mode

The intervention offers **Go Back** only. It navigates the same tab to an extension-owned reset page, with a ten-second countdown and no skip. Reset state is stored per tab, so page reloads and worker restarts preserve the deadline. Completion records a successful redirect and opens YouTube search for your goal or Instagram DMs. The final “Back to…” message displays briefly before returning. You can still pause/end the whole session in the popup.

Navigation deliberately uses known safe focus destinations instead of guessing at browser history, which may contain another distracting page or an unrelated domain. Tabs are never closed.

## Supported websites / YouTube example

Supported hosts: youtube.com, www.youtube.com, instagram.com, www.instagram.com (HTTPS desktop web).

- YouTube Shorts: distracting during an active session.
- Watch: title keywords and a small academic abbreviation map identify relevant videos. Strong entertainment signals with academic goals trigger an intervention. Uncertain videos remain UNKNOWN.
- Search: allowed. Home and unsupported routes: UNKNOWN.
- Title extraction checks video metadata/title elements and document title; missing titles are safe.

Primary demo: start **Study DBMS**, choose **Light**, then visit [the specified YouTube video](https://www.youtube.com/watch?v=gTKS8SAwUzE&t=157s). The centralized `src/shared/knownDemoVideos.ts` catalog covers MrBeast, AI Coding and Fortnite. All three have an unrelated-academic-goal fallback (including DBMS) even when titles are unavailable. Related goals, such as learning AI coding, fall through to normal classification. Video IDs come from the URL’s `v` parameter, so extra parameters do not affect matching. General title rules handle other videos; this is not an AI model or fake demo interface.

## Instagram behavior

Direct Messages, including switching conversations, are allowed. Reels (both `/reel/` and `/reels/`), Explore and the feed are distracting. Profiles and unknown routes are left alone. No DM text or message identifiers are read or stored.

## Statistics and storage

Today and rolling last-seven-day views show focus time, attempts, successful redirects, daily focus bars and site totals, derived from real sessions/events in `chrome.storage.local`. Light Go Back is a redirect; Strict requires reset completion. Continue is not a redirect. Daily chart tooltips also expose attempts and redirects. Local midnight boundaries handle timezone/DST changes. No sessions means an empty state, not fabricated data.

The storage repository validates core persisted structures. The service worker serializes all writes to prevent multi-tab races. Session history and events are retained for 90 days; active session and per-tab reset records survive restarts. In-progress focus is capped at planned duration. Browser sleep counts as elapsed session time, not proof of attention.

## Architecture / files

- `src/popup/`: React app and setup, active-session, statistics components.
- `src/content/`: light URL polling during sessions, modular YouTube/Instagram adapters, isolated Shadow DOM overlay and focus trap.
- `src/background/serviceWorker.ts`: single storage writer, session lifecycle, alarms/badge, intervention actions and safe tab navigation.
- `src/reset/`: persistent full-screen Strict Mode reset.
- `src/shared/`: typed messages/models, timer, constants, local classifier and topic matcher.
- `src/storage/`: validated storage and calendar-based statistics.
- `src/styles/`: popup visual design.
- `manifest.json`, `vite.config.ts`, `scripts/build.mjs`: extension packaging. Content script is a standalone IIFE with embedded overlay CSS; worker is standalone ESM; popup/reset have packaged local assets.
- `public/icons/`, `scripts/icons.py`: original timer/pause PNG icons and reproducible generator.
- `scripts/check.ts`: small logic sanity check; no large test suite.

## Privacy

No network calls, trackers, analytics SDK, remote fonts, accounts or external services. Inspects supported contexts only while active. Stores focus goals, timestamps, intervention reasons and minimal YouTube title/video identifiers. Instagram events contain high-level sections only. No full-page text, private message content, search queries or cross-site browser history collection. Permissions are only `storage` and `alarms`; content-script matches are restricted to the four supported hosts. Basic tab updates do not require broad `tabs` permission.

## Installation / Build

Requires a current Node.js LTS release (Node 22.12+ recommended).

```sh
npm install
npm run build
```

### How to load the unpacked extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer Mode**.
3. Click **Load unpacked**.
4. Select `/Users/massgethu/Wait a Second_extension/dist`.
5. Pin **Wait a Second** to the toolbar.
6. Reload existing YouTube/Instagram tabs after installing or reloading the extension, then start a session.

### Development

Edit source files, run `npm run build`, then reload the extension and target tabs. `npm run dev` serves UI assets, but the working popup requires Chrome extension APIs; use the unpacked build for functional testing. `npm run check` runs the few essential pure-logic checks (Node 22.18+ or Node 24+). `npm run typecheck` checks TypeScript independently. The build script packages all three entry groups in one production command.

## First manual test

Start **Study DBMS / 25 min / Light**, then open the specified video. Verify the overlay, choose Continue Anyway, wait ten seconds, press Continue and confirm it stays dismissed on that visit. Then end/start Strict and repeat: only Go Back should appear, followed by the reset and topic search. Finally verify Instagram DMs are allowed and Reels interrupt.

## Current limitations

This is heuristic contextual filtering, not semantic AI. It intentionally misses uncertain off-topic videos. YouTube markup/title transitions can change; only desktop layouts are targeted. Route checks run about once a second while active, so interventions are not instantaneous. DOM overlays are not tamper-proof; developer tools, disabling the extension or ending a session can bypass protection. Strict reset persists across reloads, but cannot stop someone manually navigating elsewhere or closing the tab. A reset completes only while its extension page is open. On pause/end, the reset becomes a neutral focus page. Reload existing tabs after extension installation/update. Statistics measure session time, not verified learning or active-window attention. No live-browser integration test is included.

## Future scope

Add site adapters and an optional local model behind the classifier interface, improve title/context confidence, and add explicit user-controlled topic vocabulary. No such future features are presented as currently implemented.

Implementation references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms).
>>>>>>> 8bf0422 (Pushing the full product v1)
