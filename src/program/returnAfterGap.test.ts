import { describe, expect, it } from 'vitest';
import { STAGES, type Stage } from '../domain/types';
import { addDays } from '../lib/dates';
import { applyNextDayToPlan, applySessionToPlan, applyUserAcceptedStage, getNextStageOffer, declineStageOffer } from './progression';
import { totalTargetReps, getFixedStagePrescription } from './prescription';
import {
  buildReturnAfterGapSuggestion,
  lastPracticeDate,
  prescriptionForNextPractice,
  startLongGapReturn,
} from './returnAfterGap';
import { answeredCheck, makePlan, makeSession } from '../../tests/factories';

const LAST = '2026-11-03';

describe('buildReturnAfterGapSuggestion — supplied 14-day rule (case 30)', () => {
  it('first time ever → current stage, no gap logic', () => {
    expect(buildReturnAfterGapSuggestion(makePlan({ stage: 1 }), [], null, LAST).kind).toBe('first_time');
  });

  it('normal spacing (< 7 days) → regular session at the current stage', () => {
    const s = makeSession({ stage: 3, localDate: LAST });
    const r = buildReturnAfterGapSuggestion(makePlan({ stage: 3 }, { lastComfortableStage: 3 }), [s], null, addDays(LAST, 4));
    expect(r).toMatchObject({ kind: 'regular', stage: 3 });
  });

  it('7–13 days → previous comfortable stage with a do-less option', () => {
    const s = makeSession({ stage: 5, localDate: LAST });
    for (const gap of [7, 10, 13]) {
      const r = buildReturnAfterGapSuggestion(makePlan({ stage: 5 }, { lastComfortableStage: 4 }), [s], null, addDays(LAST, gap));
      expect(r).toMatchObject({ kind: 'short_gap', stage: 4, doLessOption: true, gapDays: gap });
    }
  });

  it('≥ 14 days → Stage 1 return session, progression frozen, target never above the last comfortable stage', () => {
    const s = makeSession({ stage: 6, localDate: LAST });
    for (const gap of [14, 30, 200]) {
      const r = buildReturnAfterGapSuggestion(makePlan({ stage: 6 }, { lastComfortableStage: 5 }), [s], null, addDays(LAST, gap));
      expect(r).toMatchObject({ kind: 'long_gap', returnDoseStage: 1, targetStage: 5, progressionFrozen: true });
    }
  });

  it('no comfortable stage recorded → the return target is Stage 1', () => {
    const s = makeSession({ stage: 2, localDate: LAST });
    expect(buildReturnAfterGapSuggestion(makePlan({ stage: 2 }), [s], null, addDays(LAST, 20))).toMatchObject({ kind: 'long_gap', targetStage: 1 });
  });

  it('a gap never generates catch-up work (case 10)', () => {
    for (const stage of STAGES) {
      for (const gap of [1, 3, 6, 7, 13, 14, 15, 60]) {
        const s = makeSession({ stage, localDate: LAST });
        const plan = makePlan({ stage }, { lastComfortableStage: stage });
        const suggestion = buildReturnAfterGapSuggestion(plan, [s], null, addDays(LAST, gap));
        const p = prescriptionForNextPractice(plan, suggestion);
        expect(totalTargetReps(p)).toBeLessThanOrEqual(totalTargetReps(getFixedStagePrescription(plan.programId, stage)));
        expect(p.addedLoadKg).toBe(0);
      }
    }
  });

  it('tiny sessions do not reset the gap clock', () => {
    const full = makeSession({ stage: 3, localDate: LAST });
    const tiny = makeSession({ mode: 'tiny', stage: 3, localDate: addDays(LAST, 10) });
    expect(lastPracticeDate([full, tiny])).toBe(LAST);
  });

  it('a check-in that says not today wins over any gap suggestion', () => {
    const r = buildReturnAfterGapSuggestion(makePlan(), [], { state: 'review_before_program', reasons: [], standingExercisesExcluded: false, missingQuestions: [], createHold: null, mayStart: false }, LAST);
    expect(r.kind).toBe('hold');
  });
});

