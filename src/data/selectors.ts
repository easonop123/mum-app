import { PROGRAM } from '../content/program';
import type { NextDayCheck, Plan, Prescription, SessionRecord } from '../domain/types';
import { isSameIsoWeek, localDateInZone } from '../lib/dates';
import {
  ProgramContentError,
  getTinySessionPrescription,
  restrictionsFrom,
  validateSuppliedRoutineAgainstRestrictions,
  type ReviewDecision,
} from '../program/prescription';
import { getNextStageOffer, type StageOffer } from '../program/progression';
import { buildReturnAfterGapSuggestion, prescriptionForNextPractice, type ReturnSuggestion } from '../program/returnAfterGap';
import { mayPractiseToday, practiceDayStatus, type PracticeDayStatus } from '../program/schedule';
import { repsDone } from '../program/session';
import { getProgramAccess, type ProgramAccess } from '../safety/gate';
import { unresolvedHolds } from '../safety/holds';
import { evaluateReadiness, type SafetyDecision } from '../safety/readiness';
import { reason } from '../safety/reasons';
import type { AppData } from './schema';

export function todayFor(data: Pick<AppData, 'schedule'>, now: Date = new Date()): string {
  return localDateInZone(now, data.schedule.timezone);
}

/** Readiness as evaluated now. Imported answers are never treated as fresh clearance. */
export function readinessDecision(data: AppData): SafetyDecision {
  const d = evaluateReadiness(data.readiness.answers);
  if (data.readiness.rescreenRequired && (d.state === 'cautious_start' || d.state === 'clinician_guided_plan' || d.state === 'review_before_program' || d.state === 'onboarding_needed')) {
    return { ...d, state: 'onboarding_needed', reasons: [reason('rescreen_after_import')] };
  }
  return d;
}

export function setupComplete(data: AppData): boolean {
  const setup = data.equipment.find((e) => e.kind === 'setup_check');
  return !!setup && setup.kind === 'setup_check' && setup.completedAt !== null;
}

export function planOf(data: AppData): Plan {
  return {
    programId: data.programId,
    programStatus: data.programStatus,
    stage: data.stage,
    stageFullSessionCredits: data.stageFullSessionCredits,
    progression: data.progression,
  };
}

export function returnSuggestionFor(data: AppData, today: string): ReturnSuggestion {
  return buildReturnAfterGapSuggestion(planOf(data), data.sessions, null, today);
}

export type NextPrescription = { ok: true; prescription: Prescription } | { ok: false; error: ProgramContentError };

export function nextPrescription(data: AppData, today: string): NextPrescription {
  try {
    return { ok: true, prescription: prescriptionForNextPractice(planOf(data), returnSuggestionFor(data, today)) };
  } catch (e) {
    if (e instanceof ProgramContentError) return { ok: false, error: e };
    throw e;
  }
}

export function tinyPrescription(data: AppData): NextPrescription {
  try {
    return { ok: true, prescription: getTinySessionPrescription(data.programId, data.stage) };
  } catch (e) {
    if (e instanceof ProgramContentError) return { ok: false, error: e };
    throw e;
  }
}

const CONTENT_ERROR_REVIEW: ReviewDecision = {
  status: 'incompatible',
  blockedExerciseIds: [],
  unreviewedExerciseIds: [],
  reasons: [reason('content_error')],
};

export function programAccess(data: AppData, today: string): ProgramAccess {
  const readiness = readinessDecision(data);
  const restrictions = restrictionsFrom(data.professionalAdvice, readiness.standingExercisesExcluded);
  const next = nextPrescription(data, today);
  const tiny = tinyPrescription(data);
  return getProgramAccess({
    readiness,
    holds: data.holds,
    programStatus: data.programStatus,
    routineReview: next.ok ? validateSuppliedRoutineAgainstRestrictions(next.prescription, restrictions) : CONTENT_ERROR_REVIEW,
    tinyRoutineReview: tiny.ok ? validateSuppliedRoutineAgainstRestrictions(tiny.prescription, restrictions) : CONTENT_ERROR_REVIEW,
    setupComplete: setupComplete(data),
  });
}

export function dayStatus(data: AppData, today: string): PracticeDayStatus {
  return practiceDayStatus(data.schedule, data.sessions, today);
}

export interface TodayOptions {
  access: ProgramAccess;
  day: PracticeDayStatus;
  canStartFull: boolean;
  canStartTiny: boolean;
}

/** Combines the safety gate with the practice-day rules. */
export function todayOptions(data: AppData, today: string): TodayOptions {
  const access = programAccess(data, today);
  const day = dayStatus(data, today);
  const dayOk = mayPractiseToday(day);
  return { access, day, canStartFull: access.canStartFull && dayOk, canStartTiny: access.canStartTiny && dayOk };
}

export function stageOfferFor(data: AppData, today: string): StageOffer {
  const access = programAccess(data, today);
  return getNextStageOffer(
    { plan: planOf(data), sessions: data.sessions },
    data.pendingNextDayChecks,
    {
      programStatus: data.programStatus,
      hasUnresolvedHold: unresolvedHolds(data.holds).length > 0,
      safetyState: access.state,
      progressionApproved: data.professionalAdvice?.progressionApproved ?? null,
      maxStage: data.professionalAdvice?.maxStage ?? null,
    },
  );
}

/** Next-day questions are asked on the next opening on a later local date — no notifications needed. */
export function dueNextDayChecks(data: AppData, today: string): NextDayCheck[] {
  return data.pendingNextDayChecks.filter((c) => c.status === 'pending' && c.sessionLocalDate < today);
}

export function sessionById(data: AppData, id: string): SessionRecord | undefined {
  return data.sessions.find((s) => s.id === id);
}

export interface WeekActivity {
  practiceDays: number;
  learningDays: number;
}

export function weekActivity(data: AppData, today: string): WeekActivity {
  const practiceDays = new Set(data.sessions.filter((s) => isSameIsoWeek(s.localDate, today)).map((s) => s.localDate)).size;
  const learningDays = new Set(data.learningVisits.filter((d) => isSameIsoWeek(d, today))).size;
  return { practiceDays, learningDays };
}

export interface Totals {
  practices: number;
  repetitions: number;
  activeDays: number;
  byExercise: Record<string, number>;
}

export function totals(data: AppData): Totals {
  const byExercise: Record<string, number> = {};
  for (const s of data.sessions) {
    for (const ex of s.performed) byExercise[ex.exerciseId] = (byExercise[ex.exerciseId] ?? 0) + repsDone([ex]);
  }
  return {
    practices: data.sessions.length,
    repetitions: data.sessions.reduce((sum, s) => sum + repsDone(s.performed), 0),
    activeDays: new Set(data.sessions.map((s) => s.localDate)).size,
    byExercise,
  };
}

export function isOnboarded(data: AppData): boolean {
  return data.profile.optedIn && data.readiness.answeredAt !== null;
}

export const MIN_FULL_SESSIONS = PROGRAM.minimumFullSessionsPerStage;
