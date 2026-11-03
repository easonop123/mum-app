import { describe, expect, it } from 'vitest';
import type { Weekday } from '../domain/types';
import { nextScheduledDay, practiceDayStatus, validateScheduleDays, mayPractiseToday } from './schedule';

const TUE_FRI: { weekdays: Weekday[] } = { weekdays: ['Tuesday', 'Friday'] };

describe('validateScheduleDays', () => {
  it('accepts the default Tuesday + Friday', () => {
    expect(validateScheduleDays(['Tuesday', 'Friday'])).toEqual({ ok: true });
  });
  it('requires at least one full non-strength day between, around the week too', () => {
    expect(validateScheduleDays(['Monday', 'Tuesday'])).toMatchObject({ ok: false, reason: 'need_rest_day_between' });
    expect(validateScheduleDays(['Sunday', 'Monday'])).toMatchObject({ ok: false, reason: 'need_rest_day_between' });
    expect(validateScheduleDays(['Monday', 'Wednesday'])).toEqual({ ok: true });
    expect(validateScheduleDays(['Saturday', 'Monday'])).toEqual({ ok: true });
  });
  it('keeps the supplied two days a week (no extra daily strength workouts)', () => {
    expect(validateScheduleDays(['Monday', 'Wednesday', 'Friday'])).toMatchObject({ ok: false, reason: 'need_two_days' });
    expect(validateScheduleDays(['Monday'])).toMatchObject({ ok: false, reason: 'need_two_days' });
    expect(validateScheduleDays(['Funday', 'Friday'])).toMatchObject({ ok: false, reason: 'unknown_day' });
  });
});

describe('practiceDayStatus — no catch-up after missed days (case 10)', () => {
  // 2026-11-03 is a Tuesday.
  it('scheduled day with nothing done → may practise', () => {
    expect(practiceDayStatus(TUE_FRI, [], '2026-11-03')).toEqual({ kind: 'scheduled_today' });
  });
  it('one practice a day at most', () => {
    expect(practiceDayStatus(TUE_FRI, [{ localDate: '2026-11-03' }], '2026-11-03').kind).toBe('practised_today');
  });
  it('never on consecutive days', () => {
    expect(practiceDayStatus(TUE_FRI, [{ localDate: '2026-11-05' }], '2026-11-06').kind).toBe('rest_after_yesterday');
  });
  it('a missed Tuesday can move to Wednesday, but never adds a third practice that week', () => {
    expect(practiceDayStatus(TUE_FRI, [], '2026-11-04').kind).toBe('moved_day_available');
    const twoDone = [{ localDate: '2026-11-04' }, { localDate: '2026-11-06' }];
    expect(practiceDayStatus(TUE_FRI, twoDone, '2026-11-08').kind).toBe('weekly_amount_done');
    expect(mayPractiseToday(practiceDayStatus(TUE_FRI, twoDone, '2026-11-08'))).toBe(false);
  });
  it('missing a whole week does not create extra sessions the next week', () => {
    // Nothing during 2–8 Nov; on Tue 10 Nov the normal single practice is offered.
    expect(practiceDayStatus(TUE_FRI, [{ localDate: '2026-10-30' }], '2026-11-10')).toEqual({ kind: 'scheduled_today' });
  });
  it('finds the next chosen day without countdown pressure', () => {
    expect(nextScheduledDay(TUE_FRI, '2026-11-04')).toBe('2026-11-06');
    expect(nextScheduledDay(TUE_FRI, '2026-11-06', false)).toBe('2026-11-10');
  });
});
