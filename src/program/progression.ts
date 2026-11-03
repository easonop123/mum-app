import { PROGRAM } from '../content/program';
import { isStage, type Plan, type SessionRecord, type Stage } from '../domain/types';
import { daysBetween } from '../lib/dates';
import { getFixedStagePrescription } from './prescription';
import { anyRepsRecorded } from './session';

// Simple, choice-led progression through the supplied eight stages:
// after the supplied minimum of full practices at a stage, the person is
// offered the next stage (default: keep this amount). She can also pick any
// stage herself. Nothing ever changes the stage automatically.

export type StageOffer =
  | { kind: 'offer'; fromStage: Stage; toStage: Stage; basedOnSessionIds: string[] }
  | { kind: 'hold'; stage: Stage; holdReason: 'need_more_sessions' | 'kept_amount'; fullPractices: number }
  | { kind: 'maintenance'; stage: 8 };

export class ProgressionError extends Error {}

function byStart(a: SessionRecord, b: SessionRecord): number {
  return a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function getNextStageOffer(history: { plan: Plan; sessions: readonly SessionRecord[] }): StageOffer {
  const { plan } = history;
  const stage = plan.stage;
  if (!isStage(stage)) throw new ProgressionError('Unsupported stage');
  if (stage === 8) return { kind: 'maintenance', stage: 8 };

  const credited = plan.stageFullSessionCredits
    .map((id) => history.sessions.find((s) => s.id === id))
    .filter((s): s is SessionRecord => !!s && s.mode === 'full' && s.creditEarned && s.stage === stage)
    .sort(byStart);
  const needed = PROGRAM.minimumFullSessionsPerStage;
  if (credited.length < needed) return { kind: 'hold', stage, holdReason: 'need_more_sessions', fullPractices: credited.length };

  const basedOn = credited.slice(-needed).map((s) => s.id);
  const declined = plan.progression.declinedOffer;
  if (declined && declined.fromStage === stage && sameIds(declined.basedOnSessionIds, basedOn)) {
    return { kind: 'hold', stage, holdReason: 'kept_amount', fullPractices: credited.length };
  }
  const next = stage + 1;
  if (!isStage(next)) throw new ProgressionError('No next stage');
  return { kind: 'offer', fromStage: stage, toStage: next, basedOnSessionIds: basedOn };
}

function moveTo(plan: Plan, to: Stage, reason: 'user_accepted_offer' | 'manual' | 'gap_restart', now: string): Plan {
  getFixedStagePrescription(plan.programId, to); // fails closed on an unsupported stage
  if (to === plan.stage) return plan;
  return {
    ...plan,
    stage: to,
    stageFullSessionCredits: [],
    progression: {
      ...plan.progression,
      stageStartedAt: now,
      declinedOffer: null,
      stageChanges: [...plan.progression.stageChanges, { at: now, from: plan.stage, to, reason }],
    },
  };
}

/** Applies an offer the person actively accepted. Fails closed on stale or invalid offers. */
export function applyUserAcceptedStage(plan: Plan, offer: StageOffer, now: string): Plan {
  if (offer.kind !== 'offer') throw new ProgressionError('Nothing to accept');
  if (offer.fromStage !== plan.stage) throw new ProgressionError('Offer is out of date');
  if (offer.toStage !== plan.stage + 1) throw new ProgressionError('Only the next supplied stage can be offered');
  return moveTo(plan, offer.toStage, 'user_accepted_offer', now);
}

/** "Keep this amount" — the default. Preserves the plan; no negative consequence. */
export function declineStageOffer(plan: Plan, offer: StageOffer, now: string): Plan {
  if (offer.kind !== 'offer') return plan;
  return {
    ...plan,
    progression: {
      ...plan.progression,
      declinedOffer: { fromStage: offer.fromStage, basedOnSessionIds: [...offer.basedOnSessionIds], declinedAt: now },
    },
  };
}

/** The person picks a stage from the supplied table themselves. */
export function chooseStage(plan: Plan, stage: number, now: string): Plan {
  if (!isStage(stage)) throw new ProgressionError('Unsupported stage');
  return moveTo(plan, stage, 'manual', now);
}

/** A full practice at the current stage with the whole planned amount done counts towards the next offer. */
export function applySessionToPlan(plan: Plan, session: SessionRecord): Plan {
  if (session.creditEarned && session.mode === 'full' && session.stage === plan.stage && !plan.stageFullSessionCredits.includes(session.id)) {
    return { ...plan, stageFullSessionCredits: [...plan.stageFullSessionCredits, session.id] };
  }
  return plan;
}

// ---------------------------------------------------------------- after a long break

/** Supplied rule: after 14 days or more, starting again at the Stage 1 amount is suggested. */
export const LONG_GAP_DAYS = 14;

/** Last day with a practice that counts for the gap (full practices with recorded reps; tiny ones don't). */
export function lastPracticeDate(sessions: readonly SessionRecord[]): string | null {
  let last: string | null = null;
  for (const s of sessions) {
    if (s.mode === 'tiny' || !anyRepsRecorded(s.performed)) continue;
    if (last === null || s.localDate > last) last = s.localDate;
  }
  return last;
}

export interface GapSuggestion {
  gapDays: number;
  currentStage: Stage;
}

/**
 * Only a suggestion: after a long break, the person may choose to start again
 * at Stage 1. Nothing changes unless she taps it, and a gap never creates
 * extra catch-up work.
 */
export function gapRestartSuggestion(plan: Plan, sessions: readonly SessionRecord[], todayLocalDate: string): GapSuggestion | null {
  const last = lastPracticeDate(sessions);
  if (last === null || plan.stage === 1) return null;
  const gapDays = daysBetween(last, todayLocalDate);
  return gapDays >= LONG_GAP_DAYS ? { gapDays, currentStage: plan.stage } : null;
}

export function restartAtStageOne(plan: Plan, now: string): Plan {
  return moveTo(plan, 1, 'gap_restart', now);
}
