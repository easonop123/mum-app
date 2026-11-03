import type { Answer, HoldKind, HoldState } from '../domain/types';
import { isWorkoutState, type SafetyDecision } from './readiness';
import { reason } from './reasons';

export interface CheckInAnswers {
  /** "Is anything new or worse since last time?" */
  newOrWorse?: Answer;
  /** Asked when newOrWorse is yes/unsure. */
  emergencySigns?: Answer;
  urgentSigns?: Answer;
}

export interface CheckInDecision extends SafetyDecision {
  /** A hold to create (persisted until a proper re-screen resolves it). */
  createHold: { kind: HoldKind; state: HoldState } | null;
  /** True only when today's practice may start. */
  mayStart: boolean;
}

/**
 * Per-session check-in. `current` is the person's combined current decision
 * (readiness + unresolved holds + program gate state). Answering "nothing
 * new" can never move a non-workout state into a workout state.
 */
export function evaluateSessionCheckIn(current: SafetyDecision, answers: CheckInAnswers): CheckInDecision {
  if (answers.emergencySigns === 'yes') {
    return {
      ...current,
      state: 'emergency_stop',
      reasons: [reason('emergency_signs')],
      createHold: { kind: 'advice_required', state: 'emergency_stop' },
      mayStart: false,
    };
  }

  if (answers.emergencySigns === 'unsure' || answers.urgentSigns === 'yes' || answers.urgentSigns === 'unsure') {
    return {
      ...current,
      state: 'urgent_assessment',
      reasons: [
        reason(answers.urgentSigns === 'yes' ? 'urgent_signs' : answers.urgentSigns === 'unsure' ? 'urgent_unsure' : 'emergency_unsure'),
      ],
      createHold: { kind: 'advice_required', state: 'urgent_assessment' },
      mayStart: false,
    };
  }

  // Existing holds / non-workout states stay exactly as they are.
  if (!isWorkoutState(current.state)) {
    return {
      ...current,
      reasons: [...current.reasons, reason('existing_state_unchanged')],
      createHold: null,
      mayStart: false,
    };
  }

  if (answers.newOrWorse === 'yes') {
    return {
      ...current,
      state: 'review_before_program',
      reasons: [reason('check_in_new_or_worse')],
      createHold: { kind: 'advice_required', state: 'review_before_program' },
      mayStart: false,
    };
  }

  if (answers.newOrWorse !== 'no') {
    // 'unsure' or not answered: not low risk.
    return {
      ...current,
      state: 'review_before_program',
      reasons: [reason('check_in_unsure')],
      createHold: { kind: 'recheck_required', state: 'review_before_program' },
      mayStart: false,
    };
  }

  return { ...current, createHold: null, mayStart: true };
}
