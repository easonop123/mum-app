import { PROGRAM, SIDE_LEG_LIFT_ID, type ProgramDefinition } from '../content/program';
import { CONTENT_VERSION } from '../content/version';
import { EXERCISES } from '../content/exercises';
import {
  PROGRAM_ID,
  isExerciseId,
  isStage,
  type ExerciseId,
  type PrivateAdviceRecord,
  type Prescription,
  type PrescriptionItem,
  type RoutineRestrictions,
  type Stage,
} from '../domain/types';
import { reason, type Reason } from '../safety/reasons';

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
export function getFixedStagePrescription(
  programId: string,
  stage: number,
  program: ProgramDefinition = PROGRAM,
): Prescription {
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
export function getTinySessionPrescription(
  programId: string,
  planStage: number,
  program: ProgramDefinition = PROGRAM,
): Prescription {
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

/** A long-gap return session uses the Stage 1 dose. */
export function getReturnSessionPrescription(programId: string, program: ProgramDefinition = PROGRAM): Prescription {
  return { ...getFixedStagePrescription(programId, 1, program), mode: 'return' };
}

export interface ReviewDecision {
  status: 'compatible' | 'needs_human_review' | 'incompatible';
  blockedExerciseIds: ExerciseId[];
  unreviewedExerciseIds: ExerciseId[];
  reasons: Reason[];
}

/**
 * Checks a supplied prescription against recorded restrictions. It never
 * builds a substitute workout: incompatible items are surfaced for human
 * (owner + clinician) review instead.
 */
export function validateSuppliedRoutineAgainstRestrictions(
  prescription: Prescription,
  restrictions: RoutineRestrictions,
): ReviewDecision {
  const ids = prescription.items.map((i) => i.exerciseId);
  const blocked = new Set<ExerciseId>();
  const unreviewed = new Set<ExerciseId>();
  const reasons: Reason[] = [];

  if (restrictions.standingExercisesExcluded) {
    const standing = ids.filter((id) => EXERCISES[id].involvesStanding);
    standing.forEach((id) => blocked.add(id));
    if (standing.length > 0) reasons.push(reason('routine_standing_excluded'));
  }

  if (restrictions.exerciseApprovals === null) {
    ids.forEach((id) => unreviewed.add(id));
    reasons.push(reason('routine_no_advice'));
  } else {
    const approvals = restrictions.exerciseApprovals;
    const notOk = ids.filter((id) => approvals[id] === 'not_ok');
    const notDiscussed = ids.filter((id) => approvals[id] !== 'ok' && approvals[id] !== 'not_ok');
    notOk.forEach((id) => blocked.add(id));
    notDiscussed.forEach((id) => unreviewed.add(id));
    if (notOk.length > 0) reasons.push(reason('routine_not_ok'));
    if (notDiscussed.length > 0) reasons.push(reason('routine_not_discussed'));
  }

  if (restrictions.maxStage !== null && prescription.mode !== 'tiny' && prescription.stage > restrictions.maxStage) {
    ids.forEach((id) => blocked.add(id));
    reasons.push(reason('routine_above_max_stage'));
  }

  const status: ReviewDecision['status'] =
    blocked.size > 0 ? 'incompatible' : unreviewed.size > 0 ? 'needs_human_review' : 'compatible';
  return {
    status,
    blockedExerciseIds: [...blocked],
    unreviewedExerciseIds: [...unreviewed].filter((id) => !blocked.has(id)),
    reasons,
  };
}

export function restrictionsFrom(
  advice: PrivateAdviceRecord | null,
  standingExercisesExcluded: boolean,
): RoutineRestrictions {
  return {
    standingExercisesExcluded,
    exerciseApprovals: advice ? advice.exerciseApprovals : null,
    maxStage: advice ? advice.maxStage : null,
  };
}

/** Program status follows only from a recorded professional-advice record. */
export function programStatusFromAdvice(advice: PrivateAdviceRecord | null): 'assessment_pending' | 'reviewed_for_use' | 'paused_for_review' {
  if (!advice) return 'assessment_pending';
  if (advice.assessedBackHistory !== 'yes') return 'assessment_pending';
  const approvals = Object.values(advice.exerciseApprovals);
  if (approvals.some((a) => a === 'not_ok')) return 'paused_for_review';
  if (approvals.length !== PROGRAM.exerciseOrder.length || approvals.some((a) => a !== 'ok')) return 'assessment_pending';
  return 'reviewed_for_use';
}

export function totalTargetReps(prescription: Prescription): number {
  return prescription.items.reduce((sum, item) => sum + item.sets * item.reps * (item.perSide ? 2 : 1), 0);
}

export function isPrescriptionStage(value: unknown): value is Stage {
  return isStage(value);
}
