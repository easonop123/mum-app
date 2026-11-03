import { SCHEMA_VERSION } from './schema';

// Versioned migration runner. Each entry upgrades stored data from version N
// to N+1. Unknown shapes fail validation afterwards (and are quarantined),
// so a migration only has to map the fields it knows.

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * v1 → v2: the app no longer has health screening, approval or check-in
 * steps. Stored health answers, professional-advice notes, safety holds,
 * next-day answers, goals/cues and equipment checks are DELETED; practice
 * history, stage, schedule and settings are kept.
 */
export function migrateV1toV2(raw: Obj): Obj {
  const profile = obj(raw.profile);
  const schedule = obj(raw.schedule);
  const progression = obj(raw.progression);

  const sessions = arr(raw.sessions).map((value) => {
    const s = obj(value);
    const prescription = obj(s.prescription);
    const mode = s.mode === 'tiny' ? 'tiny' : 'full'; // v1 "return" sessions become ordinary practices
    const outcome = s.outcome === 'full_dose' ? 'full_dose' : s.outcome === 'partial' ? 'partial' : 'stopped';
    return {
      id: s.id,
      mode,
      programId: s.programId,
      contentVersion: s.contentVersion,
      stage: s.stage,
      prescription: {
        programId: prescription.programId,
        contentVersion: prescription.contentVersion,
        mode,
        stage: prescription.stage,
        items: prescription.items,
        addedLoadKg: prescription.addedLoadKg,
        restSeconds: prescription.restSeconds,
        minimumRestSeconds: prescription.minimumRestSeconds ?? null,
      },
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      localDate: s.localDate,
      timezone: s.timezone,
      warmup: s.warmup ?? null,
      performed: s.performed,
      outcome,
      creditEarned: mode === 'full' && outcome === 'full_dose' && s.mode !== 'return',
    };
  });

  const credited = new Set(sessions.filter((s) => s.creditEarned && s.stage === raw.stage).map((s) => s.id as string));
  const reasonMap: Record<string, string> = { user_accepted_offer: 'user_accepted_offer', short_gap_return: 'gap_restart', long_gap_return_started: 'gap_restart', long_gap_return_restored: 'gap_restart', long_gap_rebuild: 'gap_restart' };

  return {
    schemaVersion: raw.schemaVersion,
    contentVersion: raw.contentVersion,
    profile: {
      optedIn: profile.optedIn === true,
      language: profile.language,
      voice: profile.voice,
      textScale: profile.textScale,
      displayName: profile.displayName ?? null,
      encouragementNote: profile.encouragementNote ?? null,
    },
    programId: raw.programId,
    stage: raw.stage,
    stageFullSessionCredits: arr(raw.stageFullSessionCredits).filter((id) => typeof id === 'string' && credited.has(id)),
    schedule: {
      weekdays: schedule.weekdays,
      timezone: schedule.timezone,
      reminderTime: schedule.reminderTime ?? null,
    },
    sessions,
    progression: {
      stageStartedAt: progression.stageStartedAt,
      declinedOffer: progression.declinedOffer ?? null,
      stageChanges: arr(progression.stageChanges).map((value) => {
        const c = obj(value);
        return { at: c.at, from: c.from, to: c.to, reason: reasonMap[String(c.reason)] ?? 'manual' };
      }),
    },
    // An in-progress practice from the old version is dropped rather than resumed.
    activeSession: null,
    learningVisits: arr(raw.learningVisits),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export const MIGRATIONS: Readonly<Record<number, Migration>> = { 1: migrateV1toV2 };

export type MigrationResult =
  | { ok: true; value: Record<string, unknown>; migratedFrom: number | null }
  | { ok: false; error: 'not_an_object' | 'missing_version' | 'newer_version' | 'no_migration_path' };

export function migrateToCurrent(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  current: number = SCHEMA_VERSION,
): MigrationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'not_an_object' };
  let value = { ...(raw as Record<string, unknown>) };
  const version = value.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) return { ok: false, error: 'missing_version' };
  if (version > current) return { ok: false, error: 'newer_version' };
  let v = version;
  while (v < current) {
    const step = migrations[v];
    if (!step) return { ok: false, error: 'no_migration_path' };
    value = { ...step(value), schemaVersion: v + 1 };
    v += 1;
  }
  return { ok: true, value, migratedFrom: version === current ? null : version };
}
