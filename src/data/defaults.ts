import { PROGRAM } from '../content/program';
import { CONTENT_VERSION } from '../content/version';
import { PROGRAM_ID } from '../domain/types';
import { SCHEMA_VERSION, type AppData } from './schema';

/** Generic setup fact supplied for this deployment; not personal health data. */
export const DEFAULT_TIMEZONE = 'Pacific/Auckland';

/**
 * Fresh, empty local data. Contains NO personal health answers, history or
 * progress — those are only ever entered on the device. The program starts
 * as "assessment_pending" exactly as supplied.
 */
export function createInitialAppData(now: string): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    profile: {
      optedIn: false,
      language: 'en',
      languageConfirmed: false,
      voice: 'off',
      textScale: 1,
      region: 'NZ',
      regionConfirmed: false,
      displayName: null,
      birthYear: null,
      goal: null,
      goalText: null,
      encouragementNote: null,
    },
    readiness: {
      answers: {},
      answeredAt: null,
      contentVersion: CONTENT_VERSION,
      rescreenRequired: null,
      restrictionsNote: null,
      activityAdviceNote: null,
    },
    programId: PROGRAM_ID,
    programStatus: PROGRAM.initialStatus,
    stage: 1,
    stageFullSessionCredits: [],
    professionalAdvice: null,
    clinicianPlan: null,
    equipment: [{ id: 'home-setup', kind: 'setup_check', items: {}, completedAt: null }],
    schedule: { weekdays: [...PROGRAM.defaultWeekdays], timezone: DEFAULT_TIMEZONE, cue: null, reminderTime: null },
    exerciseProgress: {},
    sessions: [],
    pendingNextDayChecks: [],
    holds: [],
    progression: { lastComfortableStage: null, stageStartedAt: now, returnMode: null, declinedOffer: null, stageChanges: [] },
    activeSession: null,
    learningVisits: [],
    createdAt: now,
    updatedAt: now,
  };
}
