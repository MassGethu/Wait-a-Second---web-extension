import {academic} from './topicMatcher.ts';

interface KnownDemoVideo {
 category: 'entertainment' | 'ai-coding' | 'gaming';
 label: string;
 relatedTopic: RegExp;
}

// Keep video IDs here; URL parameters and changing page titles are not identifiers.
export const KNOWN_DEMO_VIDEOS: Readonly<Record<string, KnownDemoVideo>> = {
 'gTKS8SAwUzE': {
  category: 'entertainment',
  label: 'MrBeast',
  relatedTopic: /\b(mr\s?beast|entertainment|creator|marketing|video production|filmmaking)\b/i,
 },
 '5fhcklZe-qE': {
  category: 'ai-coding',
  label: 'AI Coding',
  relatedTopic: /\b(ai|artificial intelligence|machine learning|coding|code|programming|software|developer|development|copilot|cursor)\b/i,
 },
 'jSluxDD3IFg': {
  category: 'gaming',
  label: 'Fortnite',
  relatedTopic: /\b(fortnite|gaming|game|games|gameplay|esports|unreal|streaming)\b/i,
 },
};

export function knownDemoDistractionReason(videoId: string | undefined, topic: string): string | undefined {
 const video = videoId && Object.hasOwn(KNOWN_DEMO_VIDEOS, videoId)
  ? KNOWN_DEMO_VIDEOS[videoId] : undefined;
 // Only confident academic mismatches trigger the safeguard. Related or ambiguous
 // goals fall through to the existing title-based classifier, including UNKNOWN.
 if (!video || !academic(topic) || video.relatedTopic.test(topic)) return undefined;
 return `This ${video.label} video looks unrelated to your academic goal.`;
}
