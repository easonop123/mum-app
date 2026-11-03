import { describe, expect, it } from 'vitest';
import { STAGES, type Plan } from '../domain/types';
import { addDays } from '../lib/dates';
import {
  LONG_GAP_DAYS,
  ProgressionError,
  applySessionToPlan,
  applyUserAcceptedStage,
  chooseStage,
  declineStageOffer,
  gapRestartSuggestion,
  getNextStageOffer,
  lastPracticeDate,
  restartAtStageOne,
} from './progression';
import { makePlan, makeSession } from '../../tests/factories';

function withFullPractices(stage: Plan['stage'], count = 2) {
  let plan = makePlan({ stage });
  const sessions = Array.from({ length: count }, (_, i) => makeSession({ stage, localDate: addDays('2026-11-03', i * 3) }));
  for (const s of sessions) plan = applySessionToPlan(plan, s);
  return { plan, sessions };
}

describe('stage offers — always the person’s choice', () => {
  it('needs two full practices at the stage before offering the next stage', () => {
    const one = withFullPractices(1, 1);
    expect(getNextStageOffer(one)).toMatchObject({ kind: 'hold', holdReason: 'need_more_sessions', fullPractices: 1 });
    const two = withFullPractices(1, 2);
    expect(getNextStageOffer(two)).toMatchObject({ kind: 'offer', fromStage: 1, toStage: 2 });
  });

  it('computing an offer never changes the stage (no automatic progression)', () => {
    const { plan, sessions } = withFullPractices(3);
    getNextStageOffer({ plan, sessions });
    expect(plan.stage).toBe(3);
  });

  it('tiny, partial and stopped practices never count (case 26)', () => {
    let plan = makePlan({ stage: 1 });
    const sessions = [
      makeSession({ mode: 'tiny', localDate: '2026-11-03' }),
      makeSession({ localDate: '2026-11-06', repsFor: (t) => t - 1 }),
      makeSession({ localDate: '2026-11-10', stopped: true }),
    ];
    for (const s of sessions) plan = applySessionToPlan(plan, s);
    expect(plan.stageFullSessionCredits).toEqual([]);
    expect(getNextStageOffer({ plan, sessions })).toMatchObject({ kind: 'hold', holdReason: 'need_more_sessions' });
  });

  it('every offer is exactly the next supplied stage; stage 8 is maintenance, never stage 9 (cases 8, 29)', () => {
    for (const stage of STAGES.slice(0, 7)) {
      expect(getNextStageOffer(withFullPractices(stage))).toMatchObject({ kind: 'offer', toStage: stage + 1 });
    }
    expect(getNextStageOffer(withFullPractices(8))).toEqual({ kind: 'maintenance', stage: 8 });
  });

  it('accepting moves exactly one stage and resets the count', () => {
    const { plan, sessions } = withFullPractices(5);
    const next = applyUserAcceptedStage(plan, getNextStageOffer({ plan, sessions }), '2026-11-20T00:00:00.000Z');
    expect(next.stage).toBe(6);
    expect(next.stageFullSessionCredits).toEqual([]);
    expect(next.progression.stageChanges.at(-1)).toMatchObject({ from: 5, to: 6, reason: 'user_accepted_offer' });
  });

  it('stale or invalid offers fail closed', () => {
    const { plan, sessions } = withFullPractices(2);
    const offer = getNextStageOffer({ plan, sessions });
    expect(() => applyUserAcceptedStage({ ...plan, stage: 3 }, offer, 'x')).toThrow(ProgressionError);
    expect(() => applyUserAcceptedStage(plan, { kind: 'maintenance', stage: 8 }, 'x')).toThrow(ProgressionError);
  });

  it('"Keep this amount" preserves the plan and is not asked again for the same practices (case 9)', () => {
    const { plan, sessions } = withFullPractices(2);
    const offer = getNextStageOffer({ plan, sessions });
    const kept = declineStageOffer(plan, offer, '2026-11-20T00:00:00.000Z');
    expect(kept.stage).toBe(2);
    expect(getNextStageOffer({ plan: kept, sessions })).toMatchObject({ kind: 'hold', holdReason: 'kept_amount' });
    // After another full practice, the choice is offered again.
    const more = makeSession({ stage: 2, localDate: '2026-11-24' });
    expect(getNextStageOffer({ plan: applySessionToPlan(kept, more), sessions: [...sessions, more] }).kind).toBe('offer');
  });

  it('the person can choose any supplied stage herself, and only those', () => {
    const plan = makePlan({ stage: 4 });
    expect(chooseStage(plan, 2, 'now').stage).toBe(2);
    expect(chooseStage(plan, 7, 'now').progression.stageChanges.at(-1)).toMatchObject({ from: 4, to: 7, reason: 'manual' });
    expect(() => chooseStage(plan, 9, 'now')).toThrow(ProgressionError);
    expect(() => chooseStage(plan, 0, 'now')).toThrow(ProgressionError);
  });
});

describe('after a long break (case 30)', () => {
  it('suggests (never forces) starting again at Stage 1 after 14 days or more', () => {
    const plan = makePlan({ stage: 5 });
    const last = makeSession({ stage: 5, localDate: '2026-11-03' });
    expect(gapRestartSuggestion(plan, [last], addDays('2026-11-03', LONG_GAP_DAYS - 1))).toBeNull();
    expect(gapRestartSuggestion(plan, [last], addDays('2026-11-03', LONG_GAP_DAYS))).toEqual({ gapDays: 14, currentStage: 5 });
    const restarted = restartAtStageOne(plan, 'now');
    expect(restarted.stage).toBe(1);
    expect(restarted.progression.stageChanges.at(-1)?.reason).toBe('gap_restart');
  });

  it('no suggestion at Stage 1, before any practice, or from tiny practices alone', () => {
    expect(gapRestartSuggestion(makePlan({ stage: 1 }), [makeSession({ localDate: '2026-10-01' })], '2026-11-30')).toBeNull();
    expect(gapRestartSuggestion(makePlan({ stage: 3 }), [], '2026-11-30')).toBeNull();
    const tiny = makeSession({ mode: 'tiny', stage: 3, localDate: '2026-11-25' });
    const full = makeSession({ stage: 3, localDate: '2026-11-01' });
    expect(lastPracticeDate([full, tiny])).toBe('2026-11-01');
  });
});
