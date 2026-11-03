import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import programJson from '../content/program.json';
import catalogue from '../content/exercise-catalogue.json';
// @ts-expect-error — plain ESM helper shared with the docs generator
import { renderProgramMarkdown } from '../../scripts/program-doc.mjs';
import { buildPracticeIcs, foldLine } from './ics';
import { canApplyUpdate } from '../pwa/updateGuard';

describe('calendar file (.ics) — a deliberate, user-imported reminder', () => {
  const ics = buildPracticeIcs({
    weekdays: ['Tuesday', 'Friday'],
    time: '10:00',
    timezone: 'Pacific/Auckland',
    firstDate: '2026-11-03',
    title: '一点力 · A little practice',
    description: 'Open 一点力 when you are ready, rest is fine too; really.',
    uid: 'test-uid@a-little-stronger.app',
    nowIso: '2026-11-02T21:00:00.000Z',
  });

  it('is a valid weekly recurring event in the schedule time zone', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;TZID=Pacific/Auckland:20261103T100000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,FR');
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:Pacific/Auckland');
    expect(ics).toContain('DTSTAMP:20261102T210000Z');
    expect(ics).toContain('DESCRIPTION:Open 一点力 when you are ready\\, rest is fine too\; really.');
  });

  it('uses CRLF line endings and folds long lines to ≤ 75 octets', () => {
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
    const folded = foldLine('DESCRIPTION:' + '很'.repeat(60));
    expect(folded.split('\r\n ').every((part) => new TextEncoder().encode(part).length <= 75)).toBe(true);
  });

  it('rejects an invalid time instead of guessing', () => {
    expect(() => buildPracticeIcs({ weekdays: ['Monday'], time: '25:00', timezone: 'Pacific/Auckland', firstDate: '2026-11-02', title: 'x', description: 'y', uid: 'u', nowIso: '2026-11-02T00:00:00.000Z' })).toThrow();
  });
});

describe('service-worker update guard (case 21)', () => {
  it('never applies an update during a practice', () => {
    expect(canApplyUpdate({ hasActiveSession: true, routePath: '/' })).toBe(false);
    expect(canApplyUpdate({ hasActiveSession: false, routePath: '/session/full' })).toBe(false);
    expect(canApplyUpdate({ hasActiveSession: false, routePath: '/progress' })).toBe(true);
  });
});

describe('generated program document', () => {
  it('docs/PROGRAM.md is up to date with the JSON source of truth', () => {
    const expected = renderProgramMarkdown(programJson, catalogue);
    const actual = readFileSync(join(__dirname, '../../docs/PROGRAM.md'), 'utf8');
    expect(actual).toBe(expected);
    expect(actual).toContain('| 3 | 2 × 8 | 1 × 8 | 1 × 8 | 1 × 8 each side |');
  });
});
