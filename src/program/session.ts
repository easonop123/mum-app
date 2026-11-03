import type { ActiveSession, PerformedExercise, PerformedSet, Prescription, PrescriptionItem, SessionOutcome, SessionRecord, Stage } from '../domain/types';

// Pure session-state helpers. Only an explicit person action (a tap passing
// a number) ever records repetitions: no timer, video event or elapsed time
// can create completed reps.

export function expandSets(item: PrescriptionItem): PerformedSet[] {
  const sets: PerformedSet[] = [];
  for (let n = 1; n <= item.sets; n += 1) {
    if (item.perSide) {
      sets.push({ setNumber: n, side: 'left', targetReps: item.reps, actualReps: null });
      sets.push({ setNumber: n, side: 'right', targetReps: item.reps, actualReps: null });
    } else {
      sets.push({ setNumber: n, side: null, targetReps: item.reps, actualReps: null });
    }
  }
  return sets;
}

export function createActiveSession(params: {
  id: string;
  prescription: Prescription;
  planStage: Stage;
  now: string;
  localDate: string;
  timezone: string;
}): ActiveSession {
  const { prescription } = params;
  return {
    id: params.id,
    mode: prescription.mode,
    stage: prescription.stage,
    prescription,
    startedAt: params.now,
    localDate: params.localDate,
    timezone: params.timezone,
    contentVersion: prescription.contentVersion,
    // The tiny session is exactly its two movements: no warm-up step.
    phase: prescription.mode === 'tiny' ? 'exercise' : 'warmup',
    exerciseIndex: 0,
    warmup: null,
    performed: prescription.items.map((item) => ({ exerciseId: item.exerciseId, skipped: false, sets: expandSets(item) })),
    lastSetRecordedAt: null,
    restTimerStartedAt: null,
    updatedAt: params.now,
  };
}

export function finishWarmup(active: ActiveSession, choice: 'done' | 'skipped', now: string): ActiveSession {
  return { ...active, warmup: choice, phase: 'exercise', exerciseIndex: firstOpenExerciseIndex(active.performed) ?? 0, updatedAt: now };
}

function firstOpenExerciseIndex(performed: PerformedExercise[]): number | null {
  const index = performed.findIndex((ex) => !ex.skipped && ex.sets.some((s) => s.actualReps === null));
  return index === -1 ? null : index;
}

export function nextPendingSet(active: Pick<ActiveSession, 'performed'>): { exerciseIndex: number; setIndex: number } | null {
  for (let e = 0; e < active.performed.length; e += 1) {
    const ex = active.performed[e];
    if (!ex || ex.skipped) continue;
    const s = ex.sets.findIndex((set) => set.actualReps === null);
    if (s !== -1) return { exerciseIndex: e, setIndex: s };
  }
  return null;
}

export class SessionActionError extends Error {}

/** Record the person's own count for the next pending set (0..target). */
export function recordSet(active: ActiveSession, exerciseIndex: number, setIndex: number, actualReps: number, now: string): ActiveSession {
  const pending = nextPendingSet(active);
  if (!pending || pending.exerciseIndex !== exerciseIndex || pending.setIndex !== setIndex) {
    throw new SessionActionError('Only the next pending set can be recorded');
  }
  const exercise = active.performed[exerciseIndex];
  const set = exercise?.sets[setIndex];
  if (!exercise || !set) throw new SessionActionError('Unknown set');
  if (!Number.isInteger(actualReps) || actualReps < 0 || actualReps > set.targetReps) {
    throw new SessionActionError('Reps must be a whole number between 0 and the planned amount');
  }
  const performed = active.performed.map((ex, e) =>
    e !== exerciseIndex ? ex : { ...ex, sets: ex.sets.map((st, s) => (s !== setIndex ? st : { ...st, actualReps })) },
  );
  const next = nextPendingSet({ performed });
  return {
    ...active,
    performed,
    exerciseIndex: next ? next.exerciseIndex : exerciseIndex,
    phase: next ? 'exercise' : 'finish',
    lastSetRecordedAt: now,
    restTimerStartedAt: null,
    updatedAt: now,
  };
}

/** Undo the most recently recorded set (for a mis-tap). */
export function undoLastSet(active: ActiveSession, now: string): ActiveSession {
  for (let e = active.performed.length - 1; e >= 0; e -= 1) {
    const ex = active.performed[e];
    if (!ex) continue;
    for (let s = ex.sets.length - 1; s >= 0; s -= 1) {
      if (ex.sets[s]?.actualReps !== null) {
        const performed = active.performed.map((x, xi) =>
          xi !== e ? x : { ...x, skipped: false, sets: x.sets.map((st, si) => (si !== s ? st : { ...st, actualReps: null })) },
        );
        return { ...active, performed, exerciseIndex: e, phase: 'exercise', updatedAt: now, lastSetRecordedAt: null };
      }
    }
  }
  return active;
}

export function skipExercise(active: ActiveSession, exerciseIndex: number, now: string): ActiveSession {
  const performed = active.performed.map((ex, e) => (e === exerciseIndex ? { ...ex, skipped: true } : ex));
  const next = nextPendingSet({ performed });
  return {
    ...active,
    performed,
    exerciseIndex: next ? next.exerciseIndex : exerciseIndex,
    phase: next ? 'exercise' : 'finish',
    updatedAt: now,
  };
}

export function startRestTimer(active: ActiveSession, now: string): ActiveSession {
  return { ...active, restTimerStartedAt: now, updatedAt: now };
}

export function isFullDose(performed: PerformedExercise[], prescription: Prescription): boolean {
  if (performed.length !== prescription.items.length) return false;
  return prescription.items.every((item, i) => {
    const ex = performed[i];
    if (!ex || ex.exerciseId !== item.exerciseId || ex.skipped) return false;
    const expected = item.sets * (item.perSide ? 2 : 1);
    return ex.sets.length === expected && ex.sets.every((s) => s.actualReps !== null && s.actualReps >= s.targetReps);
  });
}

export function repsDone(performed: PerformedExercise[]): number {
  return performed.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.actualReps ?? 0), 0), 0);
}

export function anyRepsRecorded(performed: PerformedExercise[]): boolean {
  return performed.some((ex) => ex.sets.some((s) => (s.actualReps ?? 0) > 0));
}

/** Saves what was actually done. A stopped or partial practice never counts as the full amount. */
export function finalizeSession(active: ActiveSession, options: { stopped: boolean }, now: string): SessionRecord {
  const fullDose = isFullDose(active.performed, active.prescription);
  const outcome: SessionOutcome = options.stopped ? 'stopped' : fullDose ? 'full_dose' : 'partial';
  return {
    id: active.id,
    mode: active.mode,
    programId: active.prescription.programId,
    contentVersion: active.contentVersion,
    stage: active.stage,
    prescription: active.prescription,
    startedAt: active.startedAt,
    endedAt: now,
    localDate: active.localDate,
    timezone: active.timezone,
    warmup: active.warmup,
    performed: active.performed,
    outcome,
    creditEarned: active.mode === 'full' && outcome === 'full_dose',
  };
}
