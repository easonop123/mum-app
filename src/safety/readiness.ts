import type { Answer, ReadinessAnswers, ReadinessQuestionId, SafetyState } from '../domain/types';
import { reason, type Reason, type ReasonCode } from './reasons';

/**
 * Deterministic, supportive screening and routing. This is NOT a diagnosis,
 * a validated questionnaire, a readiness score, or professional clearance.
 * "cautious_start" and "clinician_guided_plan" never mean "medically cleared".
 */
export interface SafetyDecision {
  state: SafetyState;
  reasons: Reason[];
  /** Unsafe or unsure supported standing excludes every standing exercise. */
  standingExercisesExcluded: boolean;
  missingQuestions: ReadinessQuestionId[];
}

/** Questions every completed screening must answer (conditional ones are added below). */
const ALWAYS_REQUIRED: ReadinessQuestionId[] = [
  'emergencySigns',
  'urgentSigns',
  'reviewSigns',
  'currentBackPain',
  'spreadingNumbWeak',
  'knownDiagnosisOrRestrictions',
  'injurySurgeryFracture',
  'conditionOrExertionalSymptoms',
  'activityAdvice',
  'canStandWithSupport',
  'fallsDizziness',
  'clinicianPlan',
];

/** Follow-ups asked only when the person has (or is unsure about) current back pain. */
export const BACK_PAIN_FOLLOW_UPS: ReadinessQuestionId[] = ['backPainNewOrWorse', 'backPainLimitsTasks'];

export function requiredQuestions(answers: ReadinessAnswers): ReadinessQuestionId[] {
  const required = [...ALWAYS_REQUIRED];
  if (answers.currentBackPain !== 'no') {
    required.splice(required.indexOf('currentBackPain') + 1, 0, ...BACK_PAIN_FOLLOW_UPS);
  }
  return required;
}

/**
 * Concerns a GP/physio check can cover. "yes" and "unsure" both count:
 * "not sure" never silently maps to low risk.
 */
const COVERABLE_CONCERNS: Array<{ id: ReadinessQuestionId; yes: ReasonCode | null; unsure: ReasonCode }> = [
  { id: 'reviewSigns', yes: null /* "yes" escalates to urgent_assessment */, unsure: 'review_signs_unsure' },
  { id: 'currentBackPain', yes: 'current_back_pain', unsure: 'current_back_pain_unsure' },
  { id: 'backPainNewOrWorse', yes: 'back_pain_new_or_worse', unsure: 'back_pain_new_or_worse_unsure' },
  { id: 'backPainLimitsTasks', yes: 'back_pain_limits_tasks', unsure: 'back_pain_limits_tasks_unsure' },
  { id: 'spreadingNumbWeak', yes: 'spreading_numb_weak', unsure: 'spreading_numb_weak_unsure' },
  {
    id: 'knownDiagnosisOrRestrictions',
    yes: 'known_diagnosis_or_restrictions',
    unsure: 'known_diagnosis_or_restrictions_unsure',
  },
  { id: 'injurySurgeryFracture', yes: 'injury_surgery_fracture', unsure: 'injury_surgery_fracture_unsure' },
  {
    id: 'conditionOrExertionalSymptoms',
    yes: 'condition_or_exertional_symptoms',
    unsure: 'condition_or_exertional_symptoms_unsure',
  },
  { id: 'activityAdvice', yes: 'activity_advice', unsure: 'activity_advice_unsure' },
  { id: 'fallsDizziness', yes: 'falls_dizziness', unsure: 'falls_dizziness_unsure' },
  { id: 'clinicianPlan', yes: null /* handled as clinician-guided */, unsure: 'clinician_plan_unsure' },
];

function decision(
  state: SafetyState,
  reasons: Reason[],
  extra: Partial<Pick<SafetyDecision, 'standingExercisesExcluded' | 'missingQuestions'>> = {},
): SafetyDecision {
  return {
    state,
    reasons,
    standingExercisesExcluded: extra.standingExercisesExcluded ?? false,
    missingQuestions: extra.missingQuestions ?? [],
  };
}

