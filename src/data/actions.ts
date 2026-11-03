import { EXERCISE_IDS, SETUP_ITEM_IDS, isStage, type Answer, type CheckInRecord, type ClinicianPlanRecord, type DumbbellConfig, type ExerciseId, type ExerciseProgress, type NextDayResponse, type Plan, type PrivateAdviceRecord, type ProfessionalSaid, type ReadinessAnswers, type SafetyHold, type SessionRecord, type SetupItemId, type SymptomCode, type Weekday } from '../domain/types';
import { programStatusFromAdvice } from '../program/prescription';
import {
  applyClinicianMaxStage,
  applyNextDayToPlan,
  applySessionToPlan,
  applyUserAcceptedStage,
  declineStageOffer,
  type StageOffer,
} from '../program/progression';
import { startLongGapReturn } from '../program/returnAfterGap';
import { validateScheduleDays } from '../program/schedule';
import {
  createActiveSession,
  finalizeSession,
  anyRepsRecorded,
  type SessionCompletion,
} from '../program/session';
import { evaluateSessionCheckIn, type CheckInDecision } from '../safety/checkIn';
import { accessAsDecision } from '../safety/gate';
import { createHold, evaluateHoldResolution, holdForStopChoice, unresolvedHolds, type HoldResolutionDecision } from '../safety/holds';
import { evaluateReadiness } from '../safety/readiness';
import type { ReasonCode } from '../safety/reasons';
import { isValidTimeZone } from '../lib/dates';
import { createInitialAppData } from './defaults';
import type { AppData } from './schema';
import { nextPrescription, planOf, programAccess, readinessDecision, returnSuggestionFor, tinyPrescription, todayOptions } from './selectors';

// Pure AppData transitions. Every function returns new data and never
// mutates its input; the store validates and persists the result.

export interface Ctx {
  now: string;
  today: string;
  newId: () => string;
}

export class ActionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ActionError';
  }
}

function touch(data: AppData, ctx: Ctx): AppData {
  return { ...data, updatedAt: ctx.now };
}

function withPlan(data: AppData, plan: Plan): AppData {
  return {
    ...data,
    programStatus: plan.programStatus,
    stage: plan.stage,
    stageFullSessionCredits: plan.stageFullSessionCredits,
    progression: plan.progression,
  };
}

// ------------------------------------------------------------ profile / onboarding

export function updateProfile(data: AppData, patch: Partial<AppData['profile']>, ctx: Ctx): AppData {
  return touch({ ...data, profile: { ...data.profile, ...patch } }, ctx);
}

/**
 * Commits screening answers. `complete` marks a finished (re-)screen; partial
 * commits are used so an emergency answer is stored immediately and survives
 * a refresh.
 */
export function commitReadiness(
  data: AppData,
  answers: ReadinessAnswers,
  notes: { restrictionsNote?: string | null; activityAdviceNote?: string | null },
  complete: boolean,
  ctx: Ctx,
): AppData {
  return touch(
    {
      ...data,
      readiness: {
        ...data.readiness,
        answers: { ...answers },
        answeredAt: complete ? ctx.now : data.readiness.answeredAt,
        rescreenRequired: complete ? null : data.readiness.rescreenRequired,
        restrictionsNote: notes.restrictionsNote !== undefined ? notes.restrictionsNote : data.readiness.restrictionsNote,
        activityAdviceNote: notes.activityAdviceNote !== undefined ? notes.activityAdviceNote : data.readiness.activityAdviceNote,
        contentVersion: data.contentVersion,
      },
    },
    ctx,
  );
}

/**
 * Commits screening answers and, for emergency or urgent answers, records a
 * hold so that returning to practice later requires the return flow
 * (medical advice + current symptoms), not just changing an answer.
 */
