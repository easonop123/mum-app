import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { App } from '../src/App';
import { closeDatabaseForTests, openDatabase } from '../src/data/db';
import { fixedNow } from './appStates';

const NOW = '2026-11-03T00:00:00.000Z';

/** A record as the first released version stored it, in the "waiting for medical advice" state. */
const v1Record = {
  schemaVersion: 1,
  contentVersion: 'mum-home-foundation-v2@2026-11-03+copy-2026-11-03.1+media-2026-11-03.1',
  profile: { optedIn: true, language: 'en', languageConfirmed: true, voice: 'off', textScale: 1, region: 'NZ', regionConfirmed: true, displayName: null, birthYear: null, goal: null, goalText: null, encouragementNote: null },
  readiness: { answers: { emergencySigns: 'no', spreadingNumbWeak: 'yes' }, answeredAt: NOW, contentVersion: 'x', rescreenRequired: null, restrictionsNote: null, activityAdviceNote: null },
  programId: 'mum-home-foundation-v2',
  programStatus: 'assessment_pending',
  stage: 1,
  stageFullSessionCredits: [],
  professionalAdvice: null,
  clinicianPlan: null,
  equipment: [{ id: 'home-setup', kind: 'setup_check', items: {}, completedAt: null }],
  schedule: { weekdays: ['Tuesday', 'Friday'], timezone: 'Pacific/Auckland', cue: null, reminderTime: null },
  exerciseProgress: {},
  sessions: [],
  pendingNextDayChecks: [],
  holds: [{ id: 'h1', createdAt: NOW, localDate: '2026-11-03', source: 'screening', state: 'review_before_program', kind: 'recheck_required', reasonCodes: [], resolvedAt: null, resolution: null }],
  progression: { lastComfortableStage: null, stageStartedAt: NOW, returnMode: null, declinedOffer: null, stageChanges: [] },
  activeSession: null,
  learningVisits: [],
  createdAt: NOW,
  updatedAt: NOW,
};

async function putRaw(value: unknown) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, 'appData');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRaw(): Promise<Record<string, unknown>> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv', 'readonly').objectStore('kv').get('appData');
    req.onsuccess = () => resolve(req.result as Record<string, unknown>);
    req.onerror = () => reject(req.error);
  });
}

beforeEach(async () => {
  await closeDatabaseForTests();
  globalThis.indexedDB = new IDBFactory();
});

describe('upgrading a phone that has the first version installed', () => {
  it('unlocks practice and rewrites stored data without the old health answers', async () => {
    await putRaw(v1Record);
    window.location.hash = '#/';
    render(<App store={{ now: fixedNow }} />);
    expect(await screen.findByRole('link', { name: "Start today's practice" })).toBeInTheDocument();
    expect(screen.queryByText(/paused|waiting for medical advice/i)).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    const stored = await getRaw();
    expect(stored.schemaVersion).toBe(2);
    for (const gone of ['readiness', 'holds', 'professionalAdvice', 'pendingNextDayChecks', 'programStatus']) {
      expect(stored).not.toHaveProperty(gone);
    }
  });
});