function concernFor(answer: Answer | undefined, yes: ReasonCode | null, unsure: ReasonCode): ReasonCode | null {
  if (answer === 'yes') return yes;
  if (answer === 'unsure') return unsure;
  return null;
}

export function evaluateReadiness(answers: ReadinessAnswers | null | undefined): SafetyDecision {
  const a: ReadinessAnswers = answers ?? {};

  // 1. Emergency signs interrupt everything, even before the rest is answered.
  if (a.emergencySigns === 'yes') {
    return decision('emergency_stop', [reason('emergency_signs')]);
  }

  // 2. Prompt advice. Unsure about emergency/urgent signs also routes here
  //    ("call Healthline if you're unsure"), never to low risk.
  const urgent: Reason[] = [];
  if (a.emergencySigns === 'unsure') urgent.push(reason('emergency_unsure'));
  if (a.urgentSigns === 'yes') urgent.push(reason('urgent_signs'));
  if (a.urgentSigns === 'unsure') urgent.push(reason('urgent_unsure'));
  if (a.reviewSigns === 'yes') urgent.push(reason('review_signs'));
  if (urgent.length > 0) return decision('urgent_assessment', urgent);

  // 3. Incomplete screening never defaults to a workout state.
  const missing = requiredQuestions(a).filter((q) => a[q] === undefined);
  if (missing.length > 0) {
    return decision('onboarding_needed', [reason('incomplete_answers')], { missingQuestions: missing });
  }

  // 4. Supported standing: unsafe or unsure excludes the standing routine and
  //    routes to guidance. A clinician "checked" answer does not override this;
  //    the person re-answers once standing is steady.
  const standingExcluded = a.canStandWithSupport !== 'yes';
  const standingReasons: Reason[] = standingExcluded
    ? [reason(a.canStandWithSupport === 'no' ? 'standing_unsafe' : 'standing_unsure')]
    : [];

  // 5. Other concerns that make an unsupervised generic program inappropriate.
  const concerns: Reason[] = [];
  for (const item of COVERABLE_CONCERNS) {
    if (item.id === 'backPainNewOrWorse' || item.id === 'backPainLimitsTasks') {
      if (a.currentBackPain === 'no') continue;
    }
    const code = concernFor(a[item.id], item.yes, item.unsure);
    if (code) concerns.push(reason(code));
  }

  if (standingExcluded) {
    return decision('review_before_program', [...standingReasons, ...concerns], { standingExercisesExcluded: true });
  }

  if (concerns.length > 0) {
    if (a.clinicianCheckedConcerns === 'yes') {
      return decision('clinician_guided_plan', [reason('clinician_checked'), ...concerns]);
    }
    return decision('review_before_program', [...concerns, reason('clinician_not_checked')]);
  }

  if (a.clinicianPlan === 'yes') {
    return decision('clinician_guided_plan', [reason('clinician_plan')]);
  }

  // A settled, historic back issue with no current concerns is NOT a
  // permanent exercise ban. (This specific program still waits for its
  // assessment — see gate.ts — but that is a program rule, not a ban.)
  return decision('cautious_start', [reason('no_current_concerns')]);
}

/** Whether the "has a GP/physio checked these?" follow-up is relevant for these answers. */
export function needsClinicianCheckQuestion(answers: ReadinessAnswers): boolean {
  const withoutCheck = { ...answers, clinicianCheckedConcerns: undefined };
  const result = evaluateReadiness(withoutCheck);
  if (result.state !== 'review_before_program' || result.standingExercisesExcluded) return false;
  return result.reasons.some((r) => r.code !== 'clinician_not_checked');
}

export const WORKOUT_STATES: readonly SafetyState[] = ['cautious_start', 'clinician_guided_plan'];

export function isWorkoutState(state: SafetyState): boolean {
  return WORKOUT_STATES.includes(state);
}

const SEVERITY: Record<SafetyState, number> = {
  emergency_stop: 5,
  urgent_assessment: 4,
  onboarding_needed: 3,
  review_before_program: 2,
  clinician_guided_plan: 1,
  cautious_start: 1,
};

export function severityOf(state: SafetyState): number {
  return SEVERITY[state];
}

export function moreSevere(a: SafetyState, b: SafetyState): SafetyState {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}
