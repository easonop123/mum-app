import { describe, expect, it } from 'vitest';
import { PROGRAM_ID, type SafetyHold } from '../domain/types';
import {
  getFixedStagePrescription,
  getTinySessionPrescription,
  programStatusFromAdvice,
  restrictionsFrom,
  validateSuppliedRoutineAgainstRestrictions,
} from '../program/prescription';
import { evaluateSessionCheckIn } from './checkIn';
import { accessAsDecision, getProgramAccess, type ProgramAccessInput } from './gate';
import { createHold, evaluateHoldResolution, holdForStopChoice } from './holds';
import { evaluateReadiness } from './readiness';
import { CLEAR_ANSWERS, approvedAdvice } from '../../tests/factories';

function input(overrides: Partial<ProgramAccessInput> & { advice?: ReturnType<typeof approvedAdvice> | null } = {}): ProgramAccessInput {
  const advice = overrides.advice === undefined ? approvedAdvice() : overrides.advice;
  const readiness = overrides.readiness ?? evaluateReadiness(CLEAR_ANSWERS);
  const restrictions = restrictionsFrom(advice, readiness.standingExercisesExcluded);
  return {
    readiness,
    holds: overrides.holds ?? [],
    programStatus: overrides.programStatus ?? programStatusFromAdvice(advice),
    routineReview: overrides.routineReview ?? validateSuppliedRoutineAgainstRestrictions(getFixedStagePrescription(PROGRAM_ID, 1), restrictions),
    tinyRoutineReview: overrides.tinyRoutineReview ?? validateSuppliedRoutineAgainstRestrictions(getTinySessionPrescription(PROGRAM_ID, 1), restrictions),
    setupComplete: overrides.setupComplete ?? true,
  };
}

function hold(state: SafetyHold['state'], kind: SafetyHold['kind'] = 'advice_required'): SafetyHold {
  return createHold({ id: 'h1', now: '2026-11-03T00:00:00.000Z', localDate: '2026-11-03', source: 'check_in', state, kind, reasonCodes: ['check_in_new_or_worse'] });
}

describe('getProgramAccess — the one gate for every workout entry point', () => {
  it('reviewed plan + clear answers + setup → practice allowed', () => {
    const a = getProgramAccess(input());
    expect(a.canStartFull).toBe(true);
    expect(a.canStartTiny).toBe(true);
  });

  it('emergency blocks everything, including learning (case 1)', () => {
    for (const i of [input({ readiness: evaluateReadiness({ emergencySigns: 'yes' }) }), input({ holds: [hold('emergency_stop')] })]) {
      const a = getProgramAccess(i);
      expect(a.state).toBe('emergency_stop');
      expect(a.canStartFull || a.canStartTiny || a.canLearn).toBe(false);
    }
  });

  it('urgent holds cannot be bypassed by the tiny session or "no new change" (case 2)', () => {
    const access = getProgramAccess(input({ holds: [hold('urgent_assessment')] }));
    expect(access.canStartTiny).toBe(false);
    expect(access.canStartFull).toBe(false);
    const checkIn = evaluateSessionCheckIn(accessAsDecision(access, evaluateReadiness(CLEAR_ANSWERS)), { newOrWorse: 'no' });
    expect(checkIn.mayStart).toBe(false);
    expect(checkIn.state).toBe('urgent_assessment');
  });

  it('assessment-pending cannot be bypassed by clear answers, a tiny session, or "no new symptoms" (case 25)', () => {
    // Clear readiness answers (e.g. after mentioning a comfortable long walk) but no recorded advice:
    const a = getProgramAccess(input({ advice: null }));
    expect(a.state).toBe('review_before_program');
    expect(a.blockedBy).toBe('assessment_pending');
    expect(a.canStartFull).toBe(false);
    expect(a.canStartTiny).toBe(false);
    expect(a.canLearn).toBe(true);
    const checkIn = evaluateSessionCheckIn(accessAsDecision(a, evaluateReadiness(CLEAR_ANSWERS)), { newOrWorse: 'no' });
    expect(checkIn.mayStart).toBe(false);
  });

  it('advice that did not assess the back history keeps the plan pending', () => {
    const a = getProgramAccess(input({ advice: approvedAdvice({ assessedBackHistory: 'no' }) }));
    expect(a.blockedBy).toBe('assessment_pending');
  });

  it('an unsafe standing answer routes to guidance, not a chair workaround (case 5)', () => {
    const readiness = evaluateReadiness({ ...CLEAR_ANSWERS, canStandWithSupport: 'no' });
    const a = getProgramAccess(input({ readiness }));
    expect(a.canStartFull).toBe(false);
    expect(a.canStartTiny).toBe(false);
    expect(a.reasons.map((r) => r.code)).toContain('standing_unsafe');
  });

  it('review holds still allow watching/reading but not practice', () => {
    const a = getProgramAccess(input({ holds: [hold('review_before_program', 'recheck_required')] }));
    expect(a.blockedBy).toBe('hold');
    expect(a.canLearn).toBe(true);
    expect(a.canStartTiny).toBe(false);
  });

  it('setup check is required before the first practice', () => {
    const a = getProgramAccess(input({ setupComplete: false }));
    expect(a.blockedBy).toBe('setup');
    expect(a.canStartFull).toBe(false);
  });

  it('resolved holds no longer block', () => {
    const resolved = { ...hold('urgent_assessment'), resolvedAt: '2026-11-04T00:00:00.000Z' };
    expect(getProgramAccess(input({ holds: [resolved] })).canStartFull).toBe(true);
  });
});

