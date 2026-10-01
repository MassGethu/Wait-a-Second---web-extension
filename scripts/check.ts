import assert from 'node:assert/strict';
import {ruleBasedClassifier as classifier} from '../src/shared/classifier.ts';
import {KNOWN_DEMO_VIDEOS} from '../src/shared/knownDemoVideos.ts';
import {remaining} from '../src/shared/timer.ts';
import {dailyStats} from '../src/storage/statisticsRepository.ts';
import type {FocusSession,SiteContext} from '../src/shared/types.ts';
const watch:SiteContext={site:'YOUTUBE',section:'WATCH',url:'https://www.youtube.com/watch?v=other',videoId:'other'};
for(const [videoId,video] of Object.entries(KNOWN_DEMO_VIDEOS)){
 const url=new URL(`https://www.youtube.com/watch?t=157s&v=${videoId}&list=example`);
 const context={...watch,url:url.href,videoId:url.searchParams.get('v')!};
 assert.equal(context.videoId,videoId);
 for(const topic of ['DBMS','Study DBMS','Database Management Systems'])assert.equal(classifier.classify(context,topic).classification,'DISTRACTING');
 const topic=video.category==='ai-coding'?'learning AI coding':video.category==='gaming'?'Fortnite gameplay':'MrBeast entertainment';
 assert.equal(classifier.classify(context,topic).classification,'UNKNOWN');
 assert.equal(classifier.classify({...context,title:topic},topic).classification,'ALLOW');
}
assert.equal(classifier.classify({...watch,section:'SHORTS'},'DBMS').classification,'DISTRACTING');
assert.equal(classifier.classify({...watch,videoId:'other',title:'Database Normalization 1NF 2NF 3NF'},'Study DBMS').classification,'ALLOW');
assert.equal(classifier.classify({...watch,videoId:'other'},'DBMS').classification,'UNKNOWN');
assert.equal(classifier.classify({...watch,videoId:'other',title:'MrBeast challenge'},'DBMS').classification,'DISTRACTING');
for(const section of ['DIRECT_MESSAGES','REELS','EXPLORE','FEED'] as const)assert.equal(classifier.classify({site:'INSTAGRAM',section,url:'https://www.instagram.com/'},'DBMS').classification,section==='DIRECT_MESSAGES'?'ALLOW':'DISTRACTING');
const s:FocusSession={id:'test',topic:'DBMS',plannedDurationMinutes:25,startTimestamp:100000,createdAt:100000,accumulatedPausedTime:10000,status:'ACTIVE',mode:'LIGHT',intervals:[]};
assert.equal(remaining(s,170000),1440000);
assert.equal(remaining({...s,status:'PAUSED',pauseTimestamp:170000},999999),1440000);
const midnight=new Date();midnight.setHours(0,0,0,0);const boundary=+midnight;
const split={...s,startTimestamp:boundary-60000,intervals:[{start:boundary-60000,end:boundary+60000}],status:'COMPLETED' as const,completedAt:boundary+60000};
const days=dailyStats({activeSession:null,sessionHistory:[split],distractionEvents:[],resets:{}},boundary+120000);
assert.equal(days[5].minutes,1);assert.equal(days[6].minutes,1);
console.log('Passed: demo fallback, relevance, unknown title, Instagram sections, pause timing, local-midnight statistics.');
