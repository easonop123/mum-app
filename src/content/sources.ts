import type { LocalizedText } from '../domain/types';

export interface SourceLink {
  id: string;
  label: LocalizedText;
  url: string;
  usedFor: LocalizedText;
}

// Guidance the app's copy and rules were checked against (supplied with the
// program on 2026-11-03). Links open the original publisher's page.
export const SOURCES: SourceLink[] = [
  {
    id: 'healthify-back-pain',
    label: { en: 'Healthify NZ — Back pain', zh: 'Healthify NZ（新西兰）— 背痛' },
    url: 'https://healthify.nz/health-a-z/b/back-pain',
    usedFor: {
      en: 'NZ advice to get leg numbness or weakness checked, and individual advice for recurring pain.',
      zh: '新西兰的建议：腿麻或无力要去看医生；反复背痛需要个别的建议。',
    },
  },
  {
    id: 'healthnz-emergency',
    label: { en: 'Health New Zealand — Emergency medical help', zh: '新西兰卫生局 — 紧急医疗帮助' },
    url: 'https://www.healthnz.govt.nz/health-topics/tests-and-treatments/emergencies-and-first-aid/emergency-medical-help',
    usedFor: {
      en: 'Emergency number 111 and Healthline 0800 611 116.',
      zh: '急救电话 111，健康热线 Healthline 0800 611 116。',
    },
  },
  {
    id: 'nhs-back-pain',
    label: { en: 'NHS — Back pain (including urgent symptoms)', zh: '英国 NHS — 背痛（包括紧急症状）' },
    url: 'https://www.nhs.uk/conditions/back-pain/',
    usedFor: {
      en: 'Wording of the emergency, urgent and "get it checked" symptom lists. NZ phone numbers are used instead of UK ones.',
      zh: '紧急症状、需要尽快就医和需要检查的症状清单的措辞。电话号码用新西兰的，不用英国的。',
    },
  },
  {
    id: 'nhs-strength',
    label: { en: 'NHS — Strength exercises', zh: '英国 NHS — 力量练习' },
    url: 'https://www.nhs.uk/live-well/exercise/strength-exercises/',
    usedFor: {
      en: 'The four movement families appear in NHS beginner guidance. The exact doses here are the supplied program, not NHS advice for you.',
      zh: '这四种动作都出现在 NHS 的入门指导里。本应用的次数来自给定的计划，不是 NHS 给你的建议。',
    },
  },
  {
    id: 'hk-doh-ep5',
    label: { en: 'Hong Kong Department of Health — Supported standing exercises (Traditional Chinese)', zh: '香港卫生署 — 扶着站立的运动（繁体中文）' },
    url: 'https://www.elderly.gov.hk/tc_chi/education_and_media_resources/files/EP5%E4%B8%8B%E8%82%A2%E5%B9%B3%E8%A1%A1_TC.pdf',
    usedFor: {
      en: 'Setup precautions such as stable support and clear space.',
      zh: '准备工作的注意事项，比如扶稳、留出空间。',
    },
  },
  {
    id: 'who-2020',
    label: { en: 'WHO 2020 guidelines on physical activity', zh: '世界卫生组织 2020 年身体活动指南' },
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/',
    usedFor: {
      en: 'Walking is worthwhile; adults are encouraged to work towards strengthening all major muscle groups on two or more days a week, starting small.',
      zh: '走路是有益的；成年人可以逐步做到每周两天以上、练到全身主要肌肉的力量练习，从少量开始。',
    },
  },
  {
    id: 'who-lbp',
    label: { en: 'WHO guideline on chronic low back pain (2023)', zh: '世界卫生组织慢性腰背痛指南（2023）' },
    url: 'https://www.who.int/news/item/07-12-2023-who-releases-guidelines-on-chronic-low-back-pain',
    usedFor: {
      en: 'Exercise can be part of individual care, but "back pain" is not a diagnosis. The app makes no claim to fix or cure anything.',
      zh: '运动可以是个人化照护的一部分，但“背痛”本身不是诊断。本应用不声称能治好或纠正任何问题。',
    },
  },
  {
    id: 'acsm-2026',
    label: { en: 'ACSM 2026 position stand on resistance training', zh: '美国运动医学会 2026 年力量训练立场声明' },
    url: 'https://journals.lww.com/acsm-msse/fulltext/2026/04000/american_college_of_sports_medicine_position.21.aspx',
    usedFor: {
      en: 'Participation, safety and enjoyment come first. Its findings are for healthy adults and are not a first-week prescription here.',
      zh: '参与、安全和愉快最重要。它的结论针对健康成年人，不是这里第一周的处方。',
    },
  },
  {
    id: 'habit-review-2024',
    label: { en: '2024 systematic review of habit-formation time', zh: '2024 年习惯养成时间的系统综述' },
    url: 'https://pubmed.ncbi.nlm.nih.gov/39685110/',
    usedFor: {
      en: 'Why the app never promises a habit in a fixed number of days.',
      zh: '为什么应用不会承诺“多少天养成习惯”。',
    },
  },
  {
    id: 'barts-videos',
    label: { en: 'Barts Health NHS Trust — exercise video page', zh: 'Barts Health NHS Trust — 运动视频页面' },
    url: 'https://www.bartshealth.nhs.uk/wellbeing-physiotherapy-and-pain-management-/',
    usedFor: {
      en: 'Where the sit-to-stand demonstration comes from.',
      zh: '坐站示范视频的出处。',
    },
  },
  {
    id: 'apple-web-app',
    label: { en: 'Apple — Open a website as a web app on iPhone', zh: 'Apple — 在 iPhone 上把网站作为网页 App 打开' },
    url: 'https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios',
    usedFor: {
      en: 'The Home Screen installation steps.',
      zh: '添加到主屏幕的步骤。',
    },
  },
  {
    id: 'webkit-storage',
    label: { en: 'WebKit — Updates to storage policy', zh: 'WebKit — 存储政策更新' },
    url: 'https://webkit.org/blog/14403/updates-to-storage-policy/',
    usedFor: {
      en: 'How Safari keeps website data. The app asks for persistent storage but cannot guarantee it — keep a backup.',
      zh: 'Safari 如何保存网站数据。应用会请求长期保存，但不能保证——请自己保留备份。',
    },
  },
];