describe('evaluateSessionCheckIn', () => {
  const current = evaluateReadiness(CLEAR_ANSWERS);

  it('"no new change" lets a reviewed plan start', () => {
    expect(evaluateSessionCheckIn(current, { newOrWorse: 'no' }).mayStart).toBe(true);
  });

  it('new or worse → advice-required hold', () => {
    const d = evaluateSessionCheckIn(current, { newOrWorse: 'yes', emergencySigns: 'no', urgentSigns: 'no' });
    expect(d.mayStart).toBe(false);
    expect(d.createHold).toEqual({ kind: 'advice_required', state: 'review_before_program' });
  });

  it('"not sure" is not low risk → recheck hold (case 3)', () => {
    const d = evaluateSessionCheckIn(current, { newOrWorse: 'unsure', emergencySigns: 'no', urgentSigns: 'no' });
    expect(d.mayStart).toBe(false);
    expect(d.createHold?.kind).toBe('recheck_required');
    expect(evaluateSessionCheckIn(current, {}).mayStart).toBe(false);
  });

  it('emergency answers stop everything and create an emergency hold', () => {
    const d = evaluateSessionCheckIn(current, { newOrWorse: 'yes', emergencySigns: 'yes' });
    expect(d.state).toBe('emergency_stop');
    expect(d.createHold?.state).toBe('emergency_stop');
  });

  it('a prior hold is not bypassed by "no new changes" (case 2)', () => {
    const held = { ...current, state: 'review_before_program' as const };
    expect(evaluateSessionCheckIn(held, { newOrWorse: 'no' }).mayStart).toBe(false);
  });
});

describe('holds and the return-to-program flow', () => {
  const clear = evaluateReadiness({ ...CLEAR_ANSWERS });

  it('advice-required holds need a professional AND current answers — not a checkbox', () => {
    const h = hold('urgent_assessment');
    expect(evaluateHoldResolution(h, { talkedToProfessional: 'no', professionalSaid: null, freshDecision: clear }).resolved).toBe(false);
    expect(evaluateHoldResolution(h, { talkedToProfessional: 'yes', professionalSaid: 'unsure', freshDecision: clear }).resolved).toBe(false);
    const stillConcerned = evaluateReadiness({ ...CLEAR_ANSWERS, spreadingNumbWeak: 'yes' });
    expect(evaluateHoldResolution(h, { talkedToProfessional: 'yes', professionalSaid: 'ok_to_continue', freshDecision: stillConcerned }).resolved).toBe(false);
    expect(evaluateHoldResolution(h, { talkedToProfessional: 'yes', professionalSaid: 'ok_to_continue', freshDecision: clear }).resolved).toBe(true);
  });

  it('fresh emergency answers keep the hold', () => {
    const r = evaluateHoldResolution(hold('review_before_program', 'recheck_required'), {
      talkedToProfessional: 'yes', professionalSaid: 'ok_to_continue', freshDecision: evaluateReadiness({ emergencySigns: 'yes' }),
    });
    expect(r.resolved).toBe(false);
  });

  it('professional-advised changes pause the program for a content revision', () => {
    const r = evaluateHoldResolution(hold('review_before_program'), { talkedToProfessional: 'yes', professionalSaid: 'continue_with_changes', freshDecision: clear });
    expect(r.pauseProgram).toBe(true);
    const stop = evaluateHoldResolution(hold('review_before_program'), { talkedToProfessional: 'yes', professionalSaid: 'stop_for_now', freshDecision: clear });
    expect(stop.resolved).toBe(false);
    expect(stop.pauseProgram).toBe(true);
  });

  it('recheck holds clear only with fresh answers that show no concerns', () => {
    const h = hold('review_before_program', 'recheck_required');
    expect(evaluateHoldResolution(h, { talkedToProfessional: 'no', professionalSaid: null, freshDecision: clear }).resolved).toBe(true);
    expect(evaluateHoldResolution(h, { talkedToProfessional: 'no', professionalSaid: null, freshDecision: evaluateReadiness({ ...CLEAR_ANSWERS, fallsDizziness: 'unsure' }) }).resolved).toBe(false);
  });

  it('stop choices never offer a substitute exercise', () => {
    expect(holdForStopChoice('chest_faint_breathing')?.state).toBe('emergency_stop');
    expect(holdForStopChoice('numb_weak_spreading')?.state).toBe('urgent_assessment');
    expect(holdForStopChoice('back_pain_worse_sharp')?.kind).toBe('advice_required');
    expect(holdForStopChoice('unsure')?.kind).toBe('recheck_required');
    expect(holdForStopChoice('just_stop')).toBeNull();
  });
});
