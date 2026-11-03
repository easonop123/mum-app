import { WEEKDAYS, type Lang, type Weekday } from '../domain/types';

// Local calendar dates are stored as 'YYYY-MM-DD' strings computed in the
// schedule's IANA time zone at the moment of the event. All date arithmetic
// below works on those strings (via UTC midnight), so daylight-saving changes
// and later time-zone changes never move a recorded day.

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** The calendar date of `instant` as seen on a wall clock in `timeZone`. */
export function localDateInZone(instant: Date | string | number, timeZone: string): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid instant');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toUtcMidnight(localDate: string): number {
  const m = LOCAL_DATE_RE.exec(localDate);
  if (!m || !isLocalDate(localDate)) throw new Error(`Invalid local date: ${localDate}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMidnight(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const DAY_MS = 86_400_000;

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

export function addDays(localDate: string, days: number): string {
  return fromUtcMidnight(toUtcMidnight(localDate) + days * DAY_MS);
}

export function weekdayOf(localDate: string): Weekday {
  const jsDay = new Date(toUtcMidnight(localDate)).getUTCDay(); // 0 = Sunday
  const index = (jsDay + 6) % 7; // 0 = Monday
  return WEEKDAYS[index] as Weekday;
}

export function weekdayIndex(day: Weekday): number {
  return WEEKDAYS.indexOf(day);
}

/** Monday of the ISO week containing `localDate` (weeks run Monday–Sunday). */
export function isoWeekStart(localDate: string): string {
  return addDays(localDate, -weekdayIndex(weekdayOf(localDate)));
}

export function isSameIsoWeek(a: string, b: string): boolean {
  return isoWeekStart(a) === isoWeekStart(b);
}

export function weekDates(localDate: string): string[] {
  const start = isoWeekStart(localDate);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthOf(localDate: string): { year: number; month: number } {
  const m = LOCAL_DATE_RE.exec(localDate);
  if (!m) throw new Error(`Invalid local date: ${localDate}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function monthDates(year: number, month: number): string[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const days: string[] = [];
  for (let d = first; monthOf(d).month === month; d = addDays(d, 1)) days.push(d);
  return days;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

function intlLocale(lang: Lang): string {
  return lang === 'zh' ? 'zh-CN' : 'en-NZ';
}

/** e.g. "Tuesday 3 November" / "11月3日 星期二". Formats the calendar date itself, never shifted by zone. */
export function formatLocalDate(localDate: string, lang: Lang, style: 'long' | 'short' = 'long'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
      : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(intlLocale(lang), options).format(new Date(toUtcMidnight(localDate)));
}

export function formatMonth(year: number, month: number, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function weekdayLabel(day: Weekday, lang: Lang, style: 'long' | 'short' = 'long'): string {
  // 2024-01-01 was a Monday.
  const date = addDays('2024-01-01', weekdayIndex(day));
  return new Intl.DateTimeFormat(intlLocale(lang), { weekday: style, timeZone: 'UTC' }).format(
    new Date(toUtcMidnight(date)),
  );
}

/**
 * Age display allowing for the unknown birthday: someone born in 1980 is
 * 45 or 46 during 2026 depending on whether their birthday has passed.
 */
export function ageRangeFromBirthYear(birthYear: number, todayLocalDate: string): { min: number; max: number } {
  const { year } = monthOf(todayLocalDate);
  const max = year - birthYear;
  return { min: Math.max(0, max - 1), max };
}
