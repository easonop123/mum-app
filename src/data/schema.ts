import { z } from 'zod';
import {
  EXERCISE_IDS,
  PROGRAM_ID,
  READINESS_QUESTION_IDS,
  SETUP_ITEM_IDS,
  STAGES,
  WEEKDAYS,
  type ActiveSession,
  type ChosenSchedule,
  type ClinicianPlanRecord,
  type EquipmentConfig,
  type ExerciseProgress,
  type LocalProfile,
  type NextDayCheck,
  type PrivateAdviceRecord,
  type ProgramStatus,
  type ProgressionState,
  type ReadinessAnswers,
  type ReadinessState,
  type SafetyHold,
  type SessionRecord,
  type Stage,
} from '../domain/types';
import { isLocalDate, isValidTimeZone } from '../lib/dates';

// Versioned, strict schemas for everything stored on the device. Unknown keys
// are rejected, text is length-limited, and imported data goes through the
// same validation. Nothing here is ever rendered as HTML.

export const SCHEMA_VERSION = 1 as const;

const MAX_TEXT = 2000;
const MAX_SESSIONS = 5000;

const IsoInstant = z
  .string()
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid timestamp');
const LocalDate = z.string().refine(isLocalDate, 'Invalid local date');
const TimeZone = z.string().max(64).refine(isValidTimeZone, 'Unknown time zone');
const Text = z.string().max(MAX_TEXT);
const AnswerSchema = z.enum(['yes', 'no', 'unsure']);
const StageSchema = z.union(STAGES.map((s) => z.literal(s)) as unknown as [z.ZodLiteral<Stage>, z.ZodLiteral<Stage>, ...z.ZodLiteral<Stage>[]]);
const ExerciseIdSchema = z.enum(EXERCISE_IDS);

function keyedOptional<K extends string, S extends z.ZodType>(keys: readonly K[], value: S) {
  return z.strictObject(Object.fromEntries(keys.map((k) => [k, value.optional()])) as Record<K, z.ZodOptional<S>>);
}
function keyedRequired<K extends string, S extends z.ZodType>(keys: readonly K[], value: S) {
  return z.strictObject(Object.fromEntries(keys.map((k) => [k, value])) as Record<K, S>);
}

export const ReadinessAnswersSchema: z.ZodType<ReadinessAnswers> = keyedOptional(READINESS_QUESTION_IDS, AnswerSchema);

export const LocalProfileSchema: z.ZodType<LocalProfile> = z.strictObject({
  optedIn: z.boolean(),
  language: z.enum(['en', 'zh']),
  languageConfirmed: z.boolean(),
  voice: z.enum(['off', 'mandarin', 'english']),
  textScale: z.number().min(1).max(1.6),
  region: z.literal('NZ'),
  regionConfirmed: z.boolean(),
  displayName: z.string().max(60).nullable(),
  birthYear: z.number().int().min(1900).max(2100).nullable(),
  goal: z.enum(['chair_rising', 'carrying', 'standing', 'confidence', 'own']).nullable(),
  goalText: z.string().max(200).nullable(),
  encouragementNote: Text.nullable(),
});

export const ReadinessStateSchema: z.ZodType<ReadinessState> = z.strictObject({
  answers: ReadinessAnswersSchema,
  answeredAt: IsoInstant.nullable(),
  contentVersion: z.string().max(200),
  rescreenRequired: z.strictObject({ reason: z.literal('imported'), since: IsoInstant }).nullable(),
  restrictionsNote: Text.nullable(),
  activityAdviceNote: Text.nullable(),
});

export const PrivateAdviceRecordSchema: z.ZodType<PrivateAdviceRecord> = z.strictObject({
  recordedAt: IsoInstant,
  updatedAt: IsoInstant,
  adviceDate: LocalDate.nullable(),
  professional: z.enum(['gp', 'physio', 'other']),
  assessedBackHistory: AnswerSchema,
  exerciseApprovals: keyedRequired(EXERCISE_IDS, z.enum(['ok', 'not_ok', 'not_discussed'])),
  progressionApproved: z.enum(['yes', 'no', 'not_discussed']),
  maxStage: StageSchema.nullable(),
  restrictionsNote: Text,
  otherNotes: Text,
  enteredWith: z.enum(['myself', 'with_helper']),
});

export const ClinicianPlanSchema: z.ZodType<ClinicianPlanRecord> = z.strictObject({
  text: Text,
  source: z.enum(['gp', 'physio', 'other']),
  recordedAt: IsoInstant,
});

const SetupCheckSchema = z.strictObject({
  id: z.literal('home-setup'),
  kind: z.literal('setup_check'),
  items: keyedOptional(SETUP_ITEM_IDS, AnswerSchema),
  completedAt: IsoInstant.nullable(),
});

