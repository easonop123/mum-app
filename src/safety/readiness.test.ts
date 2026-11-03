import { describe, expect, it } from 'vitest';
import { READINESS_QUESTION_IDS, type ReadinessAnswers, type ReadinessQuestionId } from '../domain/types';
import { evaluateReadiness, isWorkoutState, needsClinicianCheckQuestion } from './readiness';
import { CLEAR_ANSWERS } from '../../tests/factories';

const LOW_RISK = ['cautious_start', 'clinician_guided_plan'];

describe('evaluateReadiness', () => {
  it('nothing answered → onboarding_needed, never a workout state', () => {
    const d = evaluateReadiness({});
    expect(d.state).toBe('onboarding_needed');
    expect(d.missingQuestions.length).toBeGreaterThan(5);
    expect(evaluateReadiness(null).state).toBe('onboarding_needed');
  });

  it('emergency signs interrupt immediately, even with other answers missing (case 1)', () => {
    const d = evaluateReadiness({ emergencySigns: 'yes' });
    expect(d.state).toBe('emergency_stop');
    expect(d.reasons[0]!.en).toMatch(/straight away/);
    expect(d.reasons[0]!.zh).toMatch(/立即/);
  });

  it('urgent signs or clinical-review signs route to urgent_assessment', () => {
    expect(evaluateReadiness({ ...CLEAR_ANSWERS, urgentSigns: 'yes' }).state).toBe('urgent_assessment');
    expect(evaluateReadiness({ ...CLEAR_ANSWERS, reviewSigns: 'yes' }).state).toBe('urgent_assessment');
  });

  it('clear answers → cautious_start (a settled historic back issue is not a ban — case 4)', () => {
    const d = evaluateReadiness(CLEAR_ANSWERS);
    expect(d.state).toBe('cautious_start');
    expect(d.standingExercisesExcluded).toBe(false);
    expect(d.reasons[0]!.en).toMatch(/not a medical all-clear/);
  });

  // Case 3: "不确定" never silently maps to low risk — for EVERY question.
  const askedWhenClear: ReadinessQuestionId[] = READINESS_QUESTION_IDS.filter(
    (q) => q !== 'backPainNewOrWorse' && q !== 'backPainLimitsTasks' && q !== 'clinicianCheckedConcerns',
  );
  it.each(askedWhenClear)('"unsure" on %s is never low risk (case 3)', (q) => {
    const answers: ReadinessAnswers = { ...CLEAR_ANSWERS, [q]: 'unsure' };
    if (q === 'currentBackPain') Object.assign(answers, { backPainNewOrWorse: 'no', backPainLimitsTasks: 'no' });
    const d = evaluateReadiness(answers);
    expect(LOW_RISK).not.toContain(d.state);
  });

  it.each(['backPainNewOrWorse', 'backPainLimitsTasks'] as const)('"unsure" on follow-up %s is never low risk', (q) => {
    const d = evaluateReadiness({ ...CLEAR_ANSWERS, currentBackPain: 'yes', backPainNewOrWorse: 'no', backPainLimitsTasks: 'no', [q]: 'unsure', clinicianCheckedConcerns: 'no' });
    expect(LOW_RISK).not.toContain(d.state);
  });

  it('unsure about emergency or urgent signs escalates to urgent_assessment (call Healthline)', () => {
    expect(evaluateReadiness({ ...CLEAR_ANSWERS, emergencySigns: 'unsure' }).state).toBe('urgent_assessment');
    expect(evaluateReadiness({ ...CLEAR_ANSWERS, urgentSigns: 'unsure' }).state).toBe('urgent_assessment');
  });

  it('unsafe or unsure standing excludes standing exercises and routes to guidance (case 5)', () => {
    for (const answer of ['no', 'unsure'] as const) {
      const d = evaluateReadiness({ ...CLEAR_ANSWERS, canStandWithSupport: answer, clinicianCheckedConcerns: 'yes' });
      expect(d.state).toBe('review_before_program');
      expect(d.standingExercisesExcluded).toBe(true);
      expect(d.reasons.map((r) => r.code)).toContain(answer === 'no' ? 'standing_unsafe' : 'standing_unsure');
    }
  });

  it('current back pain or numbness → review before program unless a GP/physio checked it', () => {
    const base = { ...CLEAR_ANSWERS, spreadingNumbWeak: 'yes' as const };
    expect(evaluateReadiness(base).state).toBe('review_before_program');
    expect(evaluateReadiness({ ...base, clinicianCheckedConcerns: 'unsure' }).state).toBe('review_before_program');
    const checked = evaluateReadiness({ ...base, clinicianCheckedConcerns: 'yes' });
    expect(checked.state).toBe('clinician_guided_plan');
    expect(checked.reasons[0]!.en).toMatch(/cannot confirm/);
  });

  it('back-pain follow-ups are required only when there is (or may be) current pain', () => {
    expect(evaluateReadiness({ ...CLEAR_ANSWERS, currentBackPain: 'yes' }).state).toBe('onboarding_needed');
    expect(evaluateReadiness({ ...CLEAR_ANSWERS, currentBackPain: 'no' }).state).toBe('cautious_start');
  });

  it('an existing clinician plan → clinician_guided_plan (never "medically cleared")', () => {
    const d = evaluateReadiness({ ...CLEAR_ANSWERS, clinicianPlan: 'yes' });
    expect(d.state).toBe('clinician_guided_plan');
    expect(JSON.stringify(d)).not.toMatch(/cleared/i);
  });

  it('asks the clinician-check follow-up only for coverable concerns', () => {
    expect(needsClinicianCheckQuestion(CLEAR_ANSWERS)).toBe(false);
    expect(needsClinicianCheckQuestion({ ...CLEAR_ANSWERS, fallsDizziness: 'yes' })).toBe(true);
    expect(needsClinicianCheckQuestion({ ...CLEAR_ANSWERS, canStandWithSupport: 'no' })).toBe(false);
  });

  it('is deterministic', () => {
    const a = { ...CLEAR_ANSWERS, currentBackPain: 'yes' as const, backPainNewOrWorse: 'unsure' as const, backPainLimitsTasks: 'no' as const };
    expect(evaluateReadiness(a)).toEqual(evaluateReadiness({ ...a }));
  });

  it('only cautious_start and clinician_guided_plan are workout states', () => {
    expect(isWorkoutState('cautious_start')).toBe(true);
    expect(isWorkoutState('clinician_guided_plan')).toBe(true);
    for (const s of ['onboarding_needed', 'emergency_stop', 'urgent_assessment', 'review_before_program'] as const) {
      expect(isWorkoutState(s)).toBe(false);
    }
  });
});
