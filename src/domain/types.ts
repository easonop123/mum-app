// Domain types shared by the pure safety/progression engine and the persisted
// data schema. No rendering or content strings live here.

export type Answer = 'yes' | 'no' | 'unsure';
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

export type ProgramStatus = 'assessment_pending' | 'reviewed_for_use' | 'paused_for_review';

export type SafetyState =
  | 'onboarding_needed'
  | 'emergency_stop'
  | 'urgent_assessment'
  | 'review_before_program'
  | 'cautious_start'
  | 'clinician_guided_plan';

export type SessionMode = 'full' | 'tiny' | 'return';
export type Side = 'left' | 'right';

export type GoalId = 'chair_rising' | 'carrying' | 'standing' | 'confidence' | 'own';

/** Bilingual text returned by the engine ("return reasons in both languages"). */
export interface LocalizedText {
  en: string;
  zh: string;
}

// ---------------------------------------------------------------- readiness

export const READINESS_QUESTION_IDS = [
  'emergencySigns',
  'urgentSigns',
  'reviewSigns',
  'currentBackPain',
  'backPainNewOrWorse',
  'backPainLimitsTasks',
  'spreadingNumbWeak',
  'knownDiagnosisOrRestrictions',
  'injurySurgeryFracture',
  'conditionOrExertionalSymptoms',
  'activityAdvice',
  'canStandWithSupport',
  'fallsDizziness',
  'clinicianPlan',
  'clinicianCheckedConcerns',
] as const;
export type ReadinessQuestionId = (typeof READINESS_QUESTION_IDS)[number];
export type ReadinessAnswers = Partial<Record<ReadinessQuestionId, Answer>>;

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

export type SessionFeeling = 'comfortable' | 'tired_ok' | 'too_much' | 'new_or_worse';
export type SessionOutcome = 'full_dose' | 'partial' | 'stopped_symptoms' | 'stopped_choice';
export type Effort = 'easy' | 'moderate' | 'hard';

export type SymptomCode =
  | 'chest_faint_breathing'
  | 'numb_weak_spreading'
  | 'back_pain_worse_sharp'
  | 'dizzy_unwell'
  | 'unsure'
  | 'other';

export interface CheckInRecord {
  newOrWorse: Answer;
  emergencySigns: Answer | null;
  urgentSigns: Answer | null;
}

export interface SessionRecord {
  id: string;
  mode: SessionMode;
  programId: ProgramId;
  contentVersion: string;
  stage: Stage;
  planStageAtStart: Stage;
  prescription: Prescription;
  startedAt: string;
  endedAt: string;
  localDate: string;
  timezone: string;
  checkIn: CheckInRecord;
  warmup: 'done' | 'skipped' | null;
  performed: PerformedExercise[];
  outcome: SessionOutcome;
  feeling: SessionFeeling | null;
  controlledMovement: Answer | null;
  couldDoMore: Answer | null;
  effort: Effort | null;
  symptomCodes: SymptomCode[];
  note: string | null;
  holdId: string | null;
  /** True only for a full-mode, full-dose, comfortable, controlled session at the plan stage. Next-day feedback is checked separately. */
  creditEarned: boolean;
  /** Plain-language record of changes the person chose (fewer reps, skipped movement...). */
  userApprovedChanges: string[];
}

export interface ActiveSession {
  id: string;
  mode: SessionMode;
  stage: Stage;
  planStageAtStart: Stage;
  prescription: Prescription;
  startedAt: string;
  localDate: string;
  timezone: string;
  contentVersion: string;
  checkIn: CheckInRecord;
  phase: 'warmup' | 'exercise' | 'finish';
  exerciseIndex: number;
  warmup: 'done' | 'skipped' | null;
  performed: PerformedExercise[];
  lastSetRecordedAt: string | null;
  restTimerStartedAt: string | null;
  updatedAt: string;
}

export type NextDayResponse = 'usual' | 'mild_soreness' | 'worse' | 'unsure' | 'cant_remember';

export interface NextDayCheck {
  sessionId: string;
  sessionLocalDate: string;
  status: 'pending' | 'answered';
  response: NextDayResponse | null;
  answeredAt: string | null;
}

// ---------------------------------------------------------------- holds

export type HoldKind = 'advice_required' | 'recheck_required';
export type HoldState = 'emergency_stop' | 'urgent_assessment' | 'review_before_program';
export type HoldSource = 'screening' | 'check_in' | 'session_stop' | 'next_day' | 'rescreen';
export type ProfessionalSaid = 'ok_to_continue' | 'continue_with_changes' | 'stop_for_now' | 'unsure';

export interface HoldResolution {
  resolvedAt: string;
  talkedToProfessional: 'yes' | 'no';
  professionalSaid: ProfessionalSaid | null;
  note: string;
}

