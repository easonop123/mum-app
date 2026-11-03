import { PROGRAM, SIDE_LEG_LIFT_ID, type ProgramDefinition } from '../content/program';
import { CONTENT_VERSION } from '../content/version';
import { PROGRAM_ID, isExerciseId, isStage, type ExerciseId, type Prescription, type PrescriptionItem } from '../domain/types';

export class ProgramContentError extends Error {
  readonly code: 'unsupported_program' | 'unsupported_stage' | 'invalid_content';
  constructor(code: ProgramContentError['code'], message: string) {
    super(message);
    this.name = 'ProgramContentError';
    this.code = code;
  }
}

function assertProgram(programId: string, program: ProgramDefinition): void {
  if (programId !== PROGRAM_ID || program.programId !== PROGRAM_ID) {
    throw new ProgramContentError('unsupported_program', `Unsupported program: ${programId}`);
  }
}

function itemFor(program: ProgramDefinition, exerciseId: ExerciseId, sets: number, reps: number): PrescriptionItem {
  if (!Number.isInteger(sets) || sets <= 0 || !Number.isInteger(reps) || reps <= 0) {
    throw new ProgramContentError('invalid_content', `Invalid dose for ${exerciseId}`);
  }
  return {
    exerciseId,
    sets,
    reps,
    perSide: exerciseId === SIDE_LEG_LIFT_ID && program.sideLegLiftRepsArePerSide,
  };
}

/**
 * Reads the dose ONLY from the supplied stage table. Fails closed (throws) on
 * an unsupported program or stage — it never interpolates, invents a stage 9,
 * or adds load.
 */
export function getFixedStagePrescription(programId: string, stage: number, program: ProgramDefinition = PROGRAM): Prescription {
  assertProgram(programId, program);
  if (!isStage(stage)) {
    throw new ProgramContentError('unsupported_stage', `Unsupported stage: ${String(stage)}`);
  }
  const dose = program.stageDoses.find((d) => d.stage === stage);
  if (!dose) throw new ProgramContentError('unsupported_stage', `Stage ${stage} not in program`);
  const items = program.exerciseOrder.map((exerciseId, i) => {
    const sets = dose.sets[i];
    const reps = dose.reps[i];
    if (sets === undefined || reps === undefined) {
      throw new ProgramContentError('invalid_content', `Stage ${stage} is missing a dose for ${exerciseId}`);
    }
    return itemFor(program, exerciseId, sets, reps);
  });
  return {
    programId: PROGRAM_ID,
    contentVersion: CONTENT_VERSION,
    mode: 'full',
    stage,
    items,
    addedLoadKg: 0,
    restSeconds: program.restSeconds,
    minimumRestSeconds: null,
  };
}

/** Exactly three sit-to-stands, at least 60 s rest, three wall presses. Never progression credit. */
export function getTinySessionPrescription(programId: string, planStage: number, program: ProgramDefinition = PROGRAM): Prescription {
  assertProgram(programId, program);
  if (!isStage(planStage)) {
    throw new ProgramContentError('unsupported_stage', `Unsupported stage: ${String(planStage)}`);
  }
  const items = program.tinySession.map((t) => {
    if (!isExerciseId(t.exerciseId)) throw new ProgramContentError('invalid_content', 'Unknown tiny-session exercise');
    return itemFor(program, t.exerciseId, t.sets, t.reps);
  });
  return {
    programId: PROGRAM_ID,
    contentVersion: CONTENT_VERSION,
    mode: 'tiny',
    stage: planStage,
    items,
    addedLoadKg: 0,
    restSeconds: program.restSeconds,
    minimumRestSeconds: program.restSeconds,
  };
}

export function totalTargetReps(prescription: Prescription): number {
  return prescription.items.reduce((sum, item) => sum + item.sets * item.reps * (item.perSide ? 2 : 1), 0);
}