export function commitScreening(
  data: AppData,
  answers: ReadinessAnswers,
  notes: { restrictionsNote?: string | null; activityAdviceNote?: string | null },
  complete: boolean,
  ctx: Ctx,
): AppData {
  let next = commitReadiness(data, answers, notes, complete, ctx);
  const decision = evaluateReadiness(answers);
  if (decision.state === 'emergency_stop' || decision.state === 'urgent_assessment') {
    const alreadyHeld = unresolvedHolds(next.holds).some((h) => h.source === 'screening' && h.state === decision.state);
    if (!alreadyHeld) {
      const firm = answers.emergencySigns === 'yes' || answers.urgentSigns === 'yes' || answers.reviewSigns === 'yes';
      next = addHold(next, ctx, {
        source: 'screening',
        state: decision.state,
        kind: firm ? 'advice_required' : 'recheck_required',
        reasonCodes: decision.reasons.map((r) => r.code),
      }).data;
    }
  }
  return next;
}

// ------------------------------------------------------------ professional advice

export function recordProfessionalAdvice(data: AppData, advice: PrivateAdviceRecord, ctx: Ctx): AppData {
  for (const id of EXERCISE_IDS) {
    if (!advice.exerciseApprovals[id]) throw new ActionError('incomplete_advice', `Missing approval answer for ${id}`);
  }
  return touch({ ...data, professionalAdvice: advice, programStatus: programStatusFromAdvice(advice) }, ctx);
}

export function clearProfessionalAdvice(data: AppData, ctx: Ctx): AppData {
  return touch({ ...data, professionalAdvice: null, programStatus: 'assessment_pending' }, ctx);
}

export function recordClinicianPlan(data: AppData, plan: ClinicianPlanRecord | null, ctx: Ctx): AppData {
  return touch({ ...data, clinicianPlan: plan }, ctx);
}

/** The person chooses to go back to the maximum stage in their recorded advice. */
export function goToAdvisedMaxStage(data: AppData, ctx: Ctx): AppData {
  const max = data.professionalAdvice?.maxStage;
  if (!max || !isStage(max)) return data;
  return touch(withPlan(data, applyClinicianMaxStage(planOf(data), max, ctx.now)), ctx);
}

// ------------------------------------------------------------ equipment / setup

export function setSetupItem(data: AppData, item: SetupItemId, answer: Answer, ctx: Ctx): AppData {
  const equipment = data.equipment.map((e) => {
    if (e.kind !== 'setup_check') return e;
    const items = { ...e.items, [item]: answer };
    const complete = SETUP_ITEM_IDS.every((id) => items[id] === 'yes');
    return { ...e, items, completedAt: complete ? (e.completedAt ?? ctx.now) : null };
  });
  return touch({ ...data, equipment }, ctx);
}

export function saveDumbbell(data: AppData, config: DumbbellConfig, ctx: Ctx): AppData {
  const others = data.equipment.filter((e) => !(e.kind === 'dumbbell' && e.id === config.id));
  return touch({ ...data, equipment: [...others, { ...config, updatedAt: ctx.now }] }, ctx);
}

export function removeDumbbell(data: AppData, id: string, ctx: Ctx): AppData {
  return touch({ ...data, equipment: data.equipment.filter((e) => !(e.kind === 'dumbbell' && e.id === id)) }, ctx);
}

// ------------------------------------------------------------ schedule

export function setWeekdays(data: AppData, weekdays: Weekday[], ctx: Ctx): AppData {
  const check = validateScheduleDays(weekdays);
  if (!check.ok) throw new ActionError(check.reason, 'Invalid practice days');
  return touch({ ...data, schedule: { ...data.schedule, weekdays: [...weekdays] } }, ctx);
}

export function setScheduleDetails(data: AppData, patch: { cue?: string | null; reminderTime?: string | null; timezone?: string }, ctx: Ctx): AppData {
  if (patch.timezone !== undefined && !isValidTimeZone(patch.timezone)) throw new ActionError('bad_timezone', 'Unknown time zone');
  return touch({ ...data, schedule: { ...data.schedule, ...patch } }, ctx);
}

