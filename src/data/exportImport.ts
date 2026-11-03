import { APP_VERSION, CONTENT_VERSION } from '../content/version';
import { validateStoredData } from './db';
import type { AppData } from './schema';

// Export happens only on an explicit action, after a preview. Import is
// size-limited and schema-validated; older backups are migrated.

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
  practiceSessions: number;
  firstPractice: string | null;
  lastPractice: string | null;
  hasNote: boolean;
  hasName: boolean;
}

export function summarizeForPrivacy(data: AppData): PrivacySummary {
  const dates = data.sessions.map((s) => s.localDate).sort();
  return {
    practiceSessions: data.sessions.length,
    firstPractice: dates[0] ?? null,
    lastPractice: dates[dates.length - 1] ?? null,
    hasNote: !!data.profile.encouragementNote,
    hasName: !!data.profile.displayName,
  };
}

export function buildBackup(data: AppData, now: string): BackupFile {
  return { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now, appVersion: APP_VERSION, contentVersion: CONTENT_VERSION, data };
}

export function backupFileName(localDate: string): string {
  return `a-little-stronger-backup-${localDate}.json`;
}

export type ImportError = 'too_large' | 'not_json' | 'wrong_format' | 'newer_version' | 'invalid_data';

export type ImportResult =
  | { ok: true; data: AppData; summary: PrivacySummary; exportedAt: string }
  | { ok: false; error: ImportError; details: string[] };

/** Validates (and if needed migrates) a backup. An in-progress practice is never carried over. */
export function parseBackupText(text: string, byteLength: number, now: string): ImportResult {
  if (byteLength > MAX_IMPORT_BYTES || text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'too_large', details: [] };
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
  const prepared: AppData = { ...validated.data, activeSession: null, updatedAt: now };
  return { ok: true, data: prepared, summary: summarizeForPrivacy(prepared), exportedAt: typeof envelope.exportedAt === 'string' ? envelope.exportedAt : '' };
}