describe('long-gap return flow', () => {
  function startReturn(stage: Stage, lastComfortable: Stage | null) {
    const last = makeSession({ stage, localDate: LAST });
    const plan = makePlan({ stage }, { lastComfortableStage: lastComfortable });
    const suggestion = buildReturnAfterGapSuggestion(plan, [last], null, addDays(LAST, 21));
    if (suggestion.kind !== 'long_gap') throw new Error('expected long gap');
    return { plan: startLongGapReturn(plan, suggestion, '2026-11-24T00:00:00.000Z'), last };
  }

  it('freezes progression and uses the Stage 1 dose', () => {
    const { plan } = startReturn(6, 5);
    expect(plan.stage).toBe(1);
    expect(plan.progression.returnMode).toMatchObject({ targetStage: 5, status: 'awaiting_return_session' });
    const suggestion = buildReturnAfterGapSuggestion(plan, [], null, '2026-11-24');
    expect(prescriptionForNextPractice(plan, suggestion).mode).toBe('return');
    const ctx = { programStatus: 'reviewed_for_use' as const, hasUnresolvedHold: false, safetyState: 'clinician_guided_plan' as const, progressionApproved: 'yes' as const, maxStage: null };
    expect(getNextStageOffer({ plan, sessions: [] }, [], ctx)).toMatchObject({ kind: 'hold', holdReason: 'return_frozen' });
  });

  it('needs a comfortable next day before offering the last comfortable stage — never above it', () => {
    const { plan: started } = startReturn(6, 5);
    const ret = makeSession({ mode: 'return', localDate: '2026-11-24' });
    let plan = applySessionToPlan(started, ret, ret.endedAt);
    expect(plan.progression.returnMode?.status).toBe('awaiting_next_day');
    const ctx = { programStatus: 'reviewed_for_use' as const, hasUnresolvedHold: false, safetyState: 'clinician_guided_plan' as const, progressionApproved: 'yes' as const, maxStage: null };
    expect(getNextStageOffer({ plan, sessions: [ret] }, [], ctx).kind).toBe('hold');
    plan = applyNextDayToPlan(plan, ret, 'usual');
    const offer = getNextStageOffer({ plan, sessions: [ret] }, [answeredCheck(ret.id, ret.localDate, 'usual')], ctx);
    expect(offer).toMatchObject({ kind: 'return_offer', fromStage: 1, toStage: 5, defaultChoice: 'keep' });
    const accepted = applyUserAcceptedStage(plan, offer, '2026-11-26T00:00:00.000Z');
    expect(accepted.stage).toBe(5);
    expect(accepted.progression.returnMode).toBeNull();
    // Declining keeps Stage 1 and rebuilds from the supplied table.
    const kept = declineStageOffer(plan, offer, '2026-11-26T00:00:00.000Z');
    expect(kept.stage).toBe(1);
    expect(kept.progression.returnMode).toBeNull();
  });

  it('a return session that is still too demanding stays at Stage 1 and rebuilds', () => {
    const { plan: started } = startReturn(4, 4);
    const ret = makeSession({ mode: 'return', localDate: '2026-11-24', feeling: 'too_much', repsFor: (t) => t - 1 });
    const plan = applySessionToPlan(started, ret, ret.endedAt);
    expect(plan.stage).toBe(1);
    expect(plan.progression.returnMode).toBeNull();
    expect(plan.progression.lastComfortableStage).toBeNull();
  });

  it('an offer cannot be forced above the last comfortable stage', () => {
    const { plan: started } = startReturn(6, 3);
    const ret = makeSession({ mode: 'return', localDate: '2026-11-24' });
    let plan = applySessionToPlan(started, ret, ret.endedAt);
    plan = applyNextDayToPlan(plan, ret, 'usual');
    expect(() => applyUserAcceptedStage(plan, { kind: 'return_offer', fromStage: 1, toStage: 6, basedOnSessionIds: [ret.id], defaultChoice: 'keep', reasons: [] }, 'x')).toThrow();
  });
});
