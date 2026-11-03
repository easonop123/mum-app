import type {
  HoldKind,
  HoldSource,
  HoldState,
  ProfessionalSaid,
  SafetyHold,
  SymptomCode,
} from '../domain/types';
import { isWorkoutState, type SafetyDecision } from './readiness';
import { reason, type Reason, type ReasonCode } from './reasons';

export function unresolvedHolds(holds: readonly SafetyHold[]): SafetyHold[] {
  return holds.filter((h) => h.resolvedAt === null);
}

const HOLD_SEVERITY: Record<HoldState, number> = {
  emergency_stop: 3,
  urgent_assessment: 2,
  review_before_program: 1,
};

export function mostSevereHold(holds: readonly SafetyHold[]): SafetyHold | null {
  let worst: SafetyHold | null = null;
  for (const h of unresolvedHolds(holds)) {
    if (!worst || HOLD_SEVERITY[h.state] > HOLD_SEVERITY[worst.state]) worst = h;
  }
  return worst;
}

export function createHold(params: {
  id: string;
  now: string;
  localDate: string;
  source: HoldSource;
  state: HoldState;
  kind: HoldKind;
  reasonCodes: ReasonCode[];
}): SafetyHold {
  return {
    id: params.id,
    createdAt: params.now,
    localDate: params.localDate,
    source: params.source,
    state: params.state,
    kind: params.kind,
    reasonCodes: [...params.reasonCodes],
    resolvedAt: null,
    resolution: null,
  };
}

/** What the "Stop / not feeling right" choices mean. No choice offers a substitute exercise. */
export function holdForStopChoice(
  choice: SymptomCode | 'just_stop',
): { state: HoldState; kind: HoldKind; reasonCode: ReasonCode } | null {
  switch (choice) {
    case 'chest_faint_breathing':
      return { state: 'emergency_stop', kind: 'advice_required', reasonCode: 'stop_chest_faint_breathing' };
    case 'numb_weak_spreading':
      return { state: 'urgent_assessment', kind: 'advice_required', reasonCode: 'stop_numb_weak_spreading' };
    case 'back_pain_worse_sharp':
      return { state: 'review_before_program', kind: 'advice_required', reasonCode: 'stop_back_pain_worse' };
    case 'dizzy_unwell':
      return { state: 'review_before_program', kind: 'advice_required', reasonCode: 'stop_dizzy_unwell' };
    case 'other':
      return { state: 'review_before_program', kind: 'advice_required', reasonCode: 'stop_other' };
    case 'unsure':
      return { state: 'review_before_program', kind: 'recheck_required', reasonCode: 'stop_unsure' };
    case 'just_stop':
      return null; // Stopping because you want to is always fine.
  }
}

export interface RescreenInput {
  talkedToProfessional: 'yes' | 'no';
  professionalSaid: ProfessionalSaid | null;
  /** evaluateReadiness() on answers given fresh in this re-screen (never pre-filled). */
  freshDecision: SafetyDecision;
}

export interface HoldResolutionDecision {
  resolved: boolean;
  /** Program change required by the professional's advice, if any. */
  pauseProgram: boolean;
  reasons: Reason[];
}

/**
 * A return-to-program flow asks about medical advice AND current symptoms.
 * - advice_required holds need a professional's "OK to continue" plus fresh
 *   answers that are in a workout state.
 * - recheck_required holds (from "not sure") need fresh answers in a workout state.
 */
export function evaluateHoldResolution(hold: SafetyHold, input: RescreenInput): HoldResolutionDecision {
  const fresh = input.freshDecision;
  if (fresh.state === 'emergency_stop' || fresh.state === 'urgent_assessment' || fresh.state === 'onboarding_needed') {
    return { resolved: false, pauseProgram: false, reasons: fresh.reasons };
  }

  if (hold.kind === 'advice_required') {
    if (input.talkedToProfessional !== 'yes') {
      return { resolved: false, pauseProgram: false, reasons: [reason('hold_needs_advice')] };
    }
    switch (input.professionalSaid) {
      case 'ok_to_continue':
        if (isWorkoutState(fresh.state)) {
          return { resolved: true, pauseProgram: false, reasons: [reason('rescreen_clear')] };
        }
        return { resolved: false, pauseProgram: false, reasons: [reason('rescreen_concerns_remain'), ...fresh.reasons] };
      case 'continue_with_changes':
        return { resolved: true, pauseProgram: true, reasons: [reason('professional_advised_changes')] };
      case 'stop_for_now':
        return { resolved: false, pauseProgram: true, reasons: [reason('professional_said_stop')] };
      case 'unsure':
      case null:
        return { resolved: false, pauseProgram: false, reasons: [reason('professional_advice_unclear')] };
    }
  }

  // recheck_required
  if (isWorkoutState(fresh.state)) {
    return { resolved: true, pauseProgram: false, reasons: [reason('rescreen_clear')] };
  }
  return { resolved: false, pauseProgram: false, reasons: [reason('rescreen_concerns_remain'), ...fresh.reasons] };
}
