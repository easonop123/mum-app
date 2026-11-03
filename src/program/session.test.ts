import { describe, expect, it } from 'vitest';
import { PROGRAM_ID } from '../domain/types';
import { getFixedStagePrescription, getTinySessionPrescription } from './prescription';
import {
  SessionActionError,
  createActiveSession,
  finalizeSession,
  finishWarmup,
  isFullDose,
  nextPendingSet,
  recordSet,
  skipExercise,
  startRestTimer,
  undoLastSet,
} from './session';

const checkIn = { newOrWorse: 'no' as const, emergencySigns: null, urgentSigns: null };

function start(stage: 1 | 6 = 6) {
  return createActiveSession({
    id: 'a1',
    prescription: getFixedStagePrescription(PROGRAM_ID, stage),
    planStage: stage,
    now: '2026-11-03T00:00:00.000Z',
    localDate: '2026-11-03',
    timezone: 'Pacific/Auckland',
    checkIn,
  });
}

const done = { feeling: 'comfortable' as const, controlledMovement: 'yes' as const, couldDoMore: 'yes' as const, effort: null, note: null, symptomCodes: [], stopped: null, holdId: null };

describe('session recording', () => {
  it('expands side leg lift into explicit left and right sets, per side (case 28)', () => {
    const a = start(6);
    const side = a.performed[3]!;
    expect(side.sets.map((s) => [s.setNumber, s.side, s.targetReps])).toEqual([
      [1, 'left', 8], [1, 'right', 8], [2, 'left', 8], [2, 'right', 8],
    ]);
  });

  it('starts with the optional warm-up for full sessions, but not for the tiny session', () => {
    expect(start().phase).toBe('warmup');
    const tiny = createActiveSession({ id: 't', prescription: getTinySessionPrescription(PROGRAM_ID, 1), planStage: 1, now: 'n', localDate: '2026-11-03', timezone: 'Pacific/Auckland', checkIn });
    expect(tiny.phase).toBe('exercise');
  });

  it('elapsed time, rest timers and video events never create completed reps (case 11)', () => {
    let a = finishWarmup(start(), 'done', '2026-11-03T00:02:00.000Z');
    a = startRestTimer(a, '2026-11-03T00:03:00.000Z');
    // Simulate a long time passing / a video ending: there is no API that records reps without a number from a person.
    const later = { ...a, updatedAt: '2026-11-03T05:00:00.000Z' };
    expect(later.performed.every((ex) => ex.sets.every((s) => s.actualReps === null))).toBe(true);
    expect(nextPendingSet(later)).toEqual({ exerciseIndex: 0, setIndex: 0 });
  });

  it('records only the next pending set, within 0..planned', () => {
    let a = finishWarmup(start(1), 'done', 't');
    expect(() => recordSet(a, 1, 0, 5, 't')).toThrow(SessionActionError);
    expect(() => recordSet(a, 0, 0, 6, 't')).toThrow(SessionActionError);
    expect(() => recordSet(a, 0, 0, -1, 't')).toThrow(SessionActionError);
    a = recordSet(a, 0, 0, 3, 't');
    expect(a.performed[0]!.sets[0]!.actualReps).toBe(3);
    expect(nextPendingSet(a)).toEqual({ exerciseIndex: 1, setIndex: 0 });
  });

  it('fewer reps and skipped movements are saved as a partial session — never a full dose', () => {
    let a = finishWarmup(start(1), 'skipped', 't');
    a = recordSet(a, 0, 0, 5, 't');
    a = recordSet(a, 1, 0, 2, 't');
    a = skipExercise(a, 2, 't');
    a = recordSet(a, 3, 0, 5, 't');
    a = recordSet(a, 3, 1, 5, 't');
    expect(a.phase).toBe('finish');
    expect(isFullDose(a.performed, a.prescription)).toBe(false);
    const record = finalizeSession(a, done, 't2');
    expect(record.outcome).toBe('partial');
    expect(record.creditEarned).toBe(false);
    expect(record.userApprovedChanges).toEqual(['Did fewer repetitions: Wall press-up', 'Skipped: Supported heel raise', 'Skipped the warm-up walk']);
  });

  it('undo reverts the last tap only', () => {
    let a = finishWarmup(start(1), 'done', 't');
    a = recordSet(a, 0, 0, 5, 't');
    a = undoLastSet(a, 't');
    expect(nextPendingSet(a)).toEqual({ exerciseIndex: 0, setIndex: 0 });
  });

  it('a stopped session keeps its partial sets and never counts as full', () => {
    let a = finishWarmup(start(1), 'done', 't');
    a = recordSet(a, 0, 0, 5, 't');
    const record = finalizeSession(a, { ...done, feeling: 'new_or_worse', symptomCodes: ['dizzy_unwell'], stopped: 'stopped_symptoms', holdId: 'h' }, 't');
    expect(record.outcome).toBe('stopped_symptoms');
    expect(record.performed[0]!.sets[0]!.actualReps).toBe(5);
    expect(record.creditEarned).toBe(false);
  });
});
