import { SCHEMA_VERSION } from './schema';

// Versioned migration runner. Each entry upgrades stored data from version N
// to N+1. Version 1 is the first released schema, so the table is empty; the
// runner itself is unit-tested with a synthetic migration.

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

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