// ------------------------------------------------------------ learning

export function recordLearningVisit(data: AppData, ctx: Ctx): AppData {
  if (data.learningVisits.includes(ctx.today)) return data;
  return touch({ ...data, learningVisits: [...data.learningVisits, ctx.today] }, ctx);
}

function progressFor(data: AppData, id: ExerciseId): ExerciseProgress {
  return data.exerciseProgress[id] ?? { learnedAt: null, demoOpenedCount: 0, lastPracticedLocalDate: null };
}

export function noteDemoOpened(data: AppData, id: ExerciseId, ctx: Ctx): AppData {
  const p = progressFor(data, id);
  return touch({ ...data, exerciseProgress: { ...data.exerciseProgress, [id]: { ...p, demoOpenedCount: p.demoOpenedCount + 1 } } }, ctx);
}

export function setLearned(data: AppData, id: ExerciseId, learned: boolean, ctx: Ctx): AppData {
  const p = progressFor(data, id);
  return touch({ ...data, exerciseProgress: { ...data.exerciseProgress, [id]: { ...p, learnedAt: learned ? ctx.now : null } } }, ctx);
}

// ------------------------------------------------------------ gap return

/** On opening after ≥14 days, start the Stage 1 return (progression frozen). */
export function ensureReturnMode(data: AppData, ctx: Ctx): AppData {
  if (data.activeSession || data.progression.returnMode) return data;
  const suggestion = returnSuggestionFor(data, ctx.today);
  if (suggestion.kind !== 'long_gap') return data;
  return touch(withPlan(data, startLongGapReturn(planOf(data), suggestion, ctx.now)), ctx);
}

// ------------------------------------------------------------ sessions

export type StartResult =
  | { kind: 'started'; data: AppData }
  | { kind: 'held'; data: AppData; decision: CheckInDecision }
  | { kind: 'blocked'; data: AppData; reason: string };

function addHold(data: AppData, ctx: Ctx, hold: Omit<Parameters<typeof createHold>[0], 'id' | 'now' | 'localDate'>): { data: AppData; hold: SafetyHold } {
  const h = createHold({ ...hold, id: ctx.newId(), now: ctx.now, localDate: ctx.today });
  const paused = data.programStatus === 'reviewed_for_use' && h.kind === 'advice_required';
  return { data: { ...data, holds: [...data.holds, h], programStatus: paused ? 'paused_for_review' : data.programStatus }, hold: h };
}

/**
 * Starts a practice after the brief check-in. Re-checks the full gate here
 * (defence in depth) so no route, button or resumed state can bypass it.
 */
export function startSession(data: AppData, mode: 'full' | 'tiny', checkIn: CheckInRecord, ctx: Ctx): StartResult {
  if (data.activeSession) return { kind: 'blocked', data, reason: 'session_in_progress' };
  const options = todayOptions(data, ctx.today);
  const allowed = mode === 'tiny' ? options.canStartTiny : options.canStartFull;
  const decision = evaluateSessionCheckIn(accessAsDecision(options.access, readinessDecision(data)), {
    newOrWorse: checkIn.newOrWorse,
    emergencySigns: checkIn.emergencySigns ?? undefined,
    urgentSigns: checkIn.urgentSigns ?? undefined,
  });
  if (decision.createHold) {
    const codes = decision.reasons.map((r) => r.code);
    const { data: held } = addHold(data, ctx, { source: 'check_in', state: decision.createHold.state, kind: decision.createHold.kind, reasonCodes: codes });
    return { kind: 'held', data: touch(held, ctx), decision };
  }
  if (!allowed || !decision.mayStart) return { kind: 'blocked', data, reason: options.access.blockedBy ?? options.day.kind };

  const next = mode === 'tiny' ? tinyPrescription(data) : nextPrescription(data, ctx.today);
  if (!next.ok) return { kind: 'blocked', data, reason: 'content_error' };
  const active = createActiveSession({
    id: ctx.newId(),
    prescription: next.prescription,
    planStage: data.stage,
    now: ctx.now,
    localDate: ctx.today,
    timezone: data.schedule.timezone,
    checkIn,
  });
  return { kind: 'started', data: touch({ ...data, activeSession: active }, ctx) };
}