export interface SafetyHold {
  id: string;
  createdAt: string;
  localDate: string;
  source: HoldSource;
  state: HoldState;
  kind: HoldKind;
  reasonCodes: string[];
  resolvedAt: string | null;
  resolution: HoldResolution | null;
}

// ---------------------------------------------------------------- advice / restrictions

export type ExerciseApproval = 'ok' | 'not_ok' | 'not_discussed';

export interface PrivateAdviceRecord {
  recordedAt: string;
  updatedAt: string;
  adviceDate: string | null;
  professional: 'gp' | 'physio' | 'other';
  /** Did the GP/physio look at the back-pain history, including any numbness, tingling or weakness? */
  assessedBackHistory: Answer;
  exerciseApprovals: Record<ExerciseId, ExerciseApproval>;
  progressionApproved: 'yes' | 'no' | 'not_discussed';
  maxStage: Stage | null;
  restrictionsNote: string;
  otherNotes: string;
  enteredWith: 'myself' | 'with_helper';
}

export interface ClinicianPlanRecord {
  text: string;
  source: 'gp' | 'physio' | 'other';
  recordedAt: string;
}

export interface RoutineRestrictions {
  /** From readiness: unsafe/unsure standing excludes every standing exercise. */
  standingExercisesExcluded: boolean;
  /** null = no professional advice recorded. */
  exerciseApprovals: Record<ExerciseId, ExerciseApproval> | null;
  maxStage: Stage | null;
}

// ---------------------------------------------------------------- equipment

export const SETUP_ITEM_IDS = [
  'chair_solid',
  'chair_wall_floor',
  'chair_height',
  'counter_stable',
  'footwear_space',
  'phone_position',
  'breathing_pace',
] as const;
export type SetupItemId = (typeof SETUP_ITEM_IDS)[number];

export interface SetupCheckConfig {
  id: 'home-setup';
  kind: 'setup_check';
  items: Partial<Record<SetupItemId, Answer>>;
  completedAt: string | null;
}

export interface DumbbellConfiguration {
  label: string;
  /** Actual assembled weight including the handle, if weighed. null = unknown. */
  assembledKg: number | null;
}

export interface DumbbellConfig {
  id: string;
  kind: 'dumbbell';
  label: string;
  handleCount: number | null;
  configurations: DumbbellConfiguration[];
  smallestIncrementKg: number | null;
  lockingSecure: Answer;
  weighedOnScale: Answer;
  notes: string;
  updatedAt: string;
}

export type EquipmentConfig = SetupCheckConfig | DumbbellConfig;

// ---------------------------------------------------------------- schedule / profile

export interface ChosenSchedule {
  weekdays: Weekday[];
  timezone: string;
  cue: string | null;
  reminderTime: string | null;
}

export interface LocalProfile {
  optedIn: boolean;
  language: Lang;
  languageConfirmed: boolean;
  voice: 'off' | 'mandarin' | 'english';
  textScale: number;
  region: 'NZ';
  regionConfirmed: boolean;
  displayName: string | null;
  birthYear: number | null;
  goal: GoalId | null;
  goalText: string | null;
  encouragementNote: string | null;
}

export interface ReadinessState {
  answers: ReadinessAnswers;
  answeredAt: string | null;
  contentVersion: string;
  rescreenRequired: null | { reason: 'imported'; since: string };
  restrictionsNote: string | null;
  activityAdviceNote: string | null;
}

export interface ExerciseProgress {
  learnedAt: string | null;
  demoOpenedCount: number;
  lastPracticedLocalDate: string | null;
}

// ---------------------------------------------------------------- progression

export interface ReturnMode {
  startedAt: string;
  detectedGapDays: number;
  /** The last comfortable stage; a return can never go above it. */
  targetStage: Stage;
  status: 'awaiting_return_session' | 'awaiting_next_day' | 'ready_to_offer';
  returnSessionId: string | null;
}

export type StageChangeReason =
  | 'user_accepted_offer'
  | 'too_much_step_down'
  | 'short_gap_return'
  | 'long_gap_return_started'
  | 'long_gap_return_restored'
  | 'long_gap_rebuild'
  | 'clinician_max_stage';

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
  lastComfortableStage: Stage | null;
  stageStartedAt: string;
  returnMode: ReturnMode | null;
  declinedOffer: DeclinedOffer | null;
  stageChanges: StageChange[];
}

/** The subset of AppData the progression functions operate on. */
export interface Plan {
  programId: ProgramId;
  programStatus: ProgramStatus;
  stage: Stage;
  stageFullSessionCredits: string[];
  progression: ProgressionState;
}
