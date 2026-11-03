import { PROGRAM } from '../content/program';
import {
  isStage,
  type NextDayCheck,
  type NextDayResponse,
  type Plan,
  type ProgramStatus,
  type SafetyState,
  type SessionRecord,
  type Stage,
} from '../domain/types';
import { isWorkoutState } from '../safety/readiness';
import { reason, type Reason, type ReasonCode } from '../safety/reasons';
import { getFixedStagePrescription } from './prescription';
import { isComfortableFullDose } from './session';

export type OfferHoldReason =
  | 'program_not_reviewed'
  | 'safety_hold'
  | 'progression_not_approved'
  | 'max_stage'
  | 'return_frozen'
  | 'need_more_sessions'
  | 'next_day_missing'
  | 'next_day_not_usual'
  | 'recent_difficulty'
  | 'kept_amount';

export type StageOffer =
  | {
      kind: 'offer';
      fromStage: Stage;
      toStage: Stage;
      basedOnSessionIds: string[];
      defaultChoice: 'keep';
      reasons: Reason[];
    }
  | {
      kind: 'return_offer';
      fromStage: Stage;
      toStage: Stage;
      basedOnSessionIds: string[];
      defaultChoice: 'keep';
      reasons: Reason[];
    }
  | { kind: 'hold'; stage: Stage; holdReason: OfferHoldReason; reasons: Reason[] }
  | { kind: 'maintenance'; stage: 8; reasons: Reason[] };

export interface ProgressionContext {
  programStatus: ProgramStatus;
  hasUnresolvedHold: boolean;
  safetyState: SafetyState;
  progressionApproved: 'yes' | 'no' | 'not_discussed' | null;
  maxStage: Stage | null;
}

export class ProgressionError extends Error {}

const HOLD_REASON_CODE: Record<OfferHoldReason, ReasonCode> = {
  program_not_reviewed: 'offer_program_not_reviewed',
  safety_hold: 'offer_safety_hold',
  progression_not_approved: 'offer_progression_not_approved',
  max_stage: 'offer_max_stage',
  return_frozen: 'offer_return_frozen',
  need_more_sessions: 'offer_need_more_sessions',
  next_day_missing: 'offer_next_day_missing',
  next_day_not_usual: 'offer_next_day_not_usual',
  recent_difficulty: 'offer_recent_difficulty',
  kept_amount: 'offer_kept_amount',
};

function hold(stage: Stage, holdReason: OfferHoldReason): StageOffer {
  return { kind: 'hold', stage, holdReason, reasons: [reason(HOLD_REASON_CODE[holdReason])] };
}

export function isUsualNextDay(response: NextDayResponse | null): boolean {
  // Mild muscle soreness with ordinary everyday function and back symptoms at
  // the usual baseline counts as "usual" (effort and mild soreness can occur).
  return response === 'usual' || response === 'mild_soreness';
}

