import { describe, expect, it } from 'vitest';
import { SETUP_ITEM_IDS } from '../domain/types';
import {
  answerNextDayCheck,
  commitScreening,
  ensureReturnMode,
  finishSession,
  recordProfessionalAdvice,
  setSetupItem,
  startSession,
  stopSession,
  submitRescreen,
  updateActiveSession,
  type Ctx,
} from './actions';
import { createInitialAppData } from './defaults';
import type { AppData } from './schema';
import { dueNextDayChecks, programAccess, stageOfferFor, todayOptions } from './selectors';
import { finishWarmup, nextPendingSet, recordSet } from '../program/session';
import { CLEAR_ANSWERS, approvedAdvice } from '../../tests/factories';
import { addDays } from '../lib/dates';

let n = 0;
function ctxOn(today: string, hour = '21:00'): Ctx {
  return { now: `${today}T${hour}:00.000Z`, today, newId: () => `id-${++n}` };
}
// 2026-11-03 is a Tuesday.
const TUE = '2026-11-03';

function readyData(): AppData {
  let d = createInitialAppData(ctxOn(TUE).now);
  d = { ...d, profile: { ...d.profile, optedIn: true } };
  d = commitScreening(d, CLEAR_ANSWERS, {}, true, ctxOn(TUE));
  d = recordProfessionalAdvice(d, approvedAdvice(), ctxOn(TUE));
  for (const item of SETUP_ITEM_IDS) d = setSetupItem(d, item, 'yes', ctxOn(TUE));
  return d;
}

const NO_CHANGE = { newOrWorse: 'no' as const, emergencySigns: null, urgentSigns: null };

function doFullSession(d: AppData, today: string, feeling: 'comfortable' | 'too_much' = 'comfortable'): AppData {
  const started = startSession(d, 'full', NO_CHANGE, ctxOn(today));
  if (started.kind !== 'started') throw new Error(`not started: ${started.kind}`);
  let data = updateActiveSession(started.data, (a) => finishWarmup(a, 'done', ctxOn(today).now), ctxOn(today));
  for (let p = nextPendingSet(data.activeSession!); p; p = nextPendingSet(data.activeSession!)) {
    const target = data.activeSession!.performed[p.exerciseIndex]!.sets[p.setIndex]!.targetReps;
    const pp = p;
    data = updateActiveSession(data, (a) => recordSet(a, pp.exerciseIndex, pp.setIndex, target, ctxOn(today).now), ctxOn(today));
  }
  return finishSession(data, { feeling, controlledMovement: 'yes', couldDoMore: feeling === 'comfortable' ? 'yes' : 'no', effort: null, note: null }, ctxOn(today));
}

describe('starting a practice', () => {
  it('a fresh install cannot start any practice: assessment pending (case 25)', () => {
    let d = createInitialAppData(ctxOn(TUE).now);
    d = commitScreening(d, CLEAR_ANSWERS, {}, true, ctxOn(TUE));
    for (const item of SETUP_ITEM_IDS) d = setSetupItem(d, item, 'yes', ctxOn(TUE));
    expect(startSession(d, 'full', NO_CHANGE, ctxOn(TUE)).kind).toBe('blocked');
    expect(startSession(d, 'tiny', NO_CHANGE, ctxOn(TUE)).kind).toBe('blocked');
    expect(programAccess(d, TUE).blockedBy).toBe('assessment_pending');
  });

  it('an emergency screening answer blocks every entry and records a hold (case 1)', () => {
    let d = readyData();
    d = commitScreening(d, { ...CLEAR_ANSWERS, emergencySigns: 'yes' }, {}, false, ctxOn(TUE));
    expect(programAccess(d, TUE).state).toBe('emergency_stop');
    expect(d.holds.filter((h) => h.resolvedAt === null)).toHaveLength(1);
    expect(startSession(d, 'full', NO_CHANGE, ctxOn(TUE)).kind).toBe('blocked');
    expect(startSession(d, 'tiny', NO_CHANGE, ctxOn(TUE)).kind).toBe('blocked');
  });

  it('a resumed session cannot continue once an emergency is recorded (case 1)', () => {
    const started = startSession(readyData(), 'full', NO_CHANGE, ctxOn(TUE));
    if (started.kind !== 'started') throw new Error('expected start');
    const emergency = commitScreening(started.data, { ...CLEAR_ANSWERS, emergencySigns: 'yes' }, {}, false, ctxOn(TUE));
    expect(() => updateActiveSession(emergency, (a) => finishWarmup(a, 'done', 'x'), ctxOn(TUE))).toThrow();
  });

  it('check-in "yes" creates a hold; a later "no new change" or tiny session cannot bypass it (case 2)', () => {
    const held = startSession(readyData(), 'full', { newOrWorse: 'yes', emergencySigns: 'no', urgentSigns: 'no' }, ctxOn(TUE));
    expect(held.kind).toBe('held');
    const later = ctxOn(addDays(TUE, 3));
    expect(startSession(held.data, 'full', NO_CHANGE, later).kind).toBe('blocked');
    expect(startSession(held.data, 'tiny', NO_CHANGE, later).kind).toBe('blocked');
  });

  it('only one practice a day and no catch-up after missed days (case 10)', () => {
    const d = doFullSession(readyData(), TUE);
    expect(startSession(d, 'full', NO_CHANGE, ctxOn(TUE)).kind).toBe('blocked');
    expect(startSession(d, 'tiny', NO_CHANGE, ctxOn(addDays(TUE, 1))).kind).toBe('blocked');
  });
});

