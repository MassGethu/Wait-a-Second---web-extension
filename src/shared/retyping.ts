import type {SiteContext} from './types.ts';
export function normalizeSentence(value:string):string {return value.trim().replace(/\s+/gu,' ').toLowerCase();}
export function sentenceMatches(value:string,target:string):boolean {return normalizeSentence(value)===normalizeSentence(target);}
export function retypeSentence(context:SiteContext,goal:string):string {
 const subject=context.site==='INSTAGRAM'
  ? ({REELS:'Instagram Reels',EXPLORE:'Instagram Explore',FEED:'Instagram Feed'} as Partial<Record<SiteContext['section'],string>>)[context.section]??'Instagram'
  : context.section==='SHORTS'?'YouTube Shorts':'this video';
 return `I am choosing ${subject} over my goal: ${goal}.`;
}
export function characterFeedback(value:string,target:string):('correct'|'incorrect'|'pending')[]{
 const actual=Array.from(normalizeSentence(value));
 return Array.from(normalizeSentence(target)).map((char,i)=>i>=actual.length?'pending':actual[i]===char?'correct':'incorrect');
}
