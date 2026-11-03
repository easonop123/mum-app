import { APP_VERSION, CONTENT_VERSION } from '../content/version';
import { programStatusFromAdvice } from '../program/prescription';
import { validateStoredData } from './db';
import type { AppData } from './schema';

// Export happens only on an explicit action, after a privacy preview.
// Import is size-limited, schema-validated, and never treated as fresh
// clearance: imported health answers must be answered again.

export const BACKUP_FORMAT = 'a-little-stronger-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_IMPORT_BYTES = 2_000_000;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
  contentVersion: string;
  data: AppData;
}

export interface PrivacySummary {
  healthAnswers: number;
  hasProfessionalAdvice: boolean;
  hasClinicianPlan: boolean;
  practiceSessions: number;
  firstPractice: string | null;
  lastPractice: string | null;
  notes: number;
  safetyHolds: number;
  hasName: boolean;
  hasBirthYear: boolean;
}

export function summarizeForPrivacy(data: AppData): PrivacySummary {
  const dates = data.sessions.map((s) => s.localDate).sort();
  const notes =
    data.sessions.filter((s) => s.note).length +
    (data.profile.encouragementNote ? 1 : 0) +
    (data.readiness.restrictionsNote ? 1 : 0) +
    (data.readiness.activityAdviceNote ? 1 : 0);
  return {
    healthAnswers: Object.keys(data.readiness.answers).length,
    hasProfessionalAdvice: data.professionalAdvice !== null,
    hasClinicianPlan: data.clinicianPlan !== null,
    practiceSessions: data.sessions.length,
    firstPractice: dates[0] ?? null,
    lastPractice: dates[dates.length - 1] ?? null,
    notes,
    safetyHolds: data.holds.length,
    hasName: !!data.profile.displayName,
    hasBirthYear: data.profile.birthYear !== null,
  };
}

export function buildBackup(data: AppData, now: string): BackupFile {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now,
    appVersion: APP_VERSION,
    contentVersion: CONTENT_VERSION,
    data,
  };
}

export function backupFileName(localDate: string): string {
  return `a-little-stronger-backup-${localDate}.json`;
}

export type ImportError = 'too_large' | 'not_json' | 'wrong_format' | 'newer_version' | 'invalid_data';

export type ImportResult =
  | { ok: true; data: AppData; summary: PrivacySummary; exportedAt: string }
  | { ok: false; error: ImportError; details: string[] };

/**
 * Validates a backup and prepares it for use on this device. The result:
 * - requires the health questions to be answered again (not fresh clearance);
 * - drops any in-progress session from the other device;
 * - derives the plan status only from the recorded advice (a file cannot
 *   simply claim "reviewed_for_use").
 */
export function parseBackupText(text: string, byteLength: number, now: string): ImportResult {
  if (byteLength > MAX_IMPORT_BYTES || text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'too_large', details: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not_json', details: [] };
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { format?: unknown }).format !== BACKUP_FORMAT) {
    return { ok: false, error: 'wrong_format', details: [] };
  }
  const envelope = parsed as Partial<BackupFile>;
  if (typeof envelope.formatVersion !== 'number' || envelope.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'newer_version', details: [] };
  }
  const validated = validateStoredData(envelope.data);
  if (!validated.ok) {
    return { ok: false, error: validated.errors.includes('newer_version') ? 'newer_version' : 'invalid_data', details: validated.errors };
  }
  const data = validated.data;
  const derivedStatus = data.programStatus === 'paused_for_review' ? 'paused_for_review' : programStatusFromAdvice(data.professionalAdvice);
  const prepared: AppData = {
    ...data,
    programStatus: derivedStatus,
    activeSession: null,
    readiness: { ...data.readiness, rescreenRequired: { reason: 'imported', since: now } },
    updatedAt: now,
  };
  return {
    ok: true,
    data: prepared,
    summary: summarizeForPrivacy(prepared),
    exportedAt: typeof envelope.exportedAt === 'string' ? envelope.exportedAt : '',
  };
}
