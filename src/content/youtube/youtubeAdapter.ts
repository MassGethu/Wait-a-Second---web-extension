import type {SiteAdapter} from '../../shared/types';
import {youtubeSection} from './youtubeDetector';
export const youtubeAdapter:SiteAdapter={detectContext(){const url=new URL(location.href);const section=youtubeSection(url);let title:string|undefined;
 if(section==='WATCH'){
 const player=document.querySelector('ytd-watch-flexy');const id=player?.getAttribute('video-id');
 if(!id||id===url.searchParams.get('v')){
 title=(document.querySelector('ytd-watch-metadata h1 yt-formatted-string, #title h1 yt-formatted-string, h1.title')?.textContent||document.querySelector('meta[name="title"]')?.getAttribute('content')||document.title).replace(/\s*[-–] YouTube\s*$/i,'').trim();
 if(title==='YouTube')title=undefined;
 }}return {site:'YOUTUBE',section,url:url.href,videoId:url.searchParams.get('v')??undefined,title};}};
