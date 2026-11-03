import {
  EXERCISE_IDS,
  PROGRAM_ID,
  type NextDayCheck,
  type NextDayResponse,
  type Plan,
  type PrivateAdviceRecord,
  type ReadinessAnswers,
  type SessionRecord,
  type Stage,
} from '../src/domain/types';
import { getFixedStagePrescription, getReturnSessionPrescription, getTinySessionPrescription } from '../src/program/prescription';
import { createActiveSession, finalizeSession, finishWarmup, recordSet, nextPendingSet } from '../src/program/session';

/** Generic test answers with nothing concerning. NOT anyone's real answers. */
export const CLEAR_ANSWERS: ReadinessAnswers = {
  emergencySigns: 'no',
  urgentSigns: 'no',
  reviewSigns: 'no',
  currentBackPain: 'no',
  spreadingNumbWeak: 'no',
  knownDiagnosisOrRestrictions: 'no',
  injurySurgeryFracture: 'no',
  conditionOrExertionalSymptoms: 'no',
  activityAdvice: 'no',
  canStandWithSupport: 'yes',
  fallsDizziness: 'no',
  clinicianPlan: 'no',
};

export function approvedAdvice(overrides: Partial<PrivateAdviceRecord> = {}): PrivateAdviceRecord {
  return {
    recordedAt: '2026-11-10T01:00:00.000Z',
    updatedAt: '2026-11-10T01:00:00.000Z',
    adviceDate: '2026-11-10',
    professional: 'gp',
    assessedBackHistory: 'yes',
    exerciseApprovals: Object.fromEntries(EXERCISE_IDS.map((id) => [id, 'ok'])) as PrivateAdviceRecord['exerciseApprovals'],
    progressionApproved: 'yes',
    maxStage: null,
    restrictionsNote: '',
    otherNotes: '',
    enteredWith: 'myself',
    ...overrides,
  };
}

export function makePlan(overrides: Partial<Plan> = {}, progression: Partial<Plan['progression']> = {}): Plan {
  return {
    programId: PROGRAM_ID,
    programStatus: 'reviewed_for_use',
    stage: 1,
    stageFullSessionCredits: [],
    ...overrides,
    progression: {
      lastComfortableStage: null,
      stageStartedAt: '2026-01-01T00:00:00.000Z',
      returnMode: null,
      declinedOffer: null,
      stageChanges: [],
      ...progression,
    },
  };
}

let counter = 0;

/** Build a finished session by "tapping" each set like a person would. */
export function makeSession(params: {
  stage?: Stage;
  mode?: 'full' | 'tiny' | 'return';
  localDate: string;
  repsFor?: (target: number) => number;
  feeling?: SessionRecord['feeling'];
  controlled?: SessionRecord['controlledMovement'];
  couldDoMore?: SessionRecord['couldDoMore'];
  symptomCodes?: SessionRecord['symptomCodes'];
  id?: string;
}): SessionRecord {
  counter += 1;
  const stage = params.stage ?? 1;
  const mode = params.mode ?? 'full';
  const prescription =
    mode === 'tiny'
      ? getTinySessionPrescription(PROGRAM_ID, stage)
      : mode === 'return'
        ? getReturnSessionPrescription(PROGRAM_ID)
        : getFixedStagePrescription(PROGRAM_ID, stage);
  const startedAt = `${params.localDate}T00:00:00.000Z`;
  let active = createActiveSession({
    id: params.id ?? `s${counter}`,
    prescription,
    planStage: stage,
    now: startedAt,
    localDate: params.localDate,
    timezone: 'Pacific/Auckland',
    checkIn: { newOrWorse: 'no', emergencySigns: null, urgentSigns: null },
  });
  if (active.phase === 'warmup') active = finishWarmup(active, 'done', startedAt);
  for (let p = nextPendingSet(active); p; p = nextPendingSet(active)) {
    const target = active.performed[p.exerciseIndex]!.sets[p.setIndex]!.targetReps;
    active = recordSet(active, p.exerciseIndex, p.setIndex, params.repsFor ? params.repsFor(target) : target, startedAt);
  }
  return finalizeSession(
    active,
    {
      feeling: params.feeling === undefined ? 'comfortable' : params.feeling,
      controlledMovement: params.controlled === undefined ? 'yes' : params.controlled,
      couldDoMore: params.couldDoMore === undefined ? 'yes' : params.couldDoMore,
      effort: null,
      note: null,
      symptomCodes: params.symptomCodes ?? [],
      stopped: null,
      holdId: null,
    },
    `${params.localDate}T00:20:00.000Z`,
  );
}

export function answeredCheck(sessionId: string, sessionLocalDate: string, response: NextDayResponse): NextDayCheck {
  return { sessionId, sessionLocalDate, status: 'answered', response, answeredAt: `${sessionLocalDate}T20:00:00.000Z` };
}

export function pendingCheck(sessionId: string, sessionLocalDate: string): NextDayCheck {
  return { sessionId, sessionLocalDate, status: 'pending', response: null, answeredAt: null };
}
