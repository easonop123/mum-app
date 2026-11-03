import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createInitialAppData } from './defaults';
import { closeDatabaseForTests, deleteAllLocalData, listQuarantine, loadAppData, openDatabase, saveAppData, StorageError } from './db';
import { buildBackup, parseBackupText, MAX_IMPORT_BYTES, summarizeForPrivacy } from './exportImport';
import { migrateToCurrent } from './migrations';
import { AppDataSchema } from './schema';
import { commitScreening, recordProfessionalAdvice, type Ctx } from './actions';
import { programAccess, readinessDecision } from './selectors';
import { CLEAR_ANSWERS, approvedAdvice } from '../../tests/factories';

const NOW = '2026-11-03T21:00:00.000Z';
let n = 0;
const ctx: Ctx = { now: NOW, today: '2026-11-04', newId: () => `id-${++n}` };

beforeEach(async () => {
  await closeDatabaseForTests();
  globalThis.indexedDB = new IDBFactory();
});
afterEach(async () => {
  await closeDatabaseForTests();
});

describe('initial data', () => {
  it('contains no personal health answers, history or progress (case 23)', () => {
    const d = createInitialAppData(NOW);
    expect(d.readiness.answers).toEqual({});
    expect(d.sessions).toEqual([]);
    expect(d.holds).toEqual([]);
    expect(d.professionalAdvice).toBeNull();
    expect(d.profile.displayName).toBeNull();
    expect(d.profile.birthYear).toBeNull();
    expect(d.programStatus).toBe('assessment_pending');
    expect(AppDataSchema.safeParse(d).success).toBe(true);
  });
});

describe('IndexedDB persistence', () => {
  it('starts empty, then round-trips validated data', async () => {
    expect((await loadAppData()).status).toBe('empty');
    const d = createInitialAppData(NOW);
    await saveAppData(d);
    const loaded = await loadAppData();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.data).toEqual(d);
  });

  it('refuses to save invalid data instead of faking a save', async () => {
    const bad = { ...createInitialAppData(NOW), stage: 9 } as unknown as Parameters<typeof saveAppData>[0];
    await expect(saveAppData(bad)).rejects.toBeInstanceOf(StorageError);
  });

  it('corrupted storage is quarantined (not silently dropped) and reported (case 17)', async () => {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ schemaVersion: 1, stage: 'banana' }, 'appData');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const result = await loadAppData();
    expect(result.status).toBe('corrupt');
    if (result.status === 'corrupt') expect(result.quarantined).toBe(true);
    const q = await listQuarantine();
    expect(q).toHaveLength(1);
    expect(q[0]!.raw).toContain('banana');
    // Recovery: starting fresh writes valid data again.
    await saveAppData(createInitialAppData(NOW));
    expect((await loadAppData()).status).toBe('ok');
  });

  it('delete removes everything, including quarantined copies', async () => {
    await saveAppData(createInitialAppData(NOW));
    await deleteAllLocalData();
    expect((await loadAppData()).status).toBe('empty');
    expect(await listQuarantine()).toEqual([]);
  });
});

describe('versioned migration', () => {
  it('runs each step in order and records where it started', () => {
    const migrations = { 1: (raw: Record<string, unknown>) => ({ ...raw, added: true }) };
    const result = migrateToCurrent({ schemaVersion: 1, x: 1 }, migrations, 2);
    expect(result).toEqual({ ok: true, value: { schemaVersion: 2, x: 1, added: true }, migratedFrom: 1 });
  });
  it('rejects newer, unknown or versionless data', () => {
    expect(migrateToCurrent({ schemaVersion: 3 }, {}, 1)).toMatchObject({ ok: false, error: 'newer_version' });
    expect(migrateToCurrent({ schemaVersion: 0 }, {}, 1)).toMatchObject({ ok: false, error: 'no_migration_path' });
    expect(migrateToCurrent({}, {}, 1)).toMatchObject({ ok: false, error: 'missing_version' });
    expect(migrateToCurrent([], {}, 1)).toMatchObject({ ok: false, error: 'not_an_object' });
  });
});

