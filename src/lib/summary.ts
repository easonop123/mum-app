import { PROGRAM } from '../content/program';
import { EXERCISES } from '../content/exercises';
import { CONTENT_REVIEW_DATE } from '../content/version';
import { READINESS_QUESTION_IDS, STAGES, type Answer, type Lang, type ReadinessQuestionId } from '../domain/types';
import type { AppData } from '../data/schema';
import { ageRangeFromBirthYear, formatLocalDate, localDateInZone } from './dates';

// A locally generated discussion summary built only from the person's own
// answers and records. It never states or infers a diagnosis.

const SHORT_LABELS: Record<ReadinessQuestionId, { en: string; zh: string }> = {
  emergencySigns: {
    en: 'Right now: new bladder/bowel problems, numbness around genitals or bottom, new symptoms in both legs, chest pain, or back pain after a serious accident or fall',
    zh: '现在：新出现的大小便问题、生殖器或肛门周围麻木、两腿都有新症状、胸痛，或严重事故/跌倒后的背痛',
  },
  urgentSigns: {
    en: 'Severe or quickly worsening back pain; back pain with fever, chills or feeling unwell; quickly worsening weakness or spreading numbness/tingling',
    zh: '剧烈或很快加重的背痛；背痛伴发烧、发冷或不舒服；无力很快加重，或麻木/刺痛在扩散',
  },
  reviewSigns: {
    en: 'Unexplained weight loss, night pain that does not ease, past cancer with new back pain, or back pain since an injury',
    zh: '不明原因的体重下降、休息也不缓解的夜间疼痛、以前有癌症且现在出现新的背痛，或受伤后的背痛',
  },
  currentBackPain: { en: 'Back pain at the moment', zh: '现在有背痛' },
  backPainNewOrWorse: { en: 'Back pain is new or getting worse', zh: '背痛是新出现的或在加重' },
  backPainLimitsTasks: { en: 'Back pain limits everyday tasks', zh: '背痛影响日常生活' },
  spreadingNumbWeak: {
    en: 'Spreading pain, numbness or tingling anywhere, or weakness (including anything noticed but not yet checked)',
    zh: '放射痛、身体任何地方的麻木或刺痛，或无力（包括注意到但还没检查过的）',
  },
  knownDiagnosisOrRestrictions: { en: 'Told the cause of back problems, or told to avoid movements', zh: '被告知背部问题的原因，或被告知要避免某些动作' },
  injurySurgeryFracture: { en: 'Recent injury, operation or broken bone, or osteoporosis with new symptoms', zh: '最近受伤、手术或骨折，或骨质疏松并出现新症状' },
  conditionOrExertionalSymptoms: { en: 'Health condition affecting exercise, or symptoms during activity', zh: '影响运动的健康问题，或活动时出现症状' },
  activityAdvice: { en: 'Has had advice about how active to be', zh: '得到过关于活动量的建议' },
  canStandWithSupport: { en: 'Can rise and stand steadily holding a stable support, without help', zh: '能自己起身，扶着稳固的东西站稳，不需要别人扶' },
  fallsDizziness: { en: 'Recent falls, dizziness or unsteadiness', zh: '最近跌倒、头晕或站不稳' },
  clinicianPlan: { en: 'Already has home exercises from a physio or doctor', zh: '已经有物理治疗师或医生给的居家练习' },
  clinicianCheckedConcerns: { en: 'A GP/physio has already checked the above and said this kind of exercise is OK', zh: '家庭医生/物理治疗师已经看过以上情况，并说可以做这类运动' },
};

function answerText(a: Answer | undefined, lang: Lang): string {
  if (lang === 'zh') return a === 'yes' ? '是' : a === 'no' ? '否' : a === 'unsure' ? '不确定' : '（没有问）';
  return a === 'yes' ? 'Yes' : a === 'no' ? 'No' : a === 'unsure' ? 'Not sure' : '(not asked)';
}

const STOP_LABELS: Record<string, { en: string; zh: string }> = {
  chest_faint_breathing: { en: 'chest pain, feeling faint or hard to breathe', zh: '胸痛、快要晕倒或呼吸困难' },
  numb_weak_spreading: { en: 'new numbness, tingling, weakness or spreading pain', zh: '新的麻木、刺痛、无力或放射痛' },
  back_pain_worse_sharp: { en: 'worse or sharp back pain', zh: '背痛加重或刺痛' },
  dizzy_unwell: { en: 'dizzy or unwell', zh: '头晕或不舒服' },
  other: { en: 'something else did not feel right', zh: '别的地方觉得不对' },
  unsure: { en: 'not sure what was felt', zh: '说不清是什么感觉' },
};