function byStart(a: SessionRecord, b: SessionRecord): number {
  return a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Offers ONLY the next supplied stage, and only when every condition holds.
 * The result is an offer the person may accept; the default is always
 * "Keep this amount". No calendar or count alone advances a stage.
 */
export function getNextStageOffer(
  history: { plan: Plan; sessions: readonly SessionRecord[] },
  nextDayChecks: readonly NextDayCheck[],
  restrictions: ProgressionContext,
): StageOffer {
  const { plan } = history;
  const stage = plan.stage;
  if (!isStage(stage)) throw new ProgressionError('Unsupported stage');

  if (restrictions.programStatus !== 'reviewed_for_use') return hold(stage, 'program_not_reviewed');
  if (restrictions.hasUnresolvedHold || !isWorkoutState(restrictions.safetyState)) return hold(stage, 'safety_hold');

  const checkFor = (sessionId: string) => nextDayChecks.find((c) => c.sessionId === sessionId);

  const returnMode = plan.progression.returnMode;
  if (returnMode) {
    if (returnMode.status === 'ready_to_offer' && returnMode.returnSessionId) {
      const session = history.sessions.find((s) => s.id === returnMode.returnSessionId);
      const check = checkFor(returnMode.returnSessionId);
      const cap = restrictions.maxStage ?? 8;
      const target = Math.min(returnMode.targetStage, cap);
      if (
        session &&
        session.mode === 'return' &&
        isComfortableFullDose(session) &&
        check?.status === 'answered' &&
        isUsualNextDay(check.response) &&
        isStage(target) &&
        target > stage
      ) {
        return {
          kind: 'return_offer',
          fromStage: stage,
          toStage: target,
          basedOnSessionIds: [session.id],
          defaultChoice: 'keep',
          reasons: [reason('offer_return_available')],
        };
      }
    }
    return hold(stage, 'return_frozen');
  }

  if (restrictions.progressionApproved !== 'yes') return hold(stage, 'progression_not_approved');
  if (stage === 8) return { kind: 'maintenance', stage: 8, reasons: [reason('maintenance_stage8')] };

  const next = stage + 1;
  if (!isStage(next)) throw new ProgressionError('No next stage');
  if (restrictions.maxStage !== null && next > restrictions.maxStage) return hold(stage, 'max_stage');

  const atStage = history.sessions
    .filter((s) => s.mode !== 'tiny' && s.stage === stage && s.startedAt >= plan.progression.stageStartedAt)
    .sort(byStart);
  const latest = atStage[atStage.length - 1];
  if (latest && (latest.feeling === 'too_much' || latest.feeling === 'new_or_worse' || latest.symptomCodes.length > 0 || latest.outcome === 'stopped_symptoms')) {
    return hold(stage, 'recent_difficulty');
  }

  const credited = plan.stageFullSessionCredits
    .map((id) => history.sessions.find((s) => s.id === id))
    .filter((s): s is SessionRecord => !!s && s.mode === 'full' && s.creditEarned && s.stage === stage)
    .sort(byStart);
  if (credited.length < PROGRAM.minimumFullSessionsPerStage) return hold(stage, 'need_more_sessions');

  const lastTwo = credited.slice(-PROGRAM.minimumFullSessionsPerStage);
  for (const s of lastTwo) {
    const check = checkFor(s.id);
    if (!check || check.status !== 'answered' || check.response === 'cant_remember' || check.response === null) {
      return hold(stage, 'next_day_missing');
    }
    if (!isUsualNextDay(check.response)) return hold(stage, 'next_day_not_usual');
  }

  const basedOn = lastTwo.map((s) => s.id);
  const declined = plan.progression.declinedOffer;
  if (declined && declined.fromStage === stage && sameIds(declined.basedOnSessionIds, basedOn)) {
    return hold(stage, 'kept_amount');
  }

  return {
    kind: 'offer',
    fromStage: stage,
    toStage: next,
    basedOnSessionIds: basedOn,
    defaultChoice: 'keep',
    reasons: [reason('offer_available')],
  };
}

/** Applies an offer the person actively accepted. Fails closed on stale or invalid offers. */
export function applyUserAcceptedStage(plan: Plan, offer: StageOffer, now: string): Plan {
  if (offer.kind === 'offer') {
    if (offer.fromStage !== plan.stage) throw new ProgressionError('Offer is out of date');
    if (offer.toStage !== plan.stage + 1) throw new ProgressionError('Only the next supplied stage can be offered');
    if (plan.progression.returnMode) throw new ProgressionError('Progression is frozen during a return');
    getFixedStagePrescription(plan.programId, offer.toStage); // throws if unsupported
    return {
      ...plan,
      stage: offer.toStage,
      stageFullSessionCredits: [],
      progression: {
        ...plan.progression,
        lastComfortableStage: offer.fromStage,
        stageStartedAt: now,
        declinedOffer: null,
        stageChanges: [...plan.progression.stageChanges, { at: now, from: offer.fromStage, to: offer.toStage, reason: 'user_accepted_offer' }],
      },
    };
  }
  if (offer.kind === 'return_offer') {
    const rm = plan.progression.returnMode;
    if (!rm || rm.status !== 'ready_to_offer') throw new ProgressionError('No return offer is pending');
    if (offer.fromStage !== plan.stage) throw new ProgressionError('Offer is out of date');
    if (offer.toStage > rm.targetStage) throw new ProgressionError('A return can never go above the last comfortable stage');
    getFixedStagePrescription(plan.programId, offer.toStage);
    return {
      ...plan,
      stage: offer.toStage,
      stageFullSessionCredits: [],
      progression: {
        ...plan.progression,
        returnMode: null,
        lastComfortableStage: offer.toStage,
        stageStartedAt: now,
        declinedOffer: null,
        stageChanges: [...plan.progression.stageChanges, { at: now, from: plan.stage, to: offer.toStage, reason: 'long_gap_return_restored' }],
      },
    };
  }
  throw new ProgressionError('Nothing to accept');
}

/** "Keep this amount" — the default. Preserves the plan; no negative consequence. */
export function declineStageOffer(plan: Plan, offer: StageOffer, now: string): Plan {
  if (offer.kind === 'offer') {
    return {
      ...plan,
      progression: {
        ...plan.progression,
        declinedOffer: { fromStage: offer.fromStage, basedOnSessionIds: [...offer.basedOnSessionIds], declinedAt: now },
      },
    };
  }
  if (offer.kind === 'return_offer') {
    // Keep the Stage 1 amount and rebuild from it using the supplied table.
    return {
      ...plan,
      stageFullSessionCredits: [],
      progression: { ...plan.progression, returnMode: null, lastComfortableStage: 1, stageStartedAt: now, declinedOffer: null },
    };
  }
  return plan;
}

/**
 * Updates the plan after a session is saved:
 * - tiny sessions never change the plan or earn credit;
 * - a credited full session is added to this stage's credits;
 * - "too much" without concerning symptoms returns to the previous
 *   comfortable stage next time (never a reduced *invented* dose);
 * - a short-gap session done at the last comfortable stage moves the plan there;
 * - the long-gap return session moves the return forward or rebuilds from Stage 1.
 */
export function applySessionToPlan(plan: Plan, session: SessionRecord, now: string): Plan {
  if (session.mode === 'tiny') return plan;
  const concerning = session.symptomCodes.length > 0 || session.outcome === 'stopped_symptoms' || session.feeling === 'new_or_worse';
  const tooMuch = session.feeling === 'too_much' && !concerning;

  if (session.mode === 'return') {
    const rm = plan.progression.returnMode;
    if (!rm) return plan;
    if (tooMuch) {
      return {
        ...plan,
        stage: 1,
        stageFullSessionCredits: [],
        progression: {
          ...plan.progression,
          returnMode: null,
          lastComfortableStage: null,
          stageStartedAt: now,
          declinedOffer: null,
          stageChanges: plan.stage !== 1 ? [...plan.progression.stageChanges, { at: now, from: plan.stage, to: 1, reason: 'long_gap_rebuild' }] : plan.progression.stageChanges,
        },
      };
    }
    if (isComfortableFullDose(session)) {
      return { ...plan, progression: { ...plan.progression, returnMode: { ...rm, status: 'awaiting_next_day', returnSessionId: session.id } } };
    }
    return plan; // partial or stopped: the return session is offered again next time
  }

  // mode === 'full'
  let next: Plan = plan;
  if (session.stage < plan.stage && isStage(session.stage)) {
    // Short-gap return at the last comfortable stage.
    next = {
      ...next,
      stage: session.stage,
      stageFullSessionCredits: [],
      progression: {
        ...next.progression,
        stageStartedAt: session.startedAt,
        declinedOffer: null,
        stageChanges: [...next.progression.stageChanges, { at: now, from: plan.stage, to: session.stage, reason: 'short_gap_return' }],
      },
    };
  }

  if (tooMuch) {
    const last = next.progression.lastComfortableStage;
    if (last !== null && last < next.stage) {
      return {
        ...next,
        stage: last,
        stageFullSessionCredits: [],
        progression: {
          ...next.progression,
          stageStartedAt: now,
          declinedOffer: null,
          stageChanges: [...next.progression.stageChanges, { at: now, from: next.stage, to: last, reason: 'too_much_step_down' }],
        },
      };
    }
    return { ...next, stageFullSessionCredits: [] };
  }

  if (concerning) return { ...next, stageFullSessionCredits: [] };

  if (session.creditEarned && session.stage === next.stage && !next.stageFullSessionCredits.includes(session.id)) {
    return { ...next, stageFullSessionCredits: [...next.stageFullSessionCredits, session.id] };
  }
  return next;
}

/** Updates the plan after next-day feedback for a session. */
export function applyNextDayToPlan(plan: Plan, session: SessionRecord, response: NextDayResponse): Plan {
  const usual = isUsualNextDay(response);
  if (session.mode === 'full') {
    if (usual && isComfortableFullDose(session) && session.stage <= plan.stage) {
      return { ...plan, progression: { ...plan.progression, lastComfortableStage: session.stage } };
    }
    return plan;
  }
  if (session.mode === 'return') {
    const rm = plan.progression.returnMode;
    if (!rm || rm.returnSessionId !== session.id) return plan;
    if (usual) {
      if (rm.targetStage <= 1) {
        return { ...plan, progression: { ...plan.progression, returnMode: null, lastComfortableStage: 1 } };
      }
      return { ...plan, progression: { ...plan.progression, returnMode: { ...rm, status: 'ready_to_offer' } } };
    }
    // Worse / unsure / can't remember: no offer; the return session is offered again.
    return { ...plan, progression: { ...plan.progression, returnMode: { ...rm, status: 'awaiting_return_session', returnSessionId: null } } };
  }
  return plan;
}

/** If recorded advice caps the stage below the current one, the person may choose to go back to it. */
export function applyClinicianMaxStage(plan: Plan, maxStage: Stage, now: string): Plan {
  if (plan.stage <= maxStage) return plan;
  return {
    ...plan,
    stage: maxStage,
    stageFullSessionCredits: [],
    progression: {
      ...plan.progression,
      lastComfortableStage: plan.progression.lastComfortableStage !== null ? (Math.min(plan.progression.lastComfortableStage, maxStage) as Stage) : null,
      stageStartedAt: now,
      declinedOffer: null,
      returnMode: plan.progression.returnMode ? { ...plan.progression.returnMode, targetStage: Math.min(plan.progression.returnMode.targetStage, maxStage) as Stage } : null,
      stageChanges: [...plan.progression.stageChanges, { at: now, from: plan.stage, to: maxStage, reason: 'clinician_max_stage' }],
    },
  };
}
