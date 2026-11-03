// Domain types shared by the program engine and the persisted data schema.
// No rendering or content strings live here.

export type Lang = 'en' | 'zh';

export const PROGRAM_ID = 'mum-home-foundation-v2' as const;
export type ProgramId = typeof PROGRAM_ID;

export const EXERCISE_IDS = [
  'chair-sit-to-stand',
  'wall-press-up',
  'supported-heel-raise',
  'supported-side-leg-lift',
] as const;
export type ExerciseId = (typeof EXERCISE_IDS)[number];

export const STAGES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Stage = (typeof STAGES)[number];

export function isStage(value: unknown): value is Stage {
  return typeof value === 'number' && (STAGES as readonly number[]).includes(value);
}

export function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === 'string' && (EXERCISE_IDS as readonly string[]).includes(value);
}

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type SessionMode = 'full' | 'tiny';
export type Side = 'left' | 'right';

/** Bilingual text. */
export interface LocalizedText {
  en: string;
  zh: string;
}

// ---------------------------------------------------------------- prescription

export interface PrescriptionItem {
  exerciseId: ExerciseId;
  sets: number;
  /** Repetitions per set. For per-side items this is the count for EACH side. */
  reps: number;
  perSide: boolean;
}

export interface Prescription {
  programId: ProgramId;
  contentVersion: string;
  mode: SessionMode;
  /** The supplied stage whose dose this is (tiny sessions record the plan stage they were taken at). */
  stage: Stage;
  items: PrescriptionItem[];
  addedLoadKg: 0;
  restSeconds: number;
  /** Minimum rest enforced between movements (only the tiny session has one). */
  minimumRestSeconds: number | null;
}

// ---------------------------------------------------------------- sessions

export interface PerformedSet {
  setNumber: number;
  side: Side | null;
  targetReps: number;
  /** null = not recorded yet. Only a person's tap records reps. */
  actualReps: number | null;
}

export interface PerformedExercise {
  exerciseId: ExerciseId;
  skipped: boolean;
  sets: PerformedSet[];
}

export type SessionOutcome = 'full_dose' | 'partial' | 'stopped';

export interface SessionRecord {
  id: string;
  mode: SessionMode;
  programId: ProgramId;
  contentVersion: string;
  stage: Stage;
  prescription: Prescription;
  startedAt: string;
  endedAt: string;
  localDate: string;
  timezone: string;
  warmup: 'done' | 'skipped' | null;
  performed: PerformedExercise[];
  outcome: SessionOutcome;
  /** True only for a FULL session in which the whole planned amount was done. */
  creditEarned: boolean;
}

export interface ActiveSession {
  id: string;
  mode: SessionMode;
  stage: Stage;
  prescription: Prescription;
  startedAt: string;
  localDate: string;
  timezone: string;
  contentVersion: string;
  phase: 'warmup' | 'exercise' | 'finish';
  exerciseIndex: number;
  warmup: 'done' | 'skipped' | null;
  performed: PerformedExercise[];
  lastSetRecordedAt: string | null;
  restTimerStartedAt: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------- schedule / profile

export interface ChosenSchedule {
  weekdays: Weekday[];
  timezone: string;
  reminderTime: string | null;
}

export interface LocalProfile {
  optedIn: boolean;
  language: Lang;
  voice: 'off' | 'mandarin' | 'english';
  textScale: number;
  displayName: string | null;
  encouragementNote: string | null;
}

// ---------------------------------------------------------------- progression

export type StageChangeReason = 'user_accepted_offer' | 'manual' | 'gap_restart';

export interface StageChange {
  at: string;
  from: Stage;
  to: Stage;
  reason: StageChangeReason;
}

export interface DeclinedOffer {
  fromStage: Stage;
  basedOnSessionIds: string[];
  declinedAt: string;
}

export interface ProgressionState {
  stageStartedAt: string;
  declinedOffer: DeclinedOffer | null;
  stageChanges: StageChange[];
}

/** The subset of AppData the progression functions operate on. */
export interface Plan {
  programId: ProgramId;
  stage: Stage;
  stageFullSessionCredits: string[];
  progression: ProgressionState;
}
