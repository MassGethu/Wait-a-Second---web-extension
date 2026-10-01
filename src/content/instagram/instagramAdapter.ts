import type {SiteAdapter} from '../../shared/types';
import {instagramSection} from './instagramDetector';
export const instagramAdapter:SiteAdapter={detectContext(){const url=new URL(location.href);return {site:'INSTAGRAM',section:instagramSection(url),url:url.href};}};
