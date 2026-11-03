import { describe, expect, it } from 'vitest';
import { acceptStageOffer, finishSession, keepCurrentAmount, setStage, startAgainAtStageOne, startSession, stopSession, updateActiveSession, type Ctx } from './actions';
import type { AppData } from './schema';
import { gapSuggestionFor, stageOfferFor, todayOptions } from './selectors';
import { finishWarmup, nextPendingSet, recordSet } from '../program/session';
import { addDays } from '../lib/dates';
import { startedData } from '../../tests/appStates';

let n = 0;
function ctxOn(today: string): Ctx {
  return { now: `${today}T00:00:00.000Z`, today, newId: () => `id-${++n}` };
}
// 2026-11-03 is a Tuesday (a default practice day).
const TUE = '2026-11-03';

function doFullPractice(d: AppData, today: string): AppData {
  const started = startSession(d, 'full', ctxOn(today));
  if (started.kind !== 'started') throw new Error(`not started: ${started.reason}`);
  let data = updateActiveSession(started.data, (a) => finishWarmup(a, 'done', ctxOn(today).now), ctxOn(today));
  for (let p = nextPendingSet(data.activeSession!); p; p = nextPendingSet(data.activeSession!)) {
    const target = data.activeSession!.performed[p.exerciseIndex]!.sets[p.setIndex]!.targetReps;
    const pp = p;
    data = updateActiveSession(data, (a) => recordSet(a, pp.exerciseIndex, pp.setIndex, target, ctxOn(today).now), ctxOn(today));
  }
  return finishSession(data, ctxOn(today));
}

describe('practice is available straight away — no questions, no approval step', () => {
  it('a fresh install can start a full or smaller practice immediately', () => {
    const d = startedData();
    expect(todayOptions(d, TUE)).toMatchObject({ canStartFull: true, canStartTiny: true });
    const started = startSession(d, 'full', ctxOn(TUE));
    expect(started.kind).toBe('started');
    if (started.kind === 'started') expect(started.data.activeSession?.prescription.items.map((i) => [i.sets, i.reps])).toEqual([[1, 5], [1, 5], [1, 5], [1, 5]]);
  });

  it('stopping saves what was done and never locks the next practice', () => {
    const started = startSession(startedData(), 'full', ctxOn(TUE));
    if (started.kind !== 'started') throw new Error('expected start');
    let d = updateActiveSession(started.data, (a) => finishWarmup(a, 'done', 'x'), ctxOn(TUE));
    d = updateActiveSession(d, (a) => recordSet(a, 0, 0, 5, 'x'), ctxOn(TUE));
    d = stopSession(d, ctxOn(TUE));
    expect(d.activeSession).toBeNull();
    expect(d.sessions[0]).toMatchObject({ outcome: 'stopped', creditEarned: false });
    expect(d.sessions[0]!.performed[0]!.sets[0]!.actualReps).toBe(5);
    // Friday is the next practice day, and practice is available again.
    expect(todayOptions(d, addDays(TUE, 3)).canStartFull).toBe(true);
  });

  it('one practice a day and no catch-up after missed days (case 10)', () => {
    const d = doFullPractice(startedData(), TUE);
    expect(startSession(d, 'full', ctxOn(TUE)).kind).toBe('blocked');
    expect(startSession(d, 'tiny', ctxOn(addDays(TUE, 1))).kind).toBe('blocked');
  });
});

describe('stages follow the supplied table and the person’s choice', () => {
  it('two full practices → an offer; accepting applies exactly the next stage', () => {
    let d = doFullPractice(startedData(), TUE);
    expect(stageOfferFor(d)).toMatchObject({ kind: 'hold', fullPractices: 1 });
    d = doFullPractice(d, addDays(TUE, 3));
    const offer = stageOfferFor(d);
    expect(offer).toMatchObject({ kind: 'offer', fromStage: 1, toStage: 2 });
    expect(d.stage).toBe(1);
    expect(keepCurrentAmount(d, offer, ctxOn(TUE)).stage).toBe(1);
    expect(acceptStageOffer(d, offer, ctxOn(TUE)).stage).toBe(2);
  });

  it('she can pick a stage on the Plan page, but not mid-practice', () => {
    const d = startedData();
    expect(setStage(d, 3, ctxOn(TUE)).stage).toBe(3);
    const started = startSession(d, 'full', ctxOn(TUE));
    if (started.kind !== 'started') throw new Error('expected start');
    expect(() => setStage(started.data, 3, ctxOn(TUE))).toThrow();
  });

  it('after 14+ days at a higher stage, starting again at Stage 1 is offered — only applied if tapped', () => {
    let d: AppData = { ...startedData(), stage: 4 };
    d = doFullPractice(d, TUE);
    const later = addDays(TUE, 21);
    expect(gapSuggestionFor(d, later)).toEqual({ gapDays: 21, currentStage: 4 });
    expect(d.stage).toBe(4);
    expect(startAgainAtStageOne(d, ctxOn(later)).stage).toBe(1);
  });
});
