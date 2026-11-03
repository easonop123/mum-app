import type { Plan, Weekday } from '../domain/types';
import { isValidTimeZone } from '../lib/dates';
import {
  applySessionToPlan,
  applyUserAcceptedStage,
  chooseStage,
  declineStageOffer,
  restartAtStageOne,
  type StageOffer,
} from '../program/progression';
import { validateScheduleDays } from '../program/schedule';
import { createActiveSession, finalizeSession } from '../program/session';
import { createInitialAppData } from './defaults';
import type { AppData } from './schema';
import { nextPrescription, planOf, tinyPrescription, todayOptions } from './selectors';

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
  return { ...data, stage: plan.stage, stageFullSessionCredits: plan.stageFullSessionCredits, progression: plan.progression };
}

// ------------------------------------------------------------ profile / schedule

export function updateProfile(data: AppData, patch: Partial<AppData['profile']>, ctx: Ctx): AppData {
  return touch({ ...data, profile: { ...data.profile, ...patch } }, ctx);
}

export function setWeekdays(data: AppData, weekdays: Weekday[], ctx: Ctx): AppData {
  const check = validateScheduleDays(weekdays);
  if (!check.ok) throw new ActionError(check.reason, 'Invalid practice days');
  return touch({ ...data, schedule: { ...data.schedule, weekdays: [...weekdays] } }, ctx);
}

export function setScheduleDetails(data: AppData, patch: { reminderTime?: string | null; timezone?: string }, ctx: Ctx): AppData {
  if (patch.timezone !== undefined && !isValidTimeZone(patch.timezone)) throw new ActionError('bad_timezone', 'Unknown time zone');
  return touch({ ...data, schedule: { ...data.schedule, ...patch } }, ctx);
}

export function recordLearningVisit(data: AppData, ctx: Ctx): AppData {
  if (data.learningVisits.includes(ctx.today)) return data;
  return touch({ ...data, learningVisits: [...data.learningVisits, ctx.today] }, ctx);
}

// ------------------------------------------------------------ practice

export type StartResult = { kind: 'started'; data: AppData } | { kind: 'blocked'; data: AppData; reason: string };

/** Starts today's practice (or the smaller 3 + 3 practice). No questions first. */
export function startSession(data: AppData, mode: 'full' | 'tiny', ctx: Ctx): StartResult {
  if (data.activeSession) return { kind: 'blocked', data, reason: 'session_in_progress' };
  const options = todayOptions(data, ctx.today);
  const allowed = mode === 'tiny' ? options.canStartTiny : options.canStartFull;
  if (!allowed) return { kind: 'blocked', data, reason: options.day.kind };
  const next = mode === 'tiny' ? tinyPrescription(data) : nextPrescription(data);
  if (!next.ok) return { kind: 'blocked', data, reason: 'content_error' };
  const active = createActiveSession({
    id: ctx.newId(),
    prescription: next.prescription,
    planStage: data.stage,
    now: ctx.now,
    localDate: ctx.today,
    timezone: data.schedule.timezone,
  });
  return { kind: 'started', data: touch({ ...data, activeSession: active }, ctx) };
}

export function updateActiveSession(data: AppData, fn: (a: NonNullable<AppData['activeSession']>) => NonNullable<AppData['activeSession']>, ctx: Ctx): AppData {
  if (!data.activeSession) throw new ActionError('no_session', 'No practice in progress');
  return touch({ ...data, activeSession: fn(data.activeSession) }, ctx);
}

function saveFinished(data: AppData, stopped: boolean, ctx: Ctx): AppData {
  if (!data.activeSession) throw new ActionError('no_session', 'No practice in progress');
  const record = finalizeSession(data.activeSession, { stopped }, ctx.now);
  const next: AppData = { ...data, activeSession: null, sessions: [...data.sessions, record] };
  return touch(withPlan(next, applySessionToPlan(planOf(next), record)), ctx);
}

/** Saves the practice when the last set is recorded (or a movement is skipped at the end). */
export function finishSession(data: AppData, ctx: Ctx): AppData {
  return saveFinished(data, false, ctx);
}

/** Stop: saves what was actually done. Never locks anything afterwards. */
export function stopSession(data: AppData, ctx: Ctx): AppData {
  return saveFinished(data, true, ctx);
}

// ------------------------------------------------------------ stages (always the person's choice)

export function acceptStageOffer(data: AppData, offer: StageOffer, ctx: Ctx): AppData {
  return touch(withPlan(data, applyUserAcceptedStage(planOf(data), offer, ctx.now)), ctx);
}

export function keepCurrentAmount(data: AppData, offer: StageOffer, ctx: Ctx): AppData {
  return touch(withPlan(data, declineStageOffer(planOf(data), offer, ctx.now)), ctx);
}

export function setStage(data: AppData, stage: number, ctx: Ctx): AppData {
  if (data.activeSession) throw new ActionError('session_in_progress', 'Finish the practice first');
  return touch(withPlan(data, chooseStage(planOf(data), stage, ctx.now)), ctx);
}

export function startAgainAtStageOne(data: AppData, ctx: Ctx): AppData {
  return touch(withPlan(data, restartAtStageOne(planOf(data), ctx.now)), ctx);
}

// ------------------------------------------------------------ data management

export function resetAllData(ctx: Ctx): AppData {
  return createInitialAppData(ctx.now);
}
