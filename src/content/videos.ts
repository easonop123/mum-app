import manifest from './video-manifest.json';
import type { ExerciseId, LocalizedText } from '../domain/types';

export type VideoRole = 'primary' | 'chinese-candidate' | 'reference-only';

export interface VideoManifestEntry {
  exerciseId: string;
  variantId: string;
  role: VideoRole;
  label: LocalizedText;
  watchUrl: string;
  /** 'local' = a legally owned/licensed clip hosted with the app (e.g. public/media/...). */
  platform: 'youtube' | 'local';
  /** For platform 'local': path relative to the app, e.g. 'media/sit-to-stand-zh.mp4'. */
  localSrc?: string;
  /** For platform 'local': optional WebVTT captions file. */
  captionsSrc?: string;
  publisher: string;
  publisherPageUrl: string | null;
  videoId: string;
  durationSeconds: number | null;
  spokenLanguage: string | null;
  spokenLanguageNote?: string;
  captionLanguage: string | null;
  sourceCheckedAt: string | null;
  sourceCheckedBy: 'supplied-research' | 'build-tooling' | 'manual';
  visualReviewStatus: 'pending' | 'approved' | 'rejected';
  playbackTested: boolean | null;
  embedTested: boolean | null;
  regionTested: boolean | null;
  doseMismatchNote: string | null;
  videoDoseCheck: 'mismatch-reported' | 'none-reported' | 'not-checked';
  offlineRights: 'none' | 'owned' | 'licensed';
  qualification: LocalizedText;
}

export interface EducationEntry {
  id: string;
  role: 'longer-education';
  label: LocalizedText;
  publisher: string;
  pageUrl: string;
  watchUrl: string;
  videoId: string;
  durationSeconds: number;
  transcriptUrl: string | null;
  transcriptLanguage: string | null;
  spokenLanguage: string | null;
  spokenLanguageNote: string;
  note: LocalizedText;
}

export const VIDEO_MANIFEST_VERSION: string = manifest.manifestVersion;
export const VIDEO_VERIFICATION_NOTE: string = manifest.verificationNote;
export const VIDEO_ENTRIES: VideoManifestEntry[] = manifest.entries as VideoManifestEntry[];
export const EDUCATION_ENTRIES: EducationEntry[] = manifest.education as EducationEntry[];

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isWellFormedYouTubeEntry(entry: Pick<VideoManifestEntry, 'videoId' | 'watchUrl'>): boolean {
  return YOUTUBE_ID.test(entry.videoId) && entry.watchUrl === `https://www.youtube.com/watch?v=${entry.videoId}`;
}

/** A local clip may only be used (and cached for offline) with recorded ownership or a licence. */
export function isUsableLocalClip(entry: VideoManifestEntry): boolean {
  return (
    entry.platform === 'local' &&
    typeof entry.localSrc === 'string' &&
    /^media\/[A-Za-z0-9._/-]+\.(mp4|webm)$/.test(entry.localSrc) &&
    !entry.localSrc.split('/').includes('..') &&
    (entry.offlineRights === 'owned' || entry.offlineRights === 'licensed')
  );
}

/** Only owned/licensed local clips are ever available offline; streamed video never is. */
export function availableOffline(entry: VideoManifestEntry): boolean {
  return isUsableLocalClip(entry);
}

/** Privacy-enhanced embed URL. Loaded only after the person taps "watch". */
export function embedUrlFor(entry: VideoManifestEntry): string {
  return `https://www.youtube-nocookie.com/embed/${entry.videoId}?rel=0&playsinline=1&modestbranding=1`;
}

/** Demonstrations for one routine exercise: the primary first, then Chinese-language candidates. */
export function demonstrationsFor(exerciseId: ExerciseId, entries: VideoManifestEntry[] = VIDEO_ENTRIES): VideoManifestEntry[] {
  const forExercise = entries.filter(
    (e) => e.exerciseId === exerciseId && e.role !== 'reference-only' && (e.platform === 'youtube' || isUsableLocalClip(e)),
  );
  // Reviewed local clips (if the family adds them) come first, then the primary, then candidates.
  return [
    ...forExercise.filter((e) => e.platform === 'local'),
    ...forExercise.filter((e) => e.platform !== 'local' && e.role === 'primary'),
    ...forExercise.filter((e) => e.platform !== 'local' && e.role === 'chinese-candidate'),
  ];
}

/** Show the "follow this page's counts" sentence beside videos with a reported or unchecked dose. */
export function needsDoseNote(entry: VideoManifestEntry): boolean {
  return entry.doseMismatchNote !== null || entry.videoDoseCheck !== 'none-reported';
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '?';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
