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

function start(stage: 1 | 6 = 6) {
  return createActiveSession({
    id: 'a1',
    prescription: getFixedStagePrescription(PROGRAM_ID, stage),
    planStage: stage,
    now: '2026-11-03T00:00:00.000Z',
    localDate: '2026-11-03',
    timezone: 'Pacific/Auckland',
  });
}

describe('session recording', () => {
  it('expands side leg lift into explicit left and right sets, per side (case 28)', () => {
    const side = start(6).performed[3]!;
    expect(side.sets.map((s) => [s.setNumber, s.side, s.targetReps])).toEqual([
      [1, 'left', 8], [1, 'right', 8], [2, 'left', 8], [2, 'right', 8],
    ]);
  });

  it('starts with the optional warm-up for full sessions, but not for the tiny session', () => {
    expect(start().phase).toBe('warmup');
    const tiny = createActiveSession({ id: 't', prescription: getTinySessionPrescription(PROGRAM_ID, 1), planStage: 1, now: 'n', localDate: '2026-11-03', timezone: 'Pacific/Auckland' });
    expect(tiny.phase).toBe('exercise');
  });

  it('elapsed time and rest timers never create completed reps (case 11)', () => {
    let a = finishWarmup(start(), 'done', '2026-11-03T00:02:00.000Z');
    a = startRestTimer(a, '2026-11-03T00:03:00.000Z');
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

  it('fewer reps and skipped movements are saved as partial — never the full amount', () => {
    let a = finishWarmup(start(1), 'skipped', 't');
    a = recordSet(a, 0, 0, 5, 't');
    a = recordSet(a, 1, 0, 2, 't');
    a = skipExercise(a, 2, 't');
    a = recordSet(a, 3, 0, 5, 't');
    a = recordSet(a, 3, 1, 5, 't');
    expect(a.phase).toBe('finish');
    expect(isFullDose(a.performed, a.prescription)).toBe(false);
    const record = finalizeSession(a, { stopped: false }, 't2');
    expect(record.outcome).toBe('partial');
    expect(record.creditEarned).toBe(false);
  });

  it('a complete full practice earns credit; a tiny one never does (case 26)', () => {
    let a = finishWarmup(start(1), 'done', 't');
    for (let p = nextPendingSet(a); p; p = nextPendingSet(a)) a = recordSet(a, p.exerciseIndex, p.setIndex, a.performed[p.exerciseIndex]!.sets[p.setIndex]!.targetReps, 't');
    expect(finalizeSession(a, { stopped: false }, 't').creditEarned).toBe(true);
    let tiny = createActiveSession({ id: 't', prescription: getTinySessionPrescription(PROGRAM_ID, 1), planStage: 1, now: 'n', localDate: '2026-11-03', timezone: 'Pacific/Auckland' });
    tiny = recordSet(tiny, 0, 0, 3, 't');
    tiny = recordSet(tiny, 1, 0, 3, 't');
    const record = finalizeSession(tiny, { stopped: false }, 't');
    expect(record.outcome).toBe('full_dose');
    expect(record.creditEarned).toBe(false);
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
    const record = finalizeSession(a, { stopped: true }, 't');
    expect(record.outcome).toBe('stopped');
    expect(record.performed[0]!.sets[0]!.actualReps).toBe(5);
    expect(record.creditEarned).toBe(false);
  });
});