describe('export / import (case 17)', () => {
  function populated() {
    let d = createInitialAppData(NOW);
    d = commitScreening(d, CLEAR_ANSWERS, {}, true, ctx);
    d = recordProfessionalAdvice(d, approvedAdvice(), ctx);
    return d;
  }

  it('round-trips through a backup file', () => {
    const d = populated();
    const text = JSON.stringify(buildBackup(d, NOW));
    const result = parseBackupText(text, text.length, '2026-11-05T00:00:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sessions).toEqual(d.sessions);
    expect(result.data.professionalAdvice).toEqual(d.professionalAdvice);
    expect(result.data.readiness.answers).toEqual(d.readiness.answers);
  });

  it('imported screening is never treated as fresh clearance (case 25)', () => {
    const d = populated();
    expect(programAccess(d, '2026-11-04').blockedBy).toBe('setup'); // reviewed, only setup left
    const text = JSON.stringify(buildBackup(d, NOW));
    const result = parseBackupText(text, text.length, '2026-11-05T00:00:00.000Z');
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.readiness.rescreenRequired?.reason).toBe('imported');
    expect(readinessDecision(result.data).state).toBe('onboarding_needed');
    expect(programAccess(result.data, '2026-11-05').canStartFull).toBe(false);
  });

  it('a file cannot simply claim the plan was reviewed', () => {
    const d = { ...createInitialAppData(NOW), programStatus: 'reviewed_for_use' as const };
    const text = JSON.stringify({ format: 'a-little-stronger-backup', formatVersion: 1, exportedAt: NOW, data: d });
    const result = parseBackupText(text, text.length, NOW);
    expect(result.ok).toBe(false); // schema: reviewed_for_use requires an advice record
    const withBadAdvice = { ...populated(), professionalAdvice: approvedAdvice({ assessedBackHistory: 'no' }), programStatus: 'reviewed_for_use' as const };
    const text2 = JSON.stringify(buildBackup(withBadAdvice, NOW));
    const r2 = parseBackupText(text2, text2.length, NOW);
    if (!r2.ok) throw new Error('expected ok');
    expect(r2.data.programStatus).toBe('assessment_pending');
  });

  it('rejects oversized, non-JSON, foreign and malformed files without changing anything', () => {
    expect(parseBackupText('x', MAX_IMPORT_BYTES + 1, NOW)).toMatchObject({ ok: false, error: 'too_large' });
    expect(parseBackupText('{not json', 9, NOW)).toMatchObject({ ok: false, error: 'not_json' });
    expect(parseBackupText('{"hello":"world"}', 17, NOW)).toMatchObject({ ok: false, error: 'wrong_format' });
    const malformed = JSON.stringify({ format: 'a-little-stronger-backup', formatVersion: 1, data: { ...createInitialAppData(NOW), stage: 12 } });
    expect(parseBackupText(malformed, malformed.length, NOW)).toMatchObject({ ok: false, error: 'invalid_data' });
    const extraKey = JSON.stringify({ format: 'a-little-stronger-backup', formatVersion: 1, data: { ...createInitialAppData(NOW), injected: '<script>' } });
    expect(parseBackupText(extraKey, extraKey.length, NOW)).toMatchObject({ ok: false, error: 'invalid_data' });
    const future = JSON.stringify({ format: 'a-little-stronger-backup', formatVersion: 99, data: {} });
    expect(parseBackupText(future, future.length, NOW)).toMatchObject({ ok: false, error: 'newer_version' });
  });

  it('privacy preview counts what the file will contain', () => {
    const s = summarizeForPrivacy(populated());
    expect(s.healthAnswers).toBe(Object.keys(CLEAR_ANSWERS).length);
    expect(s.hasProfessionalAdvice).toBe(true);
    expect(s.practiceSessions).toBe(0);
  });
});