describe('after a practice', () => {
  it('asks about the next day on the next opening, then can offer — never automatically (cases 7, 26)', () => {
    let d = doFullSession(readyData(), TUE);
    expect(dueNextDayChecks(d, TUE)).toHaveLength(0);
    const fri = addDays(TUE, 3);
    expect(dueNextDayChecks(d, fri)).toHaveLength(1);
    d = answerNextDayCheck(d, d.sessions[0]!.id, 'usual', ctxOn(fri));
    d = doFullSession(d, fri);
    expect(d.stage).toBe(1);
    expect(stageOfferFor(d, fri)).toMatchObject({ kind: 'hold', holdReason: 'next_day_missing' });
    const tue2 = addDays(TUE, 7);
    d = answerNextDayCheck(d, d.sessions[1]!.id, 'usual', ctxOn(tue2));
    expect(stageOfferFor(d, tue2)).toMatchObject({ kind: 'offer', fromStage: 1, toStage: 2 });
    expect(d.stage).toBe(1); // still the person's choice
  });

  it('a worse next day pauses practice until advice', () => {
    let d = doFullSession(readyData(), TUE);
    d = answerNextDayCheck(d, d.sessions[0]!.id, 'worse', ctxOn(addDays(TUE, 1)));
    expect(programAccess(d, addDays(TUE, 3)).canStartFull).toBe(false);
    expect(d.programStatus).toBe('paused_for_review');
  });

  it('stopping for symptoms saves partial work and creates the right hold; no substitute is offered', () => {
    const started = startSession(readyData(), 'full', NO_CHANGE, ctxOn(TUE));
    if (started.kind !== 'started') throw new Error('expected start');
    let d = updateActiveSession(started.data, (a) => finishWarmup(a, 'done', 'x'), ctxOn(TUE));
    d = updateActiveSession(d, (a) => recordSet(a, 0, 0, 5, 'x'), ctxOn(TUE));
    const stopped = stopSession(d, 'numb_weak_spreading', ctxOn(TUE));
    expect(stopped.hold?.state).toBe('urgent_assessment');
    expect(stopped.data.activeSession).toBeNull();
    expect(stopped.data.sessions[0]!.outcome).toBe('stopped_symptoms');
    expect(stopped.data.sessions[0]!.performed[0]!.sets[0]!.actualReps).toBe(5);
    expect(todayOptions(stopped.data, addDays(TUE, 3)).canStartTiny).toBe(false);
  });

  it('"just stop" is always fine and creates no hold', () => {
    const started = startSession(readyData(), 'tiny', NO_CHANGE, ctxOn(TUE));
    if (started.kind !== 'started') throw new Error('expected start');
    const stopped = stopSession(started.data, 'just_stop', ctxOn(TUE));
    expect(stopped.hold).toBeNull();
    expect(stopped.data.sessions[0]!.outcome).toBe('stopped_choice');
  });
});

describe('return-to-program flow', () => {
  it('requires medical advice and fresh answers to clear an advice hold', () => {
    const held = startSession(readyData(), 'full', { newOrWorse: 'yes', emergencySigns: 'no', urgentSigns: 'no' }, ctxOn(TUE));
    const noAdvice = submitRescreen(held.data, { answers: CLEAR_ANSWERS, talkedToProfessional: 'no', professionalSaid: null, note: '' }, ctxOn(addDays(TUE, 2)));
    expect(programAccess(noAdvice.data, addDays(TUE, 3)).canStartFull).toBe(false);
    const advised = submitRescreen(noAdvice.data, { answers: CLEAR_ANSWERS, talkedToProfessional: 'yes', professionalSaid: 'ok_to_continue', note: 'GP said OK' }, ctxOn(addDays(TUE, 2)));
    expect(advised.data.programStatus).toBe('reviewed_for_use');
    expect(programAccess(advised.data, addDays(TUE, 3)).canStartFull).toBe(true);
  });
});

describe('long gap', () => {
  it('starts a Stage 1 return after ≥14 days, never above the last comfortable stage (case 30)', () => {
    let d = readyData();
    d = { ...d, stage: 4, progression: { ...d.progression, lastComfortableStage: 3 } };
    d = doFullSession(d, TUE);
    const later = addDays(TUE, 20);
    d = ensureReturnMode(d, ctxOn(later));
    expect(d.stage).toBe(1);
    expect(d.progression.returnMode?.targetStage).toBe(3);
    const started = startSession(d, 'full', NO_CHANGE, ctxOn(later));
    if (started.kind !== 'started') throw new Error('expected start');
    expect(started.data.activeSession!.prescription.mode).toBe('return');
    expect(started.data.activeSession!.prescription.items.every((i) => i.sets === 1 && i.reps === 5)).toBe(true);
  });
});