/** Whether an in-progress session may continue right now (used on resume and each step). */
export function mayContinueSession(data: AppData, ctx: Ctx): boolean {
  if (!data.activeSession) return false;
  const access = programAccess(data, ctx.today);
  return data.activeSession.mode === 'tiny' ? access.canStartTiny : access.canStartFull;
}

export function updateActiveSession(data: AppData, fn: (a: NonNullable<AppData['activeSession']>) => NonNullable<AppData['activeSession']>, ctx: Ctx): AppData {
  if (!data.activeSession) throw new ActionError('no_session', 'No practice in progress');
  if (!mayContinueSession(data, ctx)) throw new ActionError('blocked', 'Practice is not available right now');
  return touch({ ...data, activeSession: fn(data.activeSession) }, ctx);
}

function saveFinishedSession(data: AppData, record: SessionRecord, ctx: Ctx): AppData {
  let next: AppData = { ...data, activeSession: null, sessions: [...data.sessions, record] };
  if (record.mode !== 'tiny' && anyRepsRecorded(record.performed)) {
    next = {
      ...next,
      pendingNextDayChecks: [
        ...next.pendingNextDayChecks,
        { sessionId: record.id, sessionLocalDate: record.localDate, status: 'pending', response: null, answeredAt: null },
      ],
    };
  }
  const progress = { ...next.exerciseProgress };
  for (const ex of record.performed) {
    if (ex.sets.some((s) => (s.actualReps ?? 0) > 0)) {
      const p = progress[ex.exerciseId] ?? { learnedAt: null, demoOpenedCount: 0, lastPracticedLocalDate: null };
      progress[ex.exerciseId] = { ...p, lastPracticedLocalDate: record.localDate };
    }
  }
  next = { ...next, exerciseProgress: progress };
  return touch(withPlan(next, applySessionToPlan(planOf(next), record, ctx.now)), ctx);
}

export function finishSession(data: AppData, completion: Omit<SessionCompletion, 'stopped' | 'holdId' | 'symptomCodes'>, ctx: Ctx): AppData {
  if (!data.activeSession) throw new ActionError('no_session', 'No practice in progress');
  const record = finalizeSession(data.activeSession, { ...completion, symptomCodes: [], stopped: null, holdId: null }, ctx.now);
  return saveFinishedSession(data, record, ctx);
}

/** "Stop / not feeling right". Saves what was actually done; never offers a substitute. */
export function stopSession(data: AppData, choice: SymptomCode | 'just_stop', ctx: Ctx, note: string | null = null): { data: AppData; hold: SafetyHold | null } {
  if (!data.activeSession) throw new ActionError('no_session', 'No practice in progress');
  const holdSpec = holdForStopChoice(choice);
  let next = data;
  let hold: SafetyHold | null = null;
  if (holdSpec) {
    const added = addHold(next, ctx, { source: 'session_stop', state: holdSpec.state, kind: holdSpec.kind, reasonCodes: [holdSpec.reasonCode] });
    next = added.data;
    hold = added.hold;
  }
  const record = finalizeSession(
    data.activeSession,
    {
      feeling: holdSpec ? 'new_or_worse' : null,
      controlledMovement: null,
      couldDoMore: null,
      effort: null,
      note,
      symptomCodes: choice === 'just_stop' ? [] : [choice],
      stopped: holdSpec ? 'stopped_symptoms' : 'stopped_choice',
      holdId: hold?.id ?? null,
    },
    ctx.now,
  );
  return { data: saveFinishedSession(next, record, ctx), hold };
}

// ------------------------------------------------------------ next-day feedback

