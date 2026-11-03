import { isStage, type Plan, type SessionRecord, type Stage } from '../domain/types';
import { daysBetween } from '../lib/dates';
import type { CheckInDecision } from '../safety/checkIn';
import type { Reason } from '../safety/reasons';
import { getFixedStagePrescription, getReturnSessionPrescription } from './prescription';
import { anyRepsRecorded } from './session';
import type { Prescription } from '../domain/types';

/** Missing at least one scheduled practice (two days a week, ≥1 rest day between) means ≥ 7 days. */
export const SHORT_GAP_DAYS = 7;
/** Supplied rule: at 14 days or more, return with the Stage 1 dose. */
export const LONG_GAP_DAYS = 14;

export type ReturnSuggestion =
  | { kind: 'first_time'; stage: Stage }
  | { kind: 'regular'; stage: Stage; gapDays: number }
  | { kind: 'short_gap'; stage: Stage; gapDays: number; doLessOption: true; welcomeBack: true }
  | { kind: 'long_gap'; gapDays: number; returnDoseStage: 1; targetStage: Stage; progressionFrozen: true; welcomeBack: true }
  | { kind: 'return_in_progress'; returnDoseStage: 1; targetStage: Stage; status: 'awaiting_return_session' | 'awaiting_next_day' | 'ready_to_offer' }
  | { kind: 'hold'; reasons: Reason[] };

/** Last day with a practice that counts for the gap: full or return sessions with recorded reps (tiny sessions don't). */
export function lastPracticeDate(sessions: readonly SessionRecord[]): string | null {
  let last: string | null = null;
  for (const s of sessions) {
    if (s.mode === 'tiny' || !anyRepsRecorded(s.performed)) continue;
    if (last === null || s.localDate > last) last = s.localDate;
  }
  return last;
}

/**
 * Never generates catch-up work: the suggestion is one session at most, at a
 * dose no larger than the current stage, and a long gap always returns with
 * the Stage 1 dose and a target no higher than the last comfortable stage.
 */
export function buildReturnAfterGapSuggestion(
  plan: Plan,
  history: readonly SessionRecord[],
  currentCheckIn: CheckInDecision | null,
  todayLocalDate: string,
): ReturnSuggestion {
  if (currentCheckIn && !currentCheckIn.mayStart) {
    return { kind: 'hold', reasons: currentCheckIn.reasons };
  }
  const rm = plan.progression.returnMode;
  if (rm) {
    return { kind: 'return_in_progress', returnDoseStage: 1, targetStage: rm.targetStage, status: rm.status };
  }
  const last = lastPracticeDate(history);
  if (last === null) return { kind: 'first_time', stage: plan.stage };

  const gapDays = Math.max(0, daysBetween(last, todayLocalDate));
  const comfortable = plan.progression.lastComfortableStage;

  if (gapDays >= LONG_GAP_DAYS) {
    const target = Math.min(comfortable ?? 1, plan.stage);
    return {
      kind: 'long_gap',
      gapDays,
      returnDoseStage: 1,
      targetStage: isStage(target) ? target : 1,
      progressionFrozen: true,
      welcomeBack: true,
    };
  }
  if (gapDays >= SHORT_GAP_DAYS) {
    const stage = comfortable !== null && comfortable < plan.stage ? comfortable : plan.stage;
    return { kind: 'short_gap', stage, gapDays, doLessOption: true, welcomeBack: true };
  }
  return { kind: 'regular', stage: plan.stage, gapDays };
}

/** Starts the long-gap return: Stage 1 dose, progression frozen until a comfortable next day. */
export function startLongGapReturn(plan: Plan, suggestion: Extract<ReturnSuggestion, { kind: 'long_gap' }>, now: string): Plan {
  if (plan.progression.returnMode) return plan;
  return {
    ...plan,
    stage: 1,
    stageFullSessionCredits: [],
    progression: {
      ...plan.progression,
      declinedOffer: null,
      stageStartedAt: now,
      returnMode: {
        startedAt: now,
        detectedGapDays: suggestion.gapDays,
        targetStage: suggestion.targetStage,
        status: 'awaiting_return_session',
        returnSessionId: null,
      },
      stageChanges:
        plan.stage !== 1
          ? [...plan.progression.stageChanges, { at: now, from: plan.stage, to: 1, reason: 'long_gap_return_started' }]
          : plan.progression.stageChanges,
    },
  };
}

/** The one prescription for the next practice, read only from the supplied stage table. */
export function prescriptionForNextPractice(plan: Plan, suggestion: ReturnSuggestion): Prescription {
  if (plan.progression.returnMode || suggestion.kind === 'long_gap' || suggestion.kind === 'return_in_progress') {
    return getReturnSessionPrescription(plan.programId);
  }
  if (suggestion.kind === 'short_gap') return getFixedStagePrescription(plan.programId, suggestion.stage);
  return getFixedStagePrescription(plan.programId, plan.stage);
}
