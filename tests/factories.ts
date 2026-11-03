import { PROGRAM_ID, type Plan, type SessionRecord, type Stage } from '../src/domain/types';
import { getFixedStagePrescription, getTinySessionPrescription } from '../src/program/prescription';
import { createActiveSession, finalizeSession, finishWarmup, nextPendingSet, recordSet } from '../src/program/session';

export function makePlan(overrides: Partial<Plan> = {}, progression: Partial<Plan['progression']> = {}): Plan {
  return {
    programId: PROGRAM_ID,
    stage: 1,
    stageFullSessionCredits: [],
    ...overrides,
    progression: {
      stageStartedAt: '2026-01-01T00:00:00.000Z',
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
  mode?: 'full' | 'tiny';
  localDate: string;
  repsFor?: (target: number) => number;
  stopped?: boolean;
  id?: string;
}): SessionRecord {
  counter += 1;
  const stage = params.stage ?? 1;
  const mode = params.mode ?? 'full';
  const prescription = mode === 'tiny' ? getTinySessionPrescription(PROGRAM_ID, stage) : getFixedStagePrescription(PROGRAM_ID, stage);
  const startedAt = `${params.localDate}T00:00:00.000Z`;
  let active = createActiveSession({
    id: params.id ?? `s${counter}`,
    prescription,
    planStage: stage,
    now: startedAt,
    localDate: params.localDate,
    timezone: 'Pacific/Auckland',
  });
  if (active.phase === 'warmup') active = finishWarmup(active, 'done', startedAt);
  for (let p = nextPendingSet(active); p; p = nextPendingSet(active)) {
    const target = active.performed[p.exerciseIndex]!.sets[p.setIndex]!.targetReps;
    active = recordSet(active, p.exerciseIndex, p.setIndex, params.repsFor ? params.repsFor(target) : target, startedAt);
  }
  return finalizeSession(active, { stopped: params.stopped ?? false }, `${params.localDate}T00:20:00.000Z`);
}