const DumbbellSchema = z.strictObject({
  id: z.string().min(1).max(64),
  kind: z.literal('dumbbell'),
  label: z.string().max(100),
  handleCount: z.number().int().min(0).max(20).nullable(),
  configurations: z
    .array(z.strictObject({ label: z.string().max(100), assembledKg: z.number().min(0).max(100).nullable() }))
    .max(30),
  smallestIncrementKg: z.number().min(0).max(50).nullable(),
  lockingSecure: AnswerSchema,
  weighedOnScale: AnswerSchema,
  notes: Text,
  updatedAt: IsoInstant,
});

export const EquipmentSchema: z.ZodType<EquipmentConfig> = z.discriminatedUnion('kind', [SetupCheckSchema, DumbbellSchema]);

export const ScheduleSchema: z.ZodType<ChosenSchedule> = z.strictObject({
  weekdays: z.array(z.enum(WEEKDAYS)).max(7),
  timezone: TimeZone,
  cue: z.string().max(200).nullable(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
});

const ExerciseProgressSchema: z.ZodType<ExerciseProgress> = z.strictObject({
  learnedAt: IsoInstant.nullable(),
  demoOpenedCount: z.number().int().min(0).max(100000),
  lastPracticedLocalDate: LocalDate.nullable(),
});

const PrescriptionSchema = z.strictObject({
  programId: z.literal(PROGRAM_ID),
  contentVersion: z.string().max(200),
  mode: z.enum(['full', 'tiny', 'return']),
  stage: StageSchema,
  items: z
    .array(
      z.strictObject({
        exerciseId: ExerciseIdSchema,
        sets: z.number().int().min(1).max(10),
        reps: z.number().int().min(1).max(50),
        perSide: z.boolean(),
      }),
    )
    .min(1)
    .max(EXERCISE_IDS.length),
  addedLoadKg: z.literal(0),
  restSeconds: z.number().int().min(0).max(600),
  minimumRestSeconds: z.number().int().min(0).max(600).nullable(),
});

const PerformedExerciseSchema = z.strictObject({
  exerciseId: ExerciseIdSchema,
  skipped: z.boolean(),
  sets: z
    .array(
      z.strictObject({
        setNumber: z.number().int().min(1).max(10),
        side: z.enum(['left', 'right']).nullable(),
        targetReps: z.number().int().min(1).max(50),
        actualReps: z.number().int().min(0).max(50).nullable(),
      }),
    )
    .max(40),
});

const CheckInSchema = z.strictObject({
  newOrWorse: AnswerSchema,
  emergencySigns: AnswerSchema.nullable(),
  urgentSigns: AnswerSchema.nullable(),
});

const SymptomCodeSchema = z.enum(['chest_faint_breathing', 'numb_weak_spreading', 'back_pain_worse_sharp', 'dizzy_unwell', 'unsure', 'other']);

export const SessionRecordSchema: z.ZodType<SessionRecord> = z.strictObject({
  id: z.string().min(1).max(64),
  mode: z.enum(['full', 'tiny', 'return']),
  programId: z.literal(PROGRAM_ID),
  contentVersion: z.string().max(200),
  stage: StageSchema,
  planStageAtStart: StageSchema,
  prescription: PrescriptionSchema,
  startedAt: IsoInstant,
  endedAt: IsoInstant,
  localDate: LocalDate,
  timezone: TimeZone,
  checkIn: CheckInSchema,
  warmup: z.enum(['done', 'skipped']).nullable(),
  performed: z.array(PerformedExerciseSchema).max(EXERCISE_IDS.length),
  outcome: z.enum(['full_dose', 'partial', 'stopped_symptoms', 'stopped_choice']),
  feeling: z.enum(['comfortable', 'tired_ok', 'too_much', 'new_or_worse']).nullable(),
  controlledMovement: AnswerSchema.nullable(),
  couldDoMore: AnswerSchema.nullable(),
  effort: z.enum(['easy', 'moderate', 'hard']).nullable(),
  symptomCodes: z.array(SymptomCodeSchema).max(10),
  note: Text.nullable(),
  holdId: z.string().max(64).nullable(),
  creditEarned: z.boolean(),
  userApprovedChanges: z.array(z.string().max(200)).max(20),
});

export const ActiveSessionSchema: z.ZodType<ActiveSession> = z.strictObject({
  id: z.string().min(1).max(64),
  mode: z.enum(['full', 'tiny', 'return']),
  stage: StageSchema,
  planStageAtStart: StageSchema,
  prescription: PrescriptionSchema,
  startedAt: IsoInstant,
  localDate: LocalDate,
  timezone: TimeZone,
  contentVersion: z.string().max(200),
  checkIn: CheckInSchema,
  phase: z.enum(['warmup', 'exercise', 'finish']),
  exerciseIndex: z.number().int().min(0).max(10),
  warmup: z.enum(['done', 'skipped']).nullable(),
  performed: z.array(PerformedExerciseSchema).max(EXERCISE_IDS.length),
  lastSetRecordedAt: IsoInstant.nullable(),
  restTimerStartedAt: IsoInstant.nullable(),
  updatedAt: IsoInstant,
});

export const NextDayCheckSchema: z.ZodType<NextDayCheck> = z.strictObject({
  sessionId: z.string().min(1).max(64),
  sessionLocalDate: LocalDate,
  status: z.enum(['pending', 'answered']),
  response: z.enum(['usual', 'mild_soreness', 'worse', 'unsure', 'cant_remember']).nullable(),
  answeredAt: IsoInstant.nullable(),
});

export const SafetyHoldSchema: z.ZodType<SafetyHold> = z.strictObject({
  id: z.string().min(1).max(64),
  createdAt: IsoInstant,
  localDate: LocalDate,
  source: z.enum(['screening', 'check_in', 'session_stop', 'next_day', 'rescreen']),
  state: z.enum(['emergency_stop', 'urgent_assessment', 'review_before_program']),
  kind: z.enum(['advice_required', 'recheck_required']),
  reasonCodes: z.array(z.string().max(64)).max(20),
  resolvedAt: IsoInstant.nullable(),
  resolution: z
    .strictObject({
      resolvedAt: IsoInstant,
      talkedToProfessional: z.enum(['yes', 'no']),
      professionalSaid: z.enum(['ok_to_continue', 'continue_with_changes', 'stop_for_now', 'unsure']).nullable(),
      note: Text,
    })
    .nullable(),
});

export const ProgressionSchema: z.ZodType<ProgressionState> = z.strictObject({
  lastComfortableStage: StageSchema.nullable(),
  stageStartedAt: IsoInstant,
  returnMode: z
    .strictObject({
      startedAt: IsoInstant,
      detectedGapDays: z.number().int().min(0).max(100000),
      targetStage: StageSchema,
      status: z.enum(['awaiting_return_session', 'awaiting_next_day', 'ready_to_offer']),
      returnSessionId: z.string().max(64).nullable(),
    })
    .nullable(),
  declinedOffer: z
    .strictObject({ fromStage: StageSchema, basedOnSessionIds: z.array(z.string().max(64)).max(10), declinedAt: IsoInstant })
    .nullable(),
  stageChanges: z
    .array(
      z.strictObject({
        at: IsoInstant,
        from: StageSchema,
        to: StageSchema,
        reason: z.enum([
          'user_accepted_offer',
          'too_much_step_down',
          'short_gap_return',
          'long_gap_return_started',
          'long_gap_return_restored',
          'long_gap_rebuild',
          'clinician_max_stage',
        ]),
      }),
    )
    .max(1000),
});

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  contentVersion: string;
  profile: LocalProfile;
  readiness: ReadinessState;
  programId: typeof PROGRAM_ID;
  programStatus: ProgramStatus;
  stage: Stage;
  stageFullSessionCredits: string[];
  professionalAdvice: PrivateAdviceRecord | null;
  clinicianPlan: ClinicianPlanRecord | null;
  equipment: EquipmentConfig[];
  schedule: ChosenSchedule;
  exerciseProgress: Record<string, ExerciseProgress>;
  sessions: SessionRecord[];
  pendingNextDayChecks: NextDayCheck[];
  holds: SafetyHold[];
  progression: ProgressionState;
  activeSession: ActiveSession | null;
  learningVisits: string[];
  createdAt: string;
  updatedAt: string;
}

