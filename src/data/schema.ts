import { z } from 'zod';
import {
  EXERCISE_IDS,
  PROGRAM_ID,
  STAGES,
  WEEKDAYS,
  type ActiveSession,
  type ChosenSchedule,
  type LocalProfile,
  type ProgressionState,
  type SessionRecord,
  type Stage,
} from '../domain/types';
import { isLocalDate, isValidTimeZone } from '../lib/dates';

// Versioned, strict schemas for everything stored on the device. Unknown keys
// are rejected, text is length-limited, and imported data goes through the
// same validation. Nothing here is ever rendered as HTML.
//
// Version 2 (simplified app): no health screening, advice records, holds or
// next-day questions are stored. Version 1 data is migrated (see migrations.ts).

export const SCHEMA_VERSION = 2 as const;

const MAX_TEXT = 2000;
const MAX_SESSIONS = 5000;

const IsoInstant = z
  .string()
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid timestamp');
const LocalDate = z.string().refine(isLocalDate, 'Invalid local date');
const TimeZone = z.string().max(64).refine(isValidTimeZone, 'Unknown time zone');
const StageSchema = z.union(STAGES.map((s) => z.literal(s)) as unknown as [z.ZodLiteral<Stage>, z.ZodLiteral<Stage>, ...z.ZodLiteral<Stage>[]]);
const ExerciseIdSchema = z.enum(EXERCISE_IDS);
const ModeSchema = z.enum(['full', 'tiny']);

export const LocalProfileSchema: z.ZodType<LocalProfile> = z.strictObject({
  optedIn: z.boolean(),
  language: z.enum(['en', 'zh']),
  voice: z.enum(['off', 'mandarin', 'english']),
  textScale: z.number().min(1).max(1.6),
  displayName: z.string().max(60).nullable(),
  encouragementNote: z.string().max(MAX_TEXT).nullable(),
});

export const ScheduleSchema: z.ZodType<ChosenSchedule> = z.strictObject({
  weekdays: z.array(z.enum(WEEKDAYS)).max(7),
  timezone: TimeZone,
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
});

const PrescriptionSchema = z.strictObject({
  programId: z.literal(PROGRAM_ID),
  contentVersion: z.string().max(200),
  mode: ModeSchema,
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

export const SessionRecordSchema: z.ZodType<SessionRecord> = z.strictObject({
  id: z.string().min(1).max(64),
  mode: ModeSchema,
  programId: z.literal(PROGRAM_ID),
  contentVersion: z.string().max(200),
  stage: StageSchema,
  prescription: PrescriptionSchema,
  startedAt: IsoInstant,
  endedAt: IsoInstant,
  localDate: LocalDate,
  timezone: TimeZone,
  warmup: z.enum(['done', 'skipped']).nullable(),
  performed: z.array(PerformedExerciseSchema).max(EXERCISE_IDS.length),
  outcome: z.enum(['full_dose', 'partial', 'stopped']),
  creditEarned: z.boolean(),
});

export const ActiveSessionSchema: z.ZodType<ActiveSession> = z.strictObject({
  id: z.string().min(1).max(64),
  mode: ModeSchema,
  stage: StageSchema,
  prescription: PrescriptionSchema,
  startedAt: IsoInstant,
  localDate: LocalDate,
  timezone: TimeZone,
  contentVersion: z.string().max(200),
  phase: z.enum(['warmup', 'exercise', 'finish']),
  exerciseIndex: z.number().int().min(0).max(10),
  warmup: z.enum(['done', 'skipped']).nullable(),
  performed: z.array(PerformedExerciseSchema).max(EXERCISE_IDS.length),
  lastSetRecordedAt: IsoInstant.nullable(),
  restTimerStartedAt: IsoInstant.nullable(),
  updatedAt: IsoInstant,
});

export const ProgressionSchema: z.ZodType<ProgressionState> = z.strictObject({
  stageStartedAt: IsoInstant,
  declinedOffer: z
    .strictObject({ fromStage: StageSchema, basedOnSessionIds: z.array(z.string().max(64)).max(10), declinedAt: IsoInstant })
    .nullable(),
  stageChanges: z
    .array(
      z.strictObject({
        at: IsoInstant,
        from: StageSchema,
        to: StageSchema,
        reason: z.enum(['user_accepted_offer', 'manual', 'gap_restart']),
      }),
    )
    .max(1000),
});

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  contentVersion: string;
  profile: LocalProfile;
  programId: typeof PROGRAM_ID;
  stage: Stage;
  stageFullSessionCredits: string[];
  schedule: ChosenSchedule;
  sessions: SessionRecord[];
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
    programId: z.literal(PROGRAM_ID),
    stage: StageSchema,
    stageFullSessionCredits: z.array(z.string().max(64)).max(20),
    schedule: ScheduleSchema,
    sessions: z.array(SessionRecordSchema).max(MAX_SESSIONS),
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
  });

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}
