import {STATE_KEY} from '../shared/constants';
import type {AppState} from '../shared/types';
import {migrateState} from './migration';
export {emptyState} from './migration';
export async function readState():Promise<AppState>{return migrateState((await chrome.storage.local.get(STATE_KEY))[STATE_KEY]);}
export async function writeState(state:AppState):Promise<void>{await chrome.storage.local.set({[STATE_KEY]:state});}