export function buildClinicianSummary(data: AppData, lang: Lang, now: Date = new Date()): string {
  const zh = lang === 'zh';
  const today = localDateInZone(now, data.schedule.timezone);
  const L = (x: { en: string; zh: string }) => (zh ? x.zh : x.en);
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(zh ? '和家庭医生或物理治疗师讨论用的摘要' : 'Summary for discussion with a GP or physiotherapist');
  push(
    zh
      ? `由“一点力”应用根据我自己的回答在手机上生成，日期：${formatLocalDate(today, 'zh')}。这不是诊断、病历，也不是经过验证的问卷。`
      : `Made on ${formatLocalDate(today, 'en')} by the 一点力 / A Little Stronger app from my own answers. It is not a diagnosis, a medical record, or a validated questionnaire.`,
  );
  push('');

  push(zh ? '关于我' : 'About me');
  if (data.profile.birthYear) {
    const age = ageRangeFromBirthYear(data.profile.birthYear, today);
    push(zh ? `- 年龄：${age.min} 或 ${age.max} 岁（没有记录生日）` : `- Age: ${age.min} or ${age.max} (birthday not recorded)`);
  } else {
    push(zh ? '- 年龄：没有记录' : '- Age: not recorded');
  }
  push(zh ? '- 地区：新西兰' : '- Region: New Zealand');
  push('');

  const answered = data.readiness.answeredAt ? formatLocalDate(localDateInZone(data.readiness.answeredAt, data.schedule.timezone), lang) : null;
  push(zh ? `我的回答${answered ? `（${answered}）` : ''}` : `My answers${answered ? ` (${answered})` : ''}`);
  for (const id of READINESS_QUESTION_IDS) {
    const a = data.readiness.answers[id];
    if (a === undefined && (id === 'backPainNewOrWorse' || id === 'backPainLimitsTasks' || id === 'clinicianCheckedConcerns')) continue;
    push(`- ${L(SHORT_LABELS[id])}: ${answerText(a, lang)}`);
  }
  if (data.readiness.restrictionsNote) push(zh ? `- 我写的关于限制的记录：${data.readiness.restrictionsNote}` : `- My note about restrictions: ${data.readiness.restrictionsNote}`);
  if (data.readiness.activityAdviceNote) push(zh ? `- 我写的关于活动建议的记录：${data.readiness.activityAdviceNote}` : `- My note about activity advice: ${data.readiness.activityAdviceNote}`);
  push('');

  push(zh ? '我想问的问题' : 'What I would like to ask');
  const questions = zh
    ? [
        '能不能看看我的背痛情况，包括我有过的麻木、刺痛或无力？',
        '这套入门练习适合我吗？有没有需要避免或修改的动作？',
        '可以按下面的阶段表慢慢加量吗？最多可以到第几阶段？',
        '有什么需要特别注意的吗？',
      ]
    : [
        'Could you look at my back pain history, including any numbness, tingling or weakness I have had?',
        'Is this starter routine suitable for me? Are there movements I should avoid or change?',
        'Is it OK to build up slowly using the stage table below? Up to which stage?',
        'Is there anything I should watch out for?',
      ];
  questions.forEach((q, i) => push(`${i + 1}. ${q}`));
  push('');

  const status =
    data.programStatus === 'reviewed_for_use'
      ? zh
        ? '使用中（根据我记录的建议）'
        : 'in use (based on the advice I recorded)'
      : data.programStatus === 'paused_for_review'
        ? zh
          ? '已暂停，需要重新确认'
          : 'paused for review'
        : zh
          ? '草稿，等待医生的建议'
          : 'draft, waiting for medical advice';
  push(
    zh
      ? `入门练习（固定计划 ${PROGRAM.programId}，版本 ${PROGRAM.version}）——状态：${status}`
      : `The starter routine (fixed program ${PROGRAM.programId}, version ${PROGRAM.version}) — status: ${status}`,
  );
  for (const id of PROGRAM.exerciseOrder) {
    const ex = EXERCISES[id];
    push(`- ${L(ex.name)}: ${L(ex.technique)}`);
  }
  push(
    zh
      ? '- 每周两天，中间至少隔一天。如果舒服，先轻松走 2 分钟热身。每组之间休息大约 60 秒。不用重物。每个阶段至少要有两次舒适的完整练习，而且每次第二天都和平时一样，再由我自己决定是否往上加。'
      : '- Two days a week with at least one rest day between. Optional 2-minute easy walk to warm up, if comfortable. About 60 s rest between sets. No weights. Each stage needs at least two comfortable full sessions, each followed by a usual next day, and then I choose whether to move up.',
  );
  push(zh ? '阶段表（组数 × 次数；侧抬腿为每边）：' : 'Stage table (sets × repetitions; side leg lift is per side):');
  for (const stage of STAGES) {
    const dose = PROGRAM.stageDoses.find((d) => d.stage === stage)!;
    const cells = PROGRAM.exerciseOrder.map((id, i) => `${L(EXERCISES[id].name)} ${dose.sets[i]}×${dose.reps[i]}`);
    push(`  ${zh ? '第' : 'Stage '}${stage}${zh ? '阶段' : ''}: ${cells.join('; ')}${stage === 8 ? (zh ? '（保持）' : ' (maintain)') : ''}`);
  }
  push(
    zh
      ? '这套练习没有练到全身所有主要肌肉（“拉”的动作和身体后侧练习很少）。这些数字是谨慎的建议，不是为我开的处方。'
      : 'This routine does not cover every major muscle group (little pulling or back-of-body work). The numbers are conservative suggestions, not a prescription made for me.',
  );
  push('');

  const advice = data.professionalAdvice;
  if (advice) {
    push(zh ? '我记录的医生意见' : 'Advice I have recorded');
    if (advice.adviceDate) push(`- ${zh ? '日期' : 'Date'}: ${formatLocalDate(advice.adviceDate, lang)}`);
    const who = { gp: { en: 'GP', zh: '家庭医生' }, physio: { en: 'Physiotherapist', zh: '物理治疗师' }, other: { en: 'Other health professional', zh: '其他医护人员' } }[advice.professional];
    push(`- ${zh ? '看的是' : 'Seen'}: ${L(who)}`);
    push(`- ${zh ? '看过背部情况（包括麻木、刺痛、无力）' : 'Back history (incl. numbness, tingling, weakness) looked at'}: ${answerText(advice.assessedBackHistory, lang)}`);
    for (const id of PROGRAM.exerciseOrder) {
      const a = advice.exerciseApprovals[id];
      const text = zh ? { ok: '可以做', not_ok: '不适合', not_discussed: '没有讨论' }[a] : { ok: 'OK', not_ok: 'not suitable', not_discussed: 'not discussed' }[a];
      push(`- ${L(EXERCISES[id].name)}: ${text}`);
    }
    const prog = zh ? { yes: '可以', no: '不可以', not_discussed: '没有讨论' }[advice.progressionApproved] : { yes: 'yes', no: 'no', not_discussed: 'not discussed' }[advice.progressionApproved];
    push(`- ${zh ? '可以按阶段慢慢加量' : 'OK to build up through the stages'}: ${prog}${advice.maxStage ? (zh ? `（最多到第 ${advice.maxStage} 阶段）` : ` (up to Stage ${advice.maxStage})`) : ''}`);
    if (advice.restrictionsNote) push(`- ${zh ? '要避免或改动的' : 'To avoid or change'}: ${advice.restrictionsNote}`);
    if (advice.otherNotes) push(`- ${zh ? '其他' : 'Other notes'}: ${advice.otherNotes}`);
    push('');
  }

  if (data.clinicianPlan) {
    push(zh ? '我记录的居家练习（来自医护人员）' : 'Home exercises I was given (my own record)');
    push(data.clinicianPlan.text);
    push('');
  }

  push(zh ? '到目前为止的练习' : 'Practice so far');
  const dates = data.sessions.map((s) => s.localDate).sort();
  push(
    zh
      ? `- 练习 ${data.sessions.length} 次${dates.length ? `，最近一次 ${formatLocalDate(dates[dates.length - 1]!, 'zh')}` : ''}；现在是第 ${data.stage} 阶段。`
      : `- ${data.sessions.length} practice${data.sessions.length === 1 ? '' : 's'}${dates.length ? `, most recent ${formatLocalDate(dates[dates.length - 1]!, 'en')}` : ''}; currently Stage ${data.stage}.`,
  );
  const stops = data.sessions.filter((s) => s.symptomCodes.length > 0);
  for (const s of stops) {
    push(`- ${formatLocalDate(s.localDate, lang)}: ${zh ? '停下，因为' : 'stopped because of'} ${s.symptomCodes.map((c) => L(STOP_LABELS[c] ?? STOP_LABELS.other!)).join(', ')}`);
  }
  const worseNextDays = data.pendingNextDayChecks.filter((c) => c.response === 'worse');
  for (const c of worseNextDays) {
    push(`- ${formatLocalDate(c.sessionLocalDate, lang)}: ${zh ? '练习后的第二天比平时差' : 'the day after practice was worse than usual'}`);
  }
  push('');
  push(zh ? `（内容审核日期 ${CONTENT_REVIEW_DATE}。这份摘要只在手机上生成，没有发送到任何地方。）` : `(Content reviewed ${CONTENT_REVIEW_DATE}. This summary was made on the phone and was not sent anywhere.)`);
  return lines.join('\n');
}
