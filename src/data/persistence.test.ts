import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createInitialAppData } from './defaults';
import { closeDatabaseForTests, deleteAllLocalData, listQuarantine, loadAppData, openDatabase, saveAppData, StorageError } from './db';
import { buildBackup, parseBackupText, MAX_IMPORT_BYTES, summarizeForPrivacy } from './exportImport';
import { migrateToCurrent } from './migrations';
import { AppDataSchema } from './schema';
import { migrateV1toV2 } from './migrations';
import { validateStoredData } from './db';
import { makeSession } from '../../tests/factories';

const NOW = '2026-11-03T21:00:00.000Z';

beforeEach(async () => {
  await closeDatabaseForTests();
  globalThis.indexedDB = new IDBFactory();
});
afterEach(async () => {
  await closeDatabaseForTests();
});

describe('initial data', () => {
  it('contains no personal details, history or progress (case 23)', () => {
    const d = createInitialAppData(NOW);
    expect(d.sessions).toEqual([]);
    expect(d.profile.displayName).toBeNull();
    expect(d.stage).toBe(1);
    expect(JSON.stringify(d)).not.toMatch(/readiness|advice|hold/i);
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

  it('v1 → v2 deletes stored health answers, advice and holds, and keeps practice history', () => {
    const full = makeSession({ stage: 2, localDate: '2026-11-03' });
    const v1Session = {
      ...full,
      planStageAtStart: 2,
      checkIn: { newOrWorse: 'no', emergencySigns: null, urgentSigns: null },
      feeling: 'comfortable',
      controlledMovement: 'yes',
      couldDoMore: 'yes',
      effort: null,
      symptomCodes: [],
      note: null,
      holdId: null,
      userApprovedChanges: [],
    };
    const v1 = {
      schemaVersion: 1,
      contentVersion: 'mum-home-foundation-v2@2026-11-03+copy-2026-11-03.1+media-2026-11-03.1',
      profile: { optedIn: true, language: 'zh', languageConfirmed: true, voice: 'mandarin', textScale: 1.3, region: 'NZ', regionConfirmed: true, displayName: null, birthYear: 1980, goal: 'standing', goalText: null, encouragementNote: '慢慢来' },
      readiness: { answers: { spreadingNumbWeak: 'unsure' }, answeredAt: NOW, contentVersion: 'x', rescreenRequired: null, restrictionsNote: 'private', activityAdviceNote: null },
      programId: 'mum-home-foundation-v2',
      programStatus: 'assessment_pending',
      stage: 2,
      stageFullSessionCredits: [full.id],
      professionalAdvice: null,
      clinicianPlan: null,
      equipment: [{ id: 'home-setup', kind: 'setup_check', items: {}, completedAt: null }],
      schedule: { weekdays: ['Monday', 'Thursday'], timezone: 'Pacific/Auckland', cue: 'morning tea', reminderTime: null },
      exerciseProgress: {},
      sessions: [v1Session],
      pendingNextDayChecks: [{ sessionId: full.id, sessionLocalDate: '2026-11-03', status: 'pending', response: null, answeredAt: null }],
      holds: [{ id: 'h1', createdAt: NOW, localDate: '2026-11-03', source: 'check_in', state: 'review_before_program', kind: 'recheck_required', reasonCodes: ['check_in_unsure'], resolvedAt: null, resolution: null }],
      progression: { lastComfortableStage: 1, stageStartedAt: NOW, returnMode: null, declinedOffer: null, stageChanges: [{ at: NOW, from: 1, to: 2, reason: 'user_accepted_offer' }] },
      activeSession: null,
      learningVisits: ['2026-11-02'],
      createdAt: NOW,
      updatedAt: NOW,
    };
    const result = validateStoredData(v1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(1);
    const d = result.data;
    expect(d.schemaVersion).toBe(2);
    expect(d.stage).toBe(2);
    expect(d.profile).toEqual({ optedIn: true, language: 'zh', voice: 'mandarin', textScale: 1.3, displayName: null, encouragementNote: '慢慢来' });
    expect(d.schedule.weekdays).toEqual(['Monday', 'Thursday']);
    expect(d.sessions).toHaveLength(1);
    expect(d.sessions[0]).toMatchObject({ id: full.id, outcome: 'full_dose', creditEarned: true });
    expect(d.stageFullSessionCredits).toEqual([full.id]);
    expect(d.learningVisits).toEqual(['2026-11-02']);
    const text = JSON.stringify(d);
    for (const gone of ['readiness', 'spreadingNumbWeak', 'restrictionsNote', 'holds', 'pendingNextDayChecks', 'birthYear', 'professionalAdvice', 'checkIn', 'feeling']) {
      expect(text).not.toContain(gone);
    }
    expect(migrateV1toV2({}).activeSession).toBeNull();
  });
});

describe('export / import (case 17)', () => {
  function populated() {
    const d = createInitialAppData(NOW);
    const s = makeSession({ localDate: '2026-11-03' });
    return { ...d, profile: { ...d.profile, optedIn: true, encouragementNote: 'Keep going' }, sessions: [s], stageFullSessionCredits: [s.id] };
  }

  it('round-trips through a backup file', () => {
    const d = populated();
    const text = JSON.stringify(buildBackup(d, NOW));
    const result = parseBackupText(text, text.length, '2026-11-05T00:00:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sessions).toEqual(d.sessions);
    expect(result.data.profile.encouragementNote).toBe('Keep going');
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

  it('preview counts what the file will contain', () => {
    expect(summarizeForPrivacy(populated())).toMatchObject({ practiceSessions: 1, hasNote: true, hasName: false });
  });
});
