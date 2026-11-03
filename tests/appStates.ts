import { SETUP_ITEM_IDS } from '../src/domain/types';
import { commitScreening, recordProfessionalAdvice, setSetupItem, type Ctx } from '../src/data/actions';
import { createInitialAppData } from '../src/data/defaults';
import type { AppData } from '../src/data/schema';
import { CLEAR_ANSWERS, approvedAdvice } from './factories';

/** Tuesday 3 November 2026, 10:00 in Auckland (NZDT). */
export const TUESDAY_10AM_NZ = new Date('2026-11-02T21:00:00.000Z');
export const fixedNow = () => TUESDAY_10AM_NZ;

let n = 0;
export const ctx: Ctx = { now: TUESDAY_10AM_NZ.toISOString(), today: '2026-11-03', newId: () => `t-${++n}` };

export function freshData(): AppData {
  return createInitialAppData(ctx.now);
}

export function onboardedData(): AppData {
  let d = createInitialAppData(ctx.now);
  d = { ...d, profile: { ...d.profile, optedIn: true, languageConfirmed: true, regionConfirmed: true, goal: 'chair_rising' } };
  return commitScreening(d, CLEAR_ANSWERS, {}, true, ctx);
}

export function reviewedData(): AppData {
  let d = onboardedData();
  d = recordProfessionalAdvice(d, approvedAdvice(), ctx);
  for (const item of SETUP_ITEM_IDS) d = setSetupItem(d, item, 'yes', ctx);
  return d;
}
