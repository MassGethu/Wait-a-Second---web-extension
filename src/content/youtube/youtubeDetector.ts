import type {SiteSection} from '../../shared/types';
export function youtubeSection(url:URL):SiteSection{if(url.pathname.startsWith('/shorts'))return 'SHORTS';if(url.pathname==='/watch')return 'WATCH';if(url.pathname==='/results')return 'SEARCH';if(url.pathname==='/')return 'HOME';return 'UNKNOWN';}
