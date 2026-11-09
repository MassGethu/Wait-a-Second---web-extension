import test from 'node:test';
import assert from 'node:assert/strict';
import {maintainShortVideo,reportViewer,shortVideoRoute} from '../src/shared/shortVideo.ts';
import {emptyState,migrateState} from '../src/storage/migration.ts';
import {shortVideoStats} from '../src/storage/statisticsRepository.ts';
import {maintain,startSession} from '../src/background/sessionState.ts';

test('short video routing recognizes viewer paths and excludes ordinary pages and nested routes',()=>{
 const route=(url:string)=>shortVideoRoute(new URL(url));
 assert.deepEqual(route('https://www.youtube.com/shorts/a-1?feature=share'),{platform:'SHORTS',clip:'a-1'});
 assert.deepEqual(route('https://www.instagram.com/reels/'),{platform:'REELS'});
 assert.deepEqual(route('https://instagram.com/reel/A_b/'),{platform:'REELS',clip:'A_b'});
 assert.deepEqual(route('https://www.instagram.com/reels/A_b/'),{platform:'REELS',clip:'A_b'});
 for(const url of ['https://youtube.com/watch?v=a','https://youtube.com/shorts','https://youtube.com/shortstuff',
  'https://instagram.com/direct/inbox/','https://instagram.com/explore/','https://instagram.com/profile/reels/',
  'https://instagram.com/reels/audio/123/','https://instagram.com/reels/friends/','https://unrelated.test/shorts/a']) {
  assert.equal(route(url),undefined,url);
 }
});

const source={runId:'browser',windowId:1,tabId:2,documentKey:'doc'};

test('viewer time splits across both midnight and the exact focus deadline',()=>{
 const midnight=+new Date(2026,10,10);
 const state=emptyState();
 state.shortVideo.enabled=true;
 startSession(state,'Study',1,'LIGHT',midnight-57_000);
 reportViewer(state,midnight-2000,source,'REELS',0);
 maintain(state,midnight+6000);
 reportViewer(state,midnight+6000,source,'REELS',1);
 const prior=shortVideoStats(state,[midnight-2000]);
 assert.deepEqual(prior.during.REELS,{viewerMs:2000,episodes:1,transitions:0});
 const today=shortVideoStats(state,[midnight]);
 assert.deepEqual(today.during.REELS,{viewerMs:3000,episodes:0,transitions:0});
 assert.deepEqual(today.outside.REELS,{viewerMs:3000,episodes:0,transitions:1});
 assert.deepEqual(migrateState(state),state);
});

test('lost heartbeats and a browser restart discard the unconfirmed gap without erasing totals',()=>{
 const state=migrateState({schemaVersion:2});
 assert.deepEqual(state.shortVideo,{enabled:false,days:{},visit:null});
 state.shortVideo.enabled=true;
 const now=+new Date(2026,10,9,12);
 reportViewer(state,now,source,'SHORTS',0);
 reportViewer(state,now+5000,source,'SHORTS',0);
 assert(maintainShortVideo(state.shortVideo,now+60_000,source.runId));
 reportViewer(state,now+60_000,source,'SHORTS',7);
 assert(maintainShortVideo(state.shortVideo,now+61_000,'new-browser'));
 const total=shortVideoStats(state,[now]).outside.SHORTS;
 assert.deepEqual(total,{viewerMs:5000,episodes:2,transitions:0});
});
