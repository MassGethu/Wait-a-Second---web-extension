import type {ClassificationResult,SiteContext} from './types.ts';
import {academic,related} from './topicMatcher.ts';
import {knownDemoDistractionReason} from './knownDemoVideos.ts';
export interface Classifier {classify(context:SiteContext,topic:string):ClassificationResult}
export const ruleBasedClassifier:Classifier={classify(c,topic){
 const result=(classification:ClassificationResult['classification'],reason:string)=>({classification,reason});
 if(c.site==='INSTAGRAM'){
  if(c.section==='DIRECT_MESSAGES')return result('ALLOW','Direct messages support intentional communication.');
  if(['REELS','EXPLORE','FEED'].includes(c.section))return result('DISTRACTING','This section encourages scrolling outside your focus goal.');
  return result('UNKNOWN','This Instagram context is not confidently distracting.');
 }
 if(c.section==='SHORTS')return result('DISTRACTING','Short-form scrolling interrupts your focus.');
 if(c.section==='SEARCH')return result('ALLOW','Search can help you find relevant material.');
 if(c.section!=='WATCH')return result('UNKNOWN','No confident distraction signal.');
 const demoReason=knownDemoDistractionReason(c.videoId,topic);
 if(demoReason)return result('DISTRACTING',demoReason);
 if(!c.title)return result('UNKNOWN','Video title is not available yet.');
 if(related(topic,c.title))return result('ALLOW','Video title matches your focus topic.');
 if(/\b(mr\s?beast|prank|pranks|challenge|challenges|celebrity|gossip|funny|memes|comedy|vlog|music video|gaming|gameplay)\b/i.test(c.title)&&academic(topic))return result('DISTRACTING','Entertainment content looks unrelated to your study goal.');
 return result('UNKNOWN','Not enough evidence to interrupt.');
}};
