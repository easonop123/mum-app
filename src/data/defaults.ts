import { PROGRAM } from '../content/program';
import { CONTENT_VERSION } from '../content/version';
import { PROGRAM_ID } from '../domain/types';
import { SCHEMA_VERSION, type AppData } from './schema';

/** Generic setup fact for this deployment; not personal data. */
export const DEFAULT_TIMEZONE = 'Pacific/Auckland';

/** Fresh, empty local data: Stage 1, Tuesday + Friday, no history. */
export function createInitialAppData(now: string): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    profile: {
      optedIn: false,
      language: 'en',
      voice: 'off',
      textScale: 1,
      displayName: null,
      encouragementNote: null,
    },
    programId: PROGRAM_ID,
    stage: 1,
    stageFullSessionCredits: [],
    schedule: { weekdays: [...PROGRAM.defaultWeekdays], timezone: DEFAULT_TIMEZONE, reminderTime: null },
    sessions: [],
    progression: { stageStartedAt: now, declinedOffer: null, stageChanges: [] },
    activeSession: null,
    learningVisits: [],
    createdAt: now,
    updatedAt: now,
  };
}
