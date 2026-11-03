import { describe, expect, it } from 'vitest';
import programJson from '../content/program.json';
import { PROGRAM, parseProgramDefinition } from '../content/program';
import { EXERCISE_IDS, PROGRAM_ID, STAGES } from '../domain/types';
import { ProgramContentError, getFixedStagePrescription, getTinySessionPrescription } from './prescription';

// The supplied stage table, written out independently of the JSON so the
// test catches any divergence (acceptance case 8).
const EXPECTED: Record<number, Array<[number, number]>> = {
  1: [[1, 5], [1, 5], [1, 5], [1, 5]],
  2: [[1, 8], [1, 8], [1, 8], [1, 8]],
  3: [[2, 8], [1, 8], [1, 8], [1, 8]],
  4: [[2, 8], [2, 8], [1, 8], [1, 8]],
  5: [[2, 8], [2, 8], [2, 8], [1, 8]],
  6: [[2, 8], [2, 8], [2, 8], [2, 8]],
  7: [[2, 10], [2, 10], [2, 10], [2, 10]],
  8: [[2, 10], [2, 10], [2, 10], [2, 10]],
};

describe('getFixedStagePrescription — reads only the supplied stage table', () => {
  it.each(STAGES)('stage %i matches the supplied table exactly (case 8)', (stage) => {
    const p = getFixedStagePrescription(PROGRAM_ID, stage);
    expect(p.items.map((i) => i.exerciseId)).toEqual([...EXERCISE_IDS]);
    expect(p.items.map((i) => [i.sets, i.reps])).toEqual(EXPECTED[stage]);
    expect(p.addedLoadKg).toBe(0);
    expect(p.stage).toBe(stage);
  });

  it('stages 3–6 each add exactly one set to exactly the specified exercise, in order', () => {
    for (const [from, changedIndex] of [[2, 0], [3, 1], [4, 2], [5, 3]] as const) {
      const a = getFixedStagePrescription(PROGRAM_ID, from);
      const b = getFixedStagePrescription(PROGRAM_ID, from + 1);
      a.items.forEach((item, i) => {
        expect(b.items[i]!.reps).toBe(item.reps);
        expect(b.items[i]!.sets).toBe(i === changedIndex ? item.sets + 1 : item.sets);
      });
    }
  });

  it('1→2 and 6→7 change repetitions across the routine only', () => {
    expect(getFixedStagePrescription(PROGRAM_ID, 2).items.every((i) => i.reps === 8 && i.sets === 1)).toBe(true);
    expect(getFixedStagePrescription(PROGRAM_ID, 7).items.every((i) => i.reps === 10 && i.sets === 2)).toBe(true);
  });

  it('the program JSON in the app is byte-for-byte the supplied structure', () => {
    expect(programJson.stageDoses).toEqual([
      { stage: 1, sets: [1, 1, 1, 1], reps: [5, 5, 5, 5] },
      { stage: 2, sets: [1, 1, 1, 1], reps: [8, 8, 8, 8] },
      { stage: 3, sets: [2, 1, 1, 1], reps: [8, 8, 8, 8] },
      { stage: 4, sets: [2, 2, 1, 1], reps: [8, 8, 8, 8] },
      { stage: 5, sets: [2, 2, 2, 1], reps: [8, 8, 8, 8] },
      { stage: 6, sets: [2, 2, 2, 2], reps: [8, 8, 8, 8] },
      { stage: 7, sets: [2, 2, 2, 2], reps: [10, 10, 10, 10] },
      { stage: 8, sets: [2, 2, 2, 2], reps: [10, 10, 10, 10] },
    ]);
    expect(programJson.automaticAddedLoadKg).toBe(0);
    expect(programJson.tinySessionCountsForProgression).toBe(false);
    expect(programJson.initialStatus).toBe('assessment_pending');
  });

  it('fails closed on an unsupported stage — including stage 9 (cases 8, 29)', () => {
    for (const bad of [0, 9, 1.5, -1, Number.NaN]) {
      expect(() => getFixedStagePrescription(PROGRAM_ID, bad)).toThrow(ProgramContentError);
    }
  });

  it('fails closed on an unsupported program ID', () => {
    expect(() => getFixedStagePrescription('another-program', 1)).toThrow(ProgramContentError);
  });

  it('rejects malformed program content instead of guessing', () => {
    const broken = structuredClone(programJson) as Record<string, unknown>;
    (broken.stageDoses as unknown[]).push({ stage: 9, sets: [3, 3, 3, 3], reps: [12, 12, 12, 12] });
    expect(() => parseProgramDefinition(broken)).toThrow();
    const loaded = structuredClone(programJson) as Record<string, unknown>;
    loaded.automaticAddedLoadKg = 2.5;
    expect(() => parseProgramDefinition(loaded)).toThrow();
  });

  it('side leg lift reps are per side and never halved or combined (case 28)', () => {
    for (const stage of STAGES) {
      const p = getFixedStagePrescription(PROGRAM_ID, stage);
      const side = p.items.find((i) => i.exerciseId === 'supported-side-leg-lift')!;
      expect(side.perSide).toBe(true);
      expect(side.reps).toBe(EXPECTED[stage]![3]![1]);
      expect(p.items.filter((i) => i.perSide)).toHaveLength(1);
    }
  });

  it('no elbow curls, dumbbells or other reference-only exercises in any stage (case 27)', () => {
    const ids = new Set<string>();
    for (const stage of STAGES) getFixedStagePrescription(PROGRAM_ID, stage).items.forEach((i) => ids.add(i.exerciseId));
    getTinySessionPrescription(PROGRAM_ID, 1).items.forEach((i) => ids.add(i.exerciseId));
    expect([...ids].sort()).toEqual([...EXERCISE_IDS].sort());
    expect([...ids].some((id) => /curl|dumbbell|row|carry|press-overhead|deadlift|goblet/i.test(id))).toBe(false);
  });

  it('never creates a kilogram prescription (case 6)', () => {
    // The prescription API has no equipment input at all; every stage is unloaded.
    for (const stage of STAGES) {
      const p = getFixedStagePrescription(PROGRAM_ID, stage);
      expect(p.addedLoadKg).toBe(0);
      // Items carry only the movement, sets, reps and side flag — no weight of any kind.
      for (const item of p.items) expect(Object.keys(item).sort()).toEqual(['exerciseId', 'perSide', 'reps', 'sets']);
      const { addedLoadKg: _ignored, ...rest } = p;
      expect(JSON.stringify(rest)).not.toMatch(/kg|weight|load/i);
    }
  });

  it('stage 8 is maintenance at the same dose as stage 7, with no stage 9 (case 29)', () => {
    expect(getFixedStagePrescription(PROGRAM_ID, 8).items).toEqual(getFixedStagePrescription(PROGRAM_ID, 7).items);
    expect(PROGRAM.stageDoses).toHaveLength(8);
  });
});

describe('tiny session', () => {
  it('the tiny session is exactly 3 sit-to-stands and 3 wall presses with ≥60 s rest', () => {
    const p = getTinySessionPrescription(PROGRAM_ID, 4);
    expect(p.mode).toBe('tiny');
    expect(p.items).toEqual([
      { exerciseId: 'chair-sit-to-stand', sets: 1, reps: 3, perSide: false },
      { exerciseId: 'wall-press-up', sets: 1, reps: 3, perSide: false },
    ]);
    expect(p.minimumRestSeconds).toBe(60);
  });

});
