import { z } from 'zod';
import programJson from './program.json';
import { EXERCISE_IDS, PROGRAM_ID, STAGES, WEEKDAYS, type ExerciseId, type ProgramId, type Stage, type Weekday } from '../domain/types';

/**
 * The supplied program is the single source of truth for every dose.
 * It is validated when the module loads; malformed content fails closed
 * (the import throws) rather than producing an invented prescription.
 */
const StageDoseSchema = z.strictObject({
  stage: z.number().int(),
  sets: z.array(z.number().int().positive()).length(EXERCISE_IDS.length),
  reps: z.array(z.number().int().positive()).length(EXERCISE_IDS.length),
});

const ProgramSchema = z.strictObject({
  programId: z.literal(PROGRAM_ID),
  version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initialStatus: z.literal('assessment_pending'),
  defaultWeekdays: z.array(z.enum(WEEKDAYS)).min(1),
  warmupWalkSeconds: z.number().int().positive(),
  restSeconds: z.number().int().positive(),
  minimumFullSessionsPerStage: z.number().int().positive(),
  exerciseOrder: z.tuple([
    z.literal(EXERCISE_IDS[0]),
    z.literal(EXERCISE_IDS[1]),
    z.literal(EXERCISE_IDS[2]),
    z.literal(EXERCISE_IDS[3]),
  ]),
  sideLegLiftRepsArePerSide: z.boolean(),
  stageDoses: z.array(StageDoseSchema).length(STAGES.length),
  tinySession: z.array(
    z.strictObject({
      exerciseId: z.enum(EXERCISE_IDS),
      sets: z.number().int().positive(),
      reps: z.number().int().positive(),
    }),
  ),
  tinySessionCountsForProgression: z.literal(false),
  automaticAddedLoadKg: z.literal(0),
});

export interface StageDose {
  stage: Stage;
  sets: number[];
  reps: number[];
}

export interface ProgramDefinition {
  programId: ProgramId;
  version: string;
  initialStatus: 'assessment_pending';
  defaultWeekdays: Weekday[];
  warmupWalkSeconds: number;
  restSeconds: number;
  minimumFullSessionsPerStage: number;
  exerciseOrder: ExerciseId[];
  sideLegLiftRepsArePerSide: boolean;
  stageDoses: StageDose[];
  tinySession: { exerciseId: ExerciseId; sets: number; reps: number }[];
  tinySessionCountsForProgression: false;
  automaticAddedLoadKg: 0;
}

export function parseProgramDefinition(raw: unknown): ProgramDefinition {
  const parsed = ProgramSchema.parse(raw);
  parsed.stageDoses.forEach((dose, index) => {
    if (dose.stage !== index + 1) {
      throw new Error(`Program content error: stage ${dose.stage} found at position ${index + 1}`);
    }
  });
  return {
    ...parsed,
    exerciseOrder: [...parsed.exerciseOrder],
    stageDoses: parsed.stageDoses.map((d) => ({ ...d, stage: d.stage as Stage })),
  };
}

export const PROGRAM: ProgramDefinition = parseProgramDefinition(programJson);

/** Raw JSON as supplied — used for the documentation generator and the "exact match" tests. */
export const PROGRAM_SOURCE_JSON: unknown = programJson;

export const SIDE_LEG_LIFT_ID: ExerciseId = 'supported-side-leg-lift';
