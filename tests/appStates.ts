import type { Ctx } from '../src/data/actions';
import { createInitialAppData } from '../src/data/defaults';
import type { AppData } from '../src/data/schema';

/** Tuesday 3 November 2026, 10:00 in Auckland (NZDT). */
export const TUESDAY_10AM_NZ = new Date('2026-11-02T21:00:00.000Z');
export const fixedNow = () => TUESDAY_10AM_NZ;

let n = 0;
export const ctx: Ctx = { now: TUESDAY_10AM_NZ.toISOString(), today: '2026-11-03', newId: () => `t-${++n}` };

export function freshData(): AppData {
  return createInitialAppData(ctx.now);
}

/** Someone who has tapped "Let's start" — nothing else is needed to practise. */
export function startedData(): AppData {
  const d = createInitialAppData(ctx.now);
  return { ...d, profile: { ...d.profile, optedIn: true } };
}
