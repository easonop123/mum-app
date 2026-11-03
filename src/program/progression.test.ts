import { describe, expect, it } from 'vitest';
import { STAGES, type NextDayCheck, type Plan, type SessionRecord } from '../domain/types';
import {
  applyNextDayToPlan,
  applySessionToPlan,
  applyUserAcceptedStage,
  declineStageOffer,
  getNextStageOffer,
  ProgressionError,
  type ProgressionContext,
} from './progression';
import { answeredCheck, makePlan, makeSession, pendingCheck } from '../../tests/factories';

const OK: ProgressionContext = {
  programStatus: 'reviewed_for_use',
  hasUnresolvedHold: false,
  safetyState: 'clinician_guided_plan',
  progressionApproved: 'yes',
  maxStage: null,
};

/** Two credited full sessions at `stage`, with the given next-day responses. */
function twoCredited(stage: Plan['stage'], responses: Array<NextDayCheck['response'] | 'pending'> = ['usual', 'usual']) {
  const s1 = makeSession({ stage, localDate: '2026-11-17' });
  const s2 = makeSession({ stage, localDate: '2026-11-20' });
  let plan = makePlan({ stage });
  plan = applySessionToPlan(plan, s1, s1.endedAt);
  plan = applySessionToPlan(plan, s2, s2.endedAt);
  const checks: NextDayCheck[] = [s1, s2].map((s, i) => {
    const r = responses[i];
    return r === 'pending' || r === undefined || r === null ? pendingCheck(s.id, s.localDate) : answeredCheck(s.id, s.localDate, r);
  });
  return { plan, sessions: [s1, s2], checks };
}

describe('getNextStageOffer — exact stage-transition rules', () => {
  it('credits only comfortable, controlled, full-dose FULL sessions', () => {
    const { plan, sessions } = twoCredited(1);
    expect(plan.stageFullSessionCredits).toEqual(sessions.map((s) => s.id));
  });

  it('offers only the next supplied stage, defaulting to "keep"', () => {
    const { plan, sessions, checks } = twoCredited(3);
    const offer = getNextStageOffer({ plan, sessions }, checks, OK);
    expect(offer).toMatchObject({ kind: 'offer', fromStage: 3, toStage: 4, defaultChoice: 'keep' });
  });

  it('two comfortable exposures alone never auto-advance; missing next-day feedback holds (case 7)', () => {
    const { plan, sessions, checks } = twoCredited(1, ['usual', 'pending']);
    const offer = getNextStageOffer({ plan, sessions }, checks, OK);
    expect(offer).toMatchObject({ kind: 'hold', holdReason: 'next_day_missing' });
    expect(plan.stage).toBe(1); // nothing changed by computing an offer
    expect(getNextStageOffer({ plan, sessions }, [], OK)).toMatchObject({ kind: 'hold', holdReason: 'next_day_missing' });
  });

  it('"can\'t remember" counts as missing information → hold', () => {
    const { plan, sessions, checks } = twoCredited(1, ['usual', 'cant_remember']);
    expect(getNextStageOffer({ plan, sessions }, checks, OK)).toMatchObject({ kind: 'hold', holdReason: 'next_day_missing' });
  });

  it('a worse next day blocks the offer', () => {
    const { plan, sessions, checks } = twoCredited(1, ['usual', 'worse']);
    expect(getNextStageOffer({ plan, sessions }, checks, OK)).toMatchObject({ kind: 'hold', holdReason: 'next_day_not_usual' });
  });

  it('a safety hold or non-workout state blocks offers (case 7)', () => {
    const { plan, sessions, checks } = twoCredited(1);
    expect(getNextStageOffer({ plan, sessions }, checks, { ...OK, hasUnresolvedHold: true })).toMatchObject({ kind: 'hold', holdReason: 'safety_hold' });
    expect(getNextStageOffer({ plan, sessions }, checks, { ...OK, safetyState: 'review_before_program' })).toMatchObject({ kind: 'hold' });
    expect(getNextStageOffer({ plan, sessions }, checks, { ...OK, programStatus: 'assessment_pending' })).toMatchObject({ kind: 'hold', holdReason: 'program_not_reviewed' });
  });

  it('progression needs recorded approval and respects a recorded maximum stage', () => {
    const { plan, sessions, checks } = twoCredited(2);
    expect(getNextStageOffer({ plan, sessions }, checks, { ...OK, progressionApproved: 'not_discussed' })).toMatchObject({ holdReason: 'progression_not_approved' });
    expect(getNextStageOffer({ plan, sessions }, checks, { ...OK, maxStage: 2 })).toMatchObject({ holdReason: 'max_stage' });
  });

  it('tiny and partial sessions never earn credit (case 26)', () => {
    let plan = makePlan({ stage: 1 });
    const tiny1 = makeSession({ mode: 'tiny', localDate: '2026-11-17' });
    const tiny2 = makeSession({ mode: 'tiny', localDate: '2026-11-20' });
    const partial = makeSession({ localDate: '2026-11-24', repsFor: (t) => t - 1 });
    for (const s of [tiny1, tiny2, partial]) plan = applySessionToPlan(plan, s, s.endedAt);
    expect(tiny1.creditEarned || tiny2.creditEarned || partial.creditEarned).toBe(false);
    expect(partial.outcome).toBe('partial');
    expect(plan.stageFullSessionCredits).toEqual([]);
    const checks = [tiny1, tiny2, partial].map((s) => answeredCheck(s.id, s.localDate, 'usual'));
    expect(getNextStageOffer({ plan, sessions: [tiny1, tiny2, partial] }, checks, OK)).toMatchObject({ holdReason: 'need_more_sessions' });
  });

  it('sessions without controlled movement or spare repetitions do not earn credit', () => {
    expect(makeSession({ localDate: '2026-11-17', controlled: 'unsure' }).creditEarned).toBe(false);
    expect(makeSession({ localDate: '2026-11-17', couldDoMore: 'no' }).creditEarned).toBe(false);
  });

  it('stage 8 is maintenance with a program-review invitation — never stage 9 (case 29)', () => {
    const { plan, sessions, checks } = twoCredited(8);
    const offer = getNextStageOffer({ plan, sessions }, checks, OK);
    expect(offer.kind).toBe('maintenance');
    expect(JSON.stringify(offer)).not.toMatch(/"toStage":9|kg/);
  });

  it('every reachable offer is exactly +1 within the supplied 8 stages', () => {
    for (const stage of STAGES.slice(0, 7)) {
      const { plan, sessions, checks } = twoCredited(stage);
      const offer = getNextStageOffer({ plan, sessions }, checks, OK);
      expect(offer).toMatchObject({ kind: 'offer', toStage: stage + 1 });
    }
  });
});