export function answerNextDayCheck(data: AppData, sessionId: string, response: NextDayResponse, ctx: Ctx): AppData {
  const check = data.pendingNextDayChecks.find((c) => c.sessionId === sessionId);
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!check || !session) throw new ActionError('unknown_session', 'No such practice');
  let next: AppData = {
    ...data,
    pendingNextDayChecks: data.pendingNextDayChecks.map((c) => (c.sessionId === sessionId ? { ...c, status: 'answered', response, answeredAt: ctx.now } : c)),
  };
  if (response === 'worse') {
    next = addHold(next, ctx, { source: 'next_day', state: 'review_before_program', kind: 'advice_required', reasonCodes: ['next_day_worse' satisfies ReasonCode] }).data;
  } else if (response === 'unsure') {
    next = addHold(next, ctx, { source: 'next_day', state: 'review_before_program', kind: 'recheck_required', reasonCodes: ['next_day_unsure' satisfies ReasonCode] }).data;
  }
  return touch(withPlan(next, applyNextDayToPlan(planOf(next), session, response)), ctx);
}

// ------------------------------------------------------------ offers

export function acceptStageOffer(data: AppData, offer: StageOffer, ctx: Ctx): AppData {
  return touch(withPlan(data, applyUserAcceptedStage(planOf(data), offer, ctx.now)), ctx);
}

export function keepCurrentAmount(data: AppData, offer: StageOffer, ctx: Ctx): AppData {
  return touch(withPlan(data, declineStageOffer(planOf(data), offer, ctx.now)), ctx);
}

// ------------------------------------------------------------ return-to-program (re-screen)

export interface RescreenSubmission {
  answers: ReadinessAnswers;
  talkedToProfessional: 'yes' | 'no';
  professionalSaid: ProfessionalSaid | null;
  note: string;
  restrictionsNote?: string | null;
  activityAdviceNote?: string | null;
}

export interface RescreenOutcome {
  data: AppData;
  results: Array<{ holdId: string; decision: HoldResolutionDecision }>;
}

/** Fresh answers plus medical-advice questions — never a checkbox reset. */
export function submitRescreen(data: AppData, submission: RescreenSubmission, ctx: Ctx): RescreenOutcome {
  const fresh = evaluateReadiness(submission.answers);
  let next = commitReadiness(
    data,
    submission.answers,
    { restrictionsNote: submission.restrictionsNote, activityAdviceNote: submission.activityAdviceNote },
    fresh.state !== 'onboarding_needed',
    ctx,
  );
  const results: RescreenOutcome['results'] = [];
  let pause = false;
  const holds = next.holds.map((h) => {
    if (h.resolvedAt !== null) return h;
    const decision = evaluateHoldResolution(h, {
      talkedToProfessional: submission.talkedToProfessional,
      professionalSaid: submission.professionalSaid,
      freshDecision: fresh,
    });
    results.push({ holdId: h.id, decision });
    if (decision.pauseProgram) pause = true;
    if (!decision.resolved) return h;
    return {
      ...h,
      resolvedAt: ctx.now,
      resolution: {
        resolvedAt: ctx.now,
        talkedToProfessional: submission.talkedToProfessional,
        professionalSaid: submission.professionalSaid,
        note: submission.note.slice(0, 2000),
      },
    };
  });
  next = { ...next, holds };
  const stillHeld = unresolvedHolds(holds).length > 0;
  if (pause) {
    next = { ...next, programStatus: 'paused_for_review' };
  } else if (!stillHeld && next.programStatus === 'paused_for_review') {
    // Resume only if the recorded advice still supports the routine as written.
    next = { ...next, programStatus: programStatusFromAdvice(next.professionalAdvice) };
  }
  return { data: touch(next, ctx), results };
}

// ------------------------------------------------------------ data management

export function resetAllData(ctx: Ctx): AppData {
  return createInitialAppData(ctx.now);
}
