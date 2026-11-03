import { describe, expect, it } from 'vitest';
import manifest from './video-manifest.json';
import { EXERCISE_IDS } from '../domain/types';
import { EXERCISES } from './exercises';
import { EDUCATION_ENTRIES, VIDEO_ENTRIES, demonstrationsFor, embedUrlFor, isWellFormedYouTubeEntry, needsDoseNote } from './videos';

const REQUIRED_FIELDS = [
  'exerciseId', 'variantId', 'watchUrl', 'publisher', 'videoId', 'durationSeconds', 'spokenLanguage', 'captionLanguage',
  'sourceCheckedAt', 'visualReviewStatus', 'playbackTested', 'embedTested', 'regionTested', 'doseMismatchNote', 'offlineRights',
];

// The exact candidates supplied with the program (IDs from the source links).
const SUPPLIED = {
  'chair-sit-to-stand': ['gJys6ExNtXA', 'Barts Health NHS Trust', 40],
  'wall-press-up': ['eQJ-8nD5UvE', 'The Rotherham NHS Foundation Trust', 23],
  'supported-heel-raise': ['zpIkRgojpiY', 'NHS Lanarkshire', 18],
  'supported-side-leg-lift': ['vgjRPoMkpeY', 'NHS Lanarkshire', 32],
} as const;

describe('demonstration video manifest (cases 12–15)', () => {
  it('every entry has every required field (null/unknown allowed, never omitted)', () => {
    for (const entry of manifest.entries) {
      for (const field of REQUIRED_FIELDS) expect(entry, `${entry.variantId}.${field}`).toHaveProperty(field);
    }
  });

  it('every active movement has a real primary candidate with the supplied ID and publisher (case 12)', () => {
    for (const id of EXERCISE_IDS) {
      const primary = demonstrationsFor(id).find((e) => e.platform === 'youtube' && e.role === 'primary');
      expect(primary, id).toBeDefined();
      expect(primary!.role).toBe('primary');
      const [videoId, publisher, duration] = SUPPLIED[id];
      expect(primary!.videoId).toBe(videoId);
      expect(primary!.publisher).toBe(publisher);
      expect(primary!.durationSeconds).toBe(duration);
      expect(isWellFormedYouTubeEntry(primary!)).toBe(true);
    }
  });

  it('records the Chinese candidates and the reference-only elbow curl exactly as supplied', () => {
    const ids = VIDEO_ENTRIES.map((e) => e.videoId);
    expect(ids).toEqual(expect.arrayContaining(['6PQvoFaMIe4', 'UUX-dPAb69Y', '2X9EIw9EEWU']));
    const curl = VIDEO_ENTRIES.find((e) => e.videoId === '2X9EIw9EEWU')!;
    expect(curl.role).toBe('reference-only');
    expect(EXERCISE_IDS as readonly string[]).not.toContain(curl.exerciseId);
    expect(EDUCATION_ENTRIES.map((e) => [e.videoId, e.durationSeconds])).toEqual([['OwOqJWVpiQM', 412], ['8SRXcb-YtDw', 639]]);
    expect(EDUCATION_ENTRIES[0]!.spokenLanguage).not.toBe('cmn');
  });

  it('nothing is claimed as tested, reviewed or available offline (cases 14–15)', () => {
    for (const e of VIDEO_ENTRIES) {
      expect(e.offlineRights).toBe('none');
      expect(e.playbackTested).not.toBe(true);
      expect(e.embedTested).not.toBe(true);
      expect(e.regionTested).not.toBe(true);
      expect(e.visualReviewStatus).toBe('pending');
      expect(e.watchUrl).not.toMatch(/\.mp4/);
      expect(JSON.stringify(e)).not.toMatch(/clinically approved/i);
    }
  });

  it('videos with a reported or unchecked dose show the dose note (case 13)', () => {
    const heel = VIDEO_ENTRIES.find((e) => e.videoId === 'zpIkRgojpiY')!;
    const hip = VIDEO_ENTRIES.find((e) => e.videoId === 'vgjRPoMkpeY')!;
    expect(needsDoseNote(heel)).toBe(true);
    expect(needsDoseNote(hip)).toBe(true);
    for (const e of VIDEO_ENTRIES.filter((v) => v.role === 'chinese-candidate')) expect(needsDoseNote(e)).toBe(true);
  });

  it('embeds use the privacy-enhanced player and are never autoplay', () => {
    const url = embedUrlFor(VIDEO_ENTRIES[0]!);
    expect(url).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/gJys6ExNtXA\?/);
    expect(url).not.toMatch(/autoplay=1/);
  });

  it('the exercise catalogue covers exactly the four supplied movements with three cues each', () => {
    expect(Object.keys(EXERCISES).sort()).toEqual([...EXERCISE_IDS].sort());
    for (const id of EXERCISE_IDS) {
      expect(EXERCISES[id].cues.en).toHaveLength(3);
      expect(EXERCISES[id].cues.zh).toHaveLength(3);
    }
    expect(EXERCISES['chair-sit-to-stand'].supplied.technique).toBe(
      'Stable armless chair against wall, feet planted hip-width apart, comfortable forward lean, stand smoothly and sit slowly. Hands on thighs may help; no stacked cushions. One stand plus return to sitting = one rep.',
    );
  });
});

describe('owned local clips (future fully-Chinese/offline upgrade)', () => {
  const base = VIDEO_ENTRIES[0]!;
  it('are used only with recorded rights and a safe local path, and only then count as offline', async () => {
    const { isUsableLocalClip, availableOffline } = await import('./videos');
    const owned = { ...base, platform: 'local' as const, localSrc: 'media/sit-to-stand-zh.mp4', offlineRights: 'owned' as const };
    expect(isUsableLocalClip(owned)).toBe(true);
    expect(availableOffline(owned)).toBe(true);
    expect(isUsableLocalClip({ ...owned, offlineRights: 'none' })).toBe(false);
    expect(isUsableLocalClip({ ...owned, localSrc: 'https://example.com/x.mp4' })).toBe(false);
    expect(isUsableLocalClip({ ...owned, localSrc: 'media/../../etc.mp4' })).toBe(false);
    expect(availableOffline(base)).toBe(false);
    // A usable local clip is listed first for its movement; an unlicensed one is ignored.
    expect(demonstrationsFor('chair-sit-to-stand', [base, owned])[0]).toBe(owned);
    expect(demonstrationsFor('chair-sit-to-stand', [base, { ...owned, offlineRights: 'none' }])).toEqual([base]);
  });
});
