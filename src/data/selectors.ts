import type { Plan, Prescription, SessionRecord } from '../domain/types';
import { isSameIsoWeek, localDateInZone } from '../lib/dates';
import { ProgramContentError, getFixedStagePrescription, getTinySessionPrescription } from '../program/prescription';
import { gapRestartSuggestion, getNextStageOffer, type GapSuggestion, type StageOffer } from '../program/progression';
import { mayPractiseToday, practiceDayStatus, type PracticeDayStatus } from '../program/schedule';
import { repsDone } from '../program/session';
import type { AppData } from './schema';

export function todayFor(data: Pick<AppData, 'schedule'>, now: Date = new Date()): string {
  return localDateInZone(now, data.schedule.timezone);
}

export function planOf(data: AppData): Plan {
  return {
    programId: data.programId,
    stage: data.stage,
    stageFullSessionCredits: data.stageFullSessionCredits,
    progression: data.progression,
  };
}

export type NextPrescription = { ok: true; prescription: Prescription } | { ok: false; error: ProgramContentError };

function safely(fn: () => Prescription): NextPrescription {
  try {
    return { ok: true, prescription: fn() };
  } catch (e) {
    if (e instanceof ProgramContentError) return { ok: false, error: e };
    throw e;
  }
}

export function nextPrescription(data: AppData): NextPrescription {
  return safely(() => getFixedStagePrescription(data.programId, data.stage));
}

export function tinyPrescription(data: AppData): NextPrescription {
  return safely(() => getTinySessionPrescription(data.programId, data.stage));
}

export function dayStatus(data: AppData, today: string): PracticeDayStatus {
  return practiceDayStatus(data.schedule, data.sessions, today);
}

export interface TodayOptions {
  day: PracticeDayStatus;
  canStartFull: boolean;
  canStartTiny: boolean;
}

/** Practice is available on practice days, with no screening or approval step. */
export function todayOptions(data: AppData, today: string): TodayOptions {
  const day = dayStatus(data, today);
  const free = !data.activeSession && mayPractiseToday(day);
  return { day, canStartFull: free && nextPrescription(data).ok, canStartTiny: free && tinyPrescription(data).ok };
}

export function stageOfferFor(data: AppData): StageOffer {
  return getNextStageOffer({ plan: planOf(data), sessions: data.sessions });
}

export function gapSuggestionFor(data: AppData, today: string): GapSuggestion | null {
  return gapRestartSuggestion(planOf(data), data.sessions, today);
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