describe('accepting and declining', () => {
  it('accepting applies exactly the next stage and resets credits', () => {
    const { plan, sessions, checks } = twoCredited(5);
    const offer = getNextStageOffer({ plan, sessions }, checks, OK);
    const next = applyUserAcceptedStage(plan, offer, '2026-11-21T00:00:00.000Z');
    expect(next.stage).toBe(6);
    expect(next.stageFullSessionCredits).toEqual([]);
    expect(next.progression.lastComfortableStage).toBe(5);
    expect(next.progression.stageChanges.at(-1)).toMatchObject({ from: 5, to: 6, reason: 'user_accepted_offer' });
  });

  it('stale or non-offers fail closed', () => {
    const { plan, sessions, checks } = twoCredited(2);
    const offer = getNextStageOffer({ plan, sessions }, checks, OK);
    expect(() => applyUserAcceptedStage({ ...plan, stage: 3 }, offer, 'x')).toThrow(ProgressionError);
    expect(() => applyUserAcceptedStage(plan, { kind: 'hold', stage: 2, holdReason: 'need_more_sessions', reasons: [] }, 'x')).toThrow(ProgressionError);
    expect(() => applyUserAcceptedStage(plan, { ...(offer as Extract<typeof offer, { kind: 'offer' }>), toStage: 4 }, 'x')).toThrow(ProgressionError);
  });

  it('declining preserves the plan, with positive copy and no repeat nagging (case 9)', () => {
    const { plan, sessions, checks } = twoCredited(2);
    const offer = getNextStageOffer({ plan, sessions }, checks, OK);
    const kept = declineStageOffer(plan, offer, '2026-11-21T00:00:00.000Z');
    expect(kept.stage).toBe(2);
    expect(kept.stageFullSessionCredits).toEqual(plan.stageFullSessionCredits);
    const after = getNextStageOffer({ plan: kept, sessions }, checks, OK);
    expect(after).toMatchObject({ kind: 'hold', holdReason: 'kept_amount' });
    const text = after.reasons.map((r) => `${r.en} ${r.zh}`).join(' ');
    expect(text).toMatch(/completely fine/);
    expect(text).toContain('可以保持这个量');
    expect(text).not.toMatch(/fail|lazy|missed|失败|清零/i);
  });
});

describe('applySessionToPlan', () => {
  it('"too much" without symptoms returns to the previous comfortable stage next time', () => {
    const plan = makePlan({ stage: 4 }, { lastComfortableStage: 3 });
    const hard = makeSession({ stage: 4, localDate: '2026-11-24', feeling: 'too_much', repsFor: (t) => t - 2 });
    const next = applySessionToPlan(plan, hard, hard.endedAt);
    expect(next.stage).toBe(3);
    expect(next.progression.stageChanges.at(-1)?.reason).toBe('too_much_step_down');
  });

  it('concerning symptoms do not merely reduce the dose (holds handle them) and clear credits', () => {
    const plan = makePlan({ stage: 4, stageFullSessionCredits: ['a'] }, { lastComfortableStage: 3 });
    const s = makeSession({ stage: 4, localDate: '2026-11-24', feeling: 'new_or_worse', symptomCodes: ['back_pain_worse_sharp'] });
    const next = applySessionToPlan(plan, s, s.endedAt);
    expect(next.stage).toBe(4);
    expect(next.stageFullSessionCredits).toEqual([]);
  });

  it('a comfortable next day records the last comfortable stage', () => {
    const plan = makePlan({ stage: 2 });
    const s = makeSession({ stage: 2, localDate: '2026-11-24' });
    expect(applyNextDayToPlan(plan, s, 'usual').progression.lastComfortableStage).toBe(2);
    expect(applyNextDayToPlan(plan, s, 'worse').progression.lastComfortableStage).toBeNull();
  });

  it('tiny sessions never change the plan', () => {
    const plan = makePlan({ stage: 3 });
    const tiny: SessionRecord = makeSession({ mode: 'tiny', stage: 3, localDate: '2026-11-24' });
    expect(applySessionToPlan(plan, tiny, tiny.endedAt)).toBe(plan);
  });
});