export const AppDataSchema: z.ZodType<AppData> = z
  .strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    contentVersion: z.string().max(200),
    profile: LocalProfileSchema,
    readiness: ReadinessStateSchema,
    programId: z.literal(PROGRAM_ID),
    programStatus: z.enum(['assessment_pending', 'reviewed_for_use', 'paused_for_review']),
    stage: StageSchema,
    stageFullSessionCredits: z.array(z.string().max(64)).max(20),
    professionalAdvice: PrivateAdviceRecordSchema.nullable(),
    clinicianPlan: ClinicianPlanSchema.nullable(),
    equipment: z.array(EquipmentSchema).max(20),
    schedule: ScheduleSchema,
    exerciseProgress: z.record(ExerciseIdSchema, ExerciseProgressSchema.optional()).transform((r) => {
      const out: Record<string, ExerciseProgress> = {};
      for (const [k, v] of Object.entries(r)) if (v) out[k] = v;
      return out;
    }),
    sessions: z.array(SessionRecordSchema).max(MAX_SESSIONS),
    pendingNextDayChecks: z.array(NextDayCheckSchema).max(MAX_SESSIONS),
    holds: z.array(SafetyHoldSchema).max(1000),
    progression: ProgressionSchema,
    activeSession: ActiveSessionSchema.nullable(),
    learningVisits: z.array(LocalDate).max(MAX_SESSIONS),
    createdAt: IsoInstant,
    updatedAt: IsoInstant,
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (const s of data.sessions) {
      if (ids.has(s.id)) ctx.addIssue({ code: 'custom', message: `Duplicate session id ${s.id}` });
      ids.add(s.id);
    }
    // A plan can only be "reviewed for use" with a recorded advice record.
    if (data.programStatus === 'reviewed_for_use' && !data.professionalAdvice) {
      ctx.addIssue({ code: 'custom', message: 'reviewed_for_use requires a professional advice record' });
    }
  });

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}
