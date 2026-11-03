import type { LocalizedText } from '../domain/types';

// Every engine decision returns reasons in both supported languages.
// Wording is grounded in NHS back-pain symptom guidance and NZ (111 /
// Healthline) pathways. The Chinese safety wording must be reviewed by a
// qualified bilingual reviewer before real-world use (see docs).

export const REASON_TEXT = {
  incomplete_answers: {
    en: 'Some questions still need an answer.',
    zh: '还有问题没有回答。',
  },
  rescreen_after_import: {
    en: 'Your data was restored from a backup. Please answer the health questions again so they show how you are now.',
    zh: '数据是从备份恢复的。请重新回答健康问题，让答案反映你现在的情况。',
  },
  emergency_signs: {
    en: 'You told us about symptoms that need medical help straight away.',
    zh: '你提到的症状需要立即寻求医疗帮助。',
  },
  emergency_unsure: {
    en: "You weren't sure about some serious symptoms. Please get advice to find out.",
    zh: '你不确定是否有一些严重的症状。请先咨询，弄清楚。',
  },
  urgent_signs: {
    en: 'You told us about symptoms that need prompt medical advice.',
    zh: '你提到的症状需要尽快寻求医疗建议。',
  },
  urgent_unsure: {
    en: "You weren't sure about some symptoms that may need prompt advice.",
    zh: '你不确定是否有一些需要尽快咨询的症状。',
  },
  review_signs: {
    en: "You mentioned something a doctor should look at before you start. The app can't tell the cause or how urgent it is.",
    zh: '你提到的情况需要先请医生看看，再开始练习。应用无法判断原因，也无法判断有多紧急。',
  },
  review_signs_unsure: {
    en: "You weren't sure about weight loss, night pain, past cancer, or an injury. Worth asking your GP.",
    zh: '你不确定是否有体重下降、夜间疼痛、以前的癌症或受伤。值得问问家庭医生。',
  },
  current_back_pain: {
    en: 'You have back pain at the moment.',
    zh: '你现在有背痛。',
  },
  current_back_pain_unsure: {
    en: "You weren't sure whether you have back pain at the moment.",
    zh: '你不确定现在有没有背痛。',
  },
  back_pain_new_or_worse: {
    en: 'Your back pain is new or getting worse.',
    zh: '你的背痛是新出现的，或者在加重。',
  },
  back_pain_new_or_worse_unsure: {
    en: "You weren't sure whether your back pain is new or getting worse.",
    zh: '你不确定背痛是不是新出现的或在加重。',
  },
  back_pain_limits_tasks: {
    en: 'Your back pain stops you doing some normal everyday things.',
    zh: '背痛影响了你做一些日常的事。',
  },
  back_pain_limits_tasks_unsure: {
    en: "You weren't sure whether your back pain limits everyday things.",
    zh: '你不确定背痛有没有影响日常生活。',
  },
  spreading_numb_weak: {
    en: 'You have pain that spreads, numbness or tingling, or weakness. A GP should check this.',
    zh: '你有放射痛、麻木或刺痛，或者无力。这需要请家庭医生检查。',
  },
  spreading_numb_weak_unsure: {
    en: "You weren't sure about spreading pain, numbness, tingling or weakness. A GP can help work this out.",
    zh: '你不确定是否有放射痛、麻木、刺痛或无力。家庭医生可以帮你弄清楚。',
  },
  known_diagnosis_or_restrictions: {
    en: "You've been told something about your back or what to avoid. This routine should be checked against that.",
    zh: '医生或物理治疗师跟你说过背部的情况或需要避免的动作。这套练习需要先按他们的意见核对。',
  },
  known_diagnosis_or_restrictions_unsure: {
    en: "You weren't sure whether you've been told to avoid anything. That's fine — it's worth asking.",
    zh: '你不清楚有没有被告知要避免什么。没关系，值得问一问。',
  },
  injury_surgery_fracture: {
    en: 'You recently had an injury, operation or broken bone, or have osteoporosis with new symptoms.',
    zh: '你最近受过伤、做过手术或骨折过，或者有骨质疏松并出现了新症状。',
  },
  injury_surgery_fracture_unsure: {
    en: "You weren't sure about a recent injury, operation, broken bone or osteoporosis symptoms.",
    zh: '你不确定最近有没有受伤、手术、骨折或骨质疏松的新症状。',
  },
  condition_or_exertional_symptoms: {
    en: 'You have a health condition or symptoms during activity that could affect exercise.',
    zh: '你有可能影响运动的健康问题，或者活动时会出现症状。',
  },
  condition_or_exertional_symptoms_unsure: {
    en: "You weren't sure about health conditions or symptoms during activity.",
    zh: '你不确定是否有影响运动的健康问题，或者活动时的症状。',
  },
  activity_advice: {
    en: "A health professional has given you advice about activity. This routine should fit with that advice.",
    zh: '医护人员给过你关于活动的建议。这套练习需要和那些建议相符。',
  },
  activity_advice_unsure: {
    en: "You weren't sure whether you've had advice about activity.",
    zh: '你不确定有没有得到过关于活动的建议。',
  },
  standing_unsafe: {
    en: "You may not be able to stand steadily with support right now, so the standing movements aren't available. A physiotherapist can suggest what suits you.",
    zh: '你现在可能无法扶着站稳，所以站立的动作暂时不能做。物理治疗师可以建议适合你的方式。',
  },
  standing_unsure: {
    en: "You weren't sure whether you can stand steadily with support, so the standing movements aren't available yet. A physiotherapist can help check.",
    zh: '你不确定能不能扶着站稳，所以站立的动作暂时不能做。物理治疗师可以帮你确认。',
  },
  falls_dizziness: {
    en: 'You have had falls, dizziness or unsteadiness recently.',
    zh: '你最近有过跌倒、头晕或站不稳。',
  },
  falls_dizziness_unsure: {
    en: "You weren't sure about recent falls, dizziness or unsteadiness.",
    zh: '你不确定最近有没有跌倒、头晕或站不稳。',
  },
  clinician_plan: {
    en: 'You have home exercises from a physio or doctor. Follow their plan, and check this routine with them.',
    zh: '你有物理治疗师或医生给的家庭练习。请按他们的计划做，这套练习也请先和他们确认。',
  },
  clinician_plan_unsure: {
    en: "You weren't sure whether you already have home exercises from a physio or doctor.",
    zh: '你不确定有没有物理治疗师或医生给的家庭练习。',
  },
  clinician_checked: {
    en: 'You told us a GP or physio has checked these things and said exercise like this is OK. (The app cannot confirm this.)',
    zh: '你说家庭医生或物理治疗师已经看过这些情况，并说这类运动可以做。（应用无法核实这一点。）',
  },
  clinician_not_checked: {
    en: 'These things have not been checked by a GP or physio yet.',
    zh: '这些情况还没有请家庭医生或物理治疗师看过。',
  },
  no_current_concerns: {
    en: "Your answers don't show current warning signs. That is not a medical all-clear.",
    zh: '你的回答里没有发现现在的警示症状。但这不等于医生说可以。',
  },
  program_assessment_pending: {
    en: 'This plan waits until a GP or physiotherapist has looked at your back history and you have recorded what they said.',
    zh: '这个计划要等家庭医生或物理治疗师看过你的背部情况，并且你记录了他们的意见之后，才能开始。',
  },
  program_paused: {
    en: 'This plan is paused until it has been reviewed again.',
    zh: '这个计划暂停了，需要重新确认后才能继续。',
  },
  routine_no_advice: {
    en: "No professional advice about these movements has been recorded yet.",
    zh: '还没有记录专业人员对这些动作的意见。',
  },
  routine_not_discussed: {
    en: "Some movements weren't discussed with your GP or physio yet.",
    zh: '有些动作还没有和医生或物理治疗师讨论过。',
  },
  routine_not_ok: {
    en: "Your GP or physio said one or more of these movements isn't right for you. The app won't make up a replacement — the routine needs to be revised with them.",
    zh: '医生或物理治疗师说其中有动作不适合你。应用不会自己编一个替代动作——需要和他们一起修改这套练习。',
  },
  routine_standing_excluded: {
    en: "All four movements are done standing, so they aren't available while standing isn't steady. The app won't swap in a chair version.",
    zh: '这四个动作都要站着做，在站不稳的情况下暂时不能做。应用不会换成坐在椅子上的做法。',
  },
  routine_above_max_stage: {
    en: 'Your recorded advice limits you to an earlier stage than this one.',
    zh: '根据你记录的建议，你只能做到更前面的阶段。',
  },
  hold_unresolved: {
    en: 'Something you reported earlier still needs checking. Choosing "nothing new" doesn\'t clear it.',
    zh: '你之前提到的情况还需要处理。选择“没有新变化”并不能取消它。',
  },
  check_in_new_or_worse: {
    en: 'Something is new or worse. Please get advice before practising again.',
    zh: '有新的或更重的情况。再练习之前，请先咨询。',
  },
  check_in_unsure: {
    en: "You weren't sure whether something has changed. Resting today is fine. You can check again later.",
    zh: '你不确定身体有没有变化。今天休息就好，之后可以再检查。',
  },
  stop_chest_faint_breathing: {
    en: 'You reported chest pain, feeling faint, or trouble breathing during practice.',
    zh: '你在练习时出现了胸痛、快要晕倒或呼吸困难。',
  },
  stop_numb_weak_spreading: {
    en: 'You reported new numbness, tingling, weakness or spreading pain during practice.',
    zh: '你在练习时出现了新的麻木、刺痛、无力或放射痛。',
  },
  stop_back_pain_worse: {
    en: 'You reported worse or sharp back pain during practice.',
    zh: '你在练习时背痛加重或出现刺痛。',
  },
  stop_dizzy_unwell: {
    en: 'You reported feeling dizzy or unwell during practice.',
    zh: '你在练习时感到头晕或不舒服。',
  },
  stop_unsure: {
    en: "You weren't sure what you were feeling during practice.",
    zh: '你在练习时说不清是什么感觉。',
  },
  stop_other: {
    en: 'You reported something that didn’t feel right during practice.',
    zh: '你在练习时感觉哪里不对。',
  },
  next_day_worse: {
    en: 'The day after practice, something was worse than usual.',
    zh: '练习后的第二天，有情况比平时更差。',
  },
  next_day_unsure: {
    en: "You weren't sure how you felt the day after practice.",
    zh: '你不确定练习后第二天的感觉。',
  },
  hold_needs_advice: {
    en: 'This needs advice from a GP, physio or Healthline before practice can restart.',
    zh: '需要先咨询家庭医生、物理治疗师或 Healthline，才能重新开始练习。',
  },
  professional_said_stop: {
    en: 'Your health professional said to stop for now. The plan stays paused.',
    zh: '医护人员说先暂停。计划会保持暂停。',
  },
  professional_advice_unclear: {
    en: "It isn't clear yet what your health professional advised. The plan stays on hold until it is.",
    zh: '还不清楚医护人员的意见。弄清楚之前，计划会继续暂停。',
  },
  professional_advised_changes: {
    en: 'Your health professional suggested changes. The app cannot change the routine itself, so the plan is paused for a content revision.',
    zh: '医护人员建议做一些改动。应用不能自己修改练习，所以计划先暂停，等修改内容。',
  },
  rescreen_concerns_remain: {
    en: "Your answers today still show things that haven't been checked by a GP or physio.",
    zh: '你今天的回答里，仍然有没请医生或物理治疗师看过的情况。',
  },
  rescreen_clear: {
    en: "Thank you. Your answers today don't show anything new that needs checking first.",
    zh: '谢谢。你今天的回答没有显示需要先处理的新情况。',
  },
  setup_needed: {
    en: 'Please do the short home setup check first.',
    zh: '请先完成简短的居家准备检查。',
  },
  existing_state_unchanged: {
    en: 'Nothing new today, but the earlier status still applies.',
    zh: '今天没有新情况，但之前的状态仍然有效。',
  },
  content_error: {
    en: "This plan's content couldn't be loaded safely, so practice is unavailable.",
    zh: '这个计划的内容无法安全加载，所以暂时不能练习。',
  },
  // ---- progression (offers are never automatic; the default is to keep the amount)
  offer_program_not_reviewed: {
    en: 'Moving up a stage only happens after your plan has been reviewed.',
    zh: '计划经过确认之后，才会考虑往下一个阶段走。',
  },
  offer_safety_hold: {
    en: 'Moving up waits until the earlier concern has been checked.',
    zh: '之前的情况处理好之前，先不往上加。',
  },
  offer_progression_not_approved: {
    en: "Your recorded advice doesn't cover building up yet. Keeping this amount is fine — you could ask at your next appointment.",
    zh: '你记录的建议里还没有提到可以慢慢加量。保持这个量就很好，下次看诊时可以问一问。',
  },
  offer_max_stage: {
    en: 'Your recorded advice says to stay at this stage for now.',
    zh: '根据你记录的建议，目前先停在这个阶段。',
  },
  offer_return_frozen: {
    en: 'After a break, we start with one return session at the Stage 1 amount. Moving up waits until after that.',
    zh: '休息一段时间后，先用第1阶段的量做一次“回来练”。之后再考虑往上加。',
  },
  offer_need_more_sessions: {
    en: 'Keep this amount for now. After two comfortable full practices at this stage, each followed by a usual next day, you can choose whether to do a little more.',
    zh: '先保持这个量。在这个阶段完成两次舒适的完整练习，而且每次第二天都和平时一样之后，你可以自己决定要不要多做一点。',
  },
  offer_next_day_missing: {
    en: "First we'll ask how you felt the day after each practice.",
    zh: '我们会先问问你每次练习后第二天的感觉。',
  },
  offer_next_day_not_usual: {
    en: "The day after one of these practices wasn't as usual, so the amount stays the same.",
    zh: '其中一次练习后的第二天和平时不一样，所以先保持这个量。',
  },
  offer_recent_difficulty: {
    en: 'The last practice felt like a lot. Keeping this amount is a good choice.',
    zh: '上次练习觉得有点吃力。保持这个量是很好的选择。',
  },
  offer_kept_amount: {
    en: 'You chose to keep this amount. That is completely fine.',
    zh: '你选择了保持这个量。可以保持这个量。',
  },
  offer_available: {
    en: 'Your last two full practices felt comfortable and the next days were as usual. You can choose to do a little more — or keep this amount.',
    zh: '你最近两次完整练习都很舒适，第二天也和平时一样。你可以选择多做一点，也可以保持这个量。',
  },
  offer_return_available: {
    en: 'Your return session went well and the next day was as usual. You can go back to the last amount that felt comfortable — or keep the Stage 1 amount for now.',
    zh: '“回来练”很顺利，第二天也和平时一样。你可以回到上次觉得舒适的量，也可以先保持第1阶段的量。',
  },
  maintenance_stage8: {
    en: "This is the last stage of the starter routine: keep this amount. It's a good time to ask a physio about a broader program, because these four movements don't cover every major muscle group.",
    zh: '这是入门练习的最后一个阶段：保持这个量就好。这时可以问问物理治疗师，安排更全面的练习，因为这四个动作没有练到全身所有主要肌肉。',
  },
} as const satisfies Record<string, LocalizedText>;

export type ReasonCode = keyof typeof REASON_TEXT;

export interface Reason extends LocalizedText {
  code: ReasonCode;
}

export function reason(code: ReasonCode): Reason {
  const text = REASON_TEXT[code];
  return { code, en: text.en, zh: text.zh };
}

export function isReasonCode(value: string): value is ReasonCode {
  return Object.prototype.hasOwnProperty.call(REASON_TEXT, value);
}

export function reasonsFromCodes(codes: readonly string[]): Reason[] {
  return codes.filter(isReasonCode).map(reason);
}
