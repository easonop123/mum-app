import type { ProgramStatus, SafetyHold, SafetyState } from '../domain/types';
import type { ReviewDecision } from '../program/prescription';
import { mostSevereHold } from './holds';
import { isWorkoutState, type SafetyDecision } from './readiness';
import { reason, reasonsFromCodes, type Reason } from './reasons';

export type BlockedBy =
  | 'emergency'
  | 'urgent'
  | 'onboarding'
  | 'hold'
  | 'readiness'
  | 'assessment_pending'
  | 'paused_for_review'
  | 'routine_review'
  | 'setup'
  | null;

export interface ProgramAccess {
  /** Effective state shown to the person. */
  state: SafetyState;
  /** The screening result on its own (before holds and the program's own status). */
  readinessState: SafetyState;
  canStartFull: boolean;
  canStartTiny: boolean;
  /** Watching / reading demonstrations while resting. Never unlocks exercise. */
  canLearn: boolean;
  blockedBy: BlockedBy;
  reasons: Reason[];
  activeHold: SafetyHold | null;
}

export interface ProgramAccessInput {
  readiness: SafetyDecision;
  holds: readonly SafetyHold[];
  programStatus: ProgramStatus;
  /** Review of the prescription the person would do next (full / return session). */
  routineReview: ReviewDecision;
  /** Review of the tiny-session prescription. */
  tinyRoutineReview: ReviewDecision;
  setupComplete: boolean;
}

function blocked(
  state: SafetyState,
  readinessState: SafetyState,
  blockedBy: BlockedBy,
  reasons: Reason[],
  canLearn: boolean,
  activeHold: SafetyHold | null,
): ProgramAccess {
  return { state, readinessState, canStartFull: false, canStartTiny: false, canLearn, blockedBy, reasons, activeHold };
}

/**
 * The single gate every workout entry point (Today buttons, deep links,
 * resumed sessions) must pass. Order matters: emergency > urgent > onboarding
 * > holds > readiness concerns > this program's own assessment status >
 * recorded restrictions > home setup.
 */
export function getProgramAccess(input: ProgramAccessInput): ProgramAccess {
  const { readiness } = input;
  const hold = mostSevereHold(input.holds);
  const holdReasons = hold ? [...reasonsFromCodes(hold.reasonCodes), reason('hold_unresolved')] : [];

  if (readiness.state === 'emergency_stop' || hold?.state === 'emergency_stop') {
    const reasons = readiness.state === 'emergency_stop' ? readiness.reasons : holdReasons;
    return blocked('emergency_stop', readiness.state, 'emergency', reasons, false, hold);
  }
  if (readiness.state === 'urgent_assessment' || hold?.state === 'urgent_assessment') {
    const reasons = readiness.state === 'urgent_assessment' ? readiness.reasons : holdReasons;
    return blocked('urgent_assessment', readiness.state, 'urgent', reasons, false, hold);
  }
  if (readiness.state === 'onboarding_needed') {
    return blocked('onboarding_needed', readiness.state, 'onboarding', readiness.reasons, false, hold);
  }
  if (hold) {
    return blocked('review_before_program', readiness.state, 'hold', holdReasons, true, hold);
  }
  if (!isWorkoutState(readiness.state)) {
    return blocked('review_before_program', readiness.state, 'readiness', readiness.reasons, true, null);
  }
  if (input.programStatus === 'assessment_pending') {
    return blocked('review_before_program', readiness.state, 'assessment_pending', [reason('program_assessment_pending')], true, null);
  }
  if (input.programStatus === 'paused_for_review') {
    return blocked('review_before_program', readiness.state, 'paused_for_review', [reason('program_paused')], true, null);
  }
  if (input.routineReview.status !== 'compatible') {
    return blocked('review_before_program', readiness.state, 'routine_review', input.routineReview.reasons, true, null);
  }
  if (!input.setupComplete) {
    return {
      state: readiness.state,
      readinessState: readiness.state,
      canStartFull: false,
      canStartTiny: false,
      canLearn: true,
      blockedBy: 'setup',
      reasons: [reason('setup_needed')],
      activeHold: null,
    };
  }
  return {
    state: readiness.state,
    readinessState: readiness.state,
    canStartFull: true,
    canStartTiny: input.tinyRoutineReview.status === 'compatible',
    canLearn: true,
    blockedBy: null,
    reasons: readiness.reasons,
    activeHold: null,
  };
}

/**
 * Express the gate as a SafetyDecision so the session check-in can build on
 * it. If no practice may start, the decision is never a workout state.
 */
export function accessAsDecision(access: ProgramAccess, readiness: SafetyDecision): SafetyDecision {
  const mayPractise = access.canStartFull || access.canStartTiny;
  const state: SafetyState = mayPractise || !isWorkoutState(access.state) ? access.state : 'review_before_program';
  return {
    state,
    reasons: access.reasons,
    standingExercisesExcluded: readiness.standingExercisesExcluded,
    missingQuestions: readiness.missingQuestions,
  };
}
