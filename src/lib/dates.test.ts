import { describe, expect, it } from 'vitest';
import {
  addDays,
  ageRangeFromBirthYear,
  daysBetween,
  formatLocalDate,
  isLocalDate,
  isSameIsoWeek,
  isoWeekStart,
  isValidTimeZone,
  localDateInZone,
  monthDates,
  weekdayOf,
} from './dates';
import { practiceDayStatus } from '../program/schedule';

describe('local calendar dates (case 18)', () => {
  it('uses the wall-clock date in the schedule zone, not a UTC substring', () => {
    // 2026-11-03T11:30Z is 00:30 on Wednesday 4 Nov in Auckland (NZDT, UTC+13).
    const instant = '2026-11-03T11:30:00.000Z';
    expect(instant.slice(0, 10)).toBe('2026-11-03');
    expect(localDateInZone(instant, 'Pacific/Auckland')).toBe('2026-11-04');
  });

  it('handles the NZ daylight-saving start (27 Sep 2026, 2am → 3am)', () => {
    expect(localDateInZone('2026-09-26T13:59:00.000Z', 'Pacific/Auckland')).toBe('2026-09-27'); // 01:59 NZST
    expect(localDateInZone('2026-09-26T14:00:00.000Z', 'Pacific/Auckland')).toBe('2026-09-27'); // 03:00 NZDT
    expect(localDateInZone('2026-09-27T10:59:00.000Z', 'Pacific/Auckland')).toBe('2026-09-27'); // 23:59 NZDT
    expect(localDateInZone('2026-09-27T11:00:00.000Z', 'Pacific/Auckland')).toBe('2026-09-28');
  });

  it('handles the NZ daylight-saving end (5 Apr 2026, 3am → 2am)', () => {
    expect(localDateInZone('2026-04-04T13:30:00.000Z', 'Pacific/Auckland')).toBe('2026-04-05'); // 02:30 NZDT
    expect(localDateInZone('2026-04-05T11:59:00.000Z', 'Pacific/Auckland')).toBe('2026-04-05'); // 23:59 NZST
    expect(localDateInZone('2026-04-05T12:00:00.000Z', 'Pacific/Auckland')).toBe('2026-04-06');
  });

  it('day arithmetic is unaffected by DST (23- and 25-hour days still count as one day)', () => {
    expect(daysBetween('2026-09-26', '2026-09-28')).toBe(2);
    expect(daysBetween('2026-04-04', '2026-04-06')).toBe(2);
    expect(addDays('2026-09-26', 1)).toBe('2026-09-27');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-11-03', '2026-11-17')).toBe(14);
  });

  it('ISO weeks run Monday–Sunday', () => {
    expect(weekdayOf('2026-11-03')).toBe('Tuesday');
    expect(isoWeekStart('2026-11-03')).toBe('2026-11-02');
    expect(isoWeekStart('2026-11-08')).toBe('2026-11-02');
    expect(isSameIsoWeek('2026-11-08', '2026-11-09')).toBe(false);
    expect(isSameIsoWeek('2026-12-31', '2027-01-03')).toBe(true);
  });

  it('a recorded day stays put when the schedule time zone later changes', () => {
    const recorded = [{ localDate: localDateInZone('2026-11-03T11:30:00.000Z', 'Pacific/Auckland') }];
    // Later the person travels; "today" is computed in the new zone, history is not recomputed.
    const todayInSydney = localDateInZone('2026-11-04T05:00:00.000Z', 'Australia/Sydney');
    expect(todayInSydney).toBe('2026-11-04');
    expect(practiceDayStatus({ weekdays: ['Tuesday', 'Friday'] }, recorded, todayInSydney).kind).toBe('practised_today');
  });

  it('validates dates and zones', () => {
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-11-3')).toBe(false);
    expect(isValidTimeZone('Pacific/Auckland')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('month grids and formatting never shift the date', () => {
    expect(monthDates(2026, 11)).toHaveLength(30);
    expect(monthDates(2028, 2)).toHaveLength(29);
    expect(formatLocalDate('2026-11-03', 'en')).toMatch(/Tuesday.*3.*November/);
    expect(formatLocalDate('2026-11-03', 'zh')).toMatch(/11月3日/);
  });

  it('age display allows for an unknown birthday', () => {
    expect(ageRangeFromBirthYear(1980, '2026-11-03')).toEqual({ min: 45, max: 46 });
  });
});
