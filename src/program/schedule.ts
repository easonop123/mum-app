import { WEEKDAYS, type ChosenSchedule, type SessionRecord, type Weekday } from '../domain/types';
import { addDays, daysBetween, isSameIsoWeek, weekdayIndex, weekdayOf } from '../lib/dates';

export type ScheduleValidation =
  | { ok: true }
  | { ok: false; reason: 'need_two_days' | 'need_rest_day_between' | 'unknown_day' };

/**
 * The supplied program has two strengthening days a week, with at least one
 * full non-strength day between them (checked around the week, so Sunday +
 * Monday is not allowed).
 */
export function validateScheduleDays(days: readonly string[]): ScheduleValidation {
  if (days.some((d) => !(WEEKDAYS as readonly string[]).includes(d))) return { ok: false, reason: 'unknown_day' };
  const unique = [...new Set(days)] as Weekday[];
  if (unique.length !== 2) return { ok: false, reason: 'need_two_days' };
  const [a, b] = unique.map(weekdayIndex).sort((x, y) => x - y) as [number, number];
  const forward = b - a;
  const around = 7 - forward;
  if (forward < 2 || around < 2) return { ok: false, reason: 'need_rest_day_between' };
  return { ok: true };
}

export function sortWeekdays(days: readonly Weekday[]): Weekday[] {
  return [...days].sort((x, y) => weekdayIndex(x) - weekdayIndex(y));
}

export function isScheduledDay(schedule: Pick<ChosenSchedule, 'weekdays'>, localDate: string): boolean {
  return schedule.weekdays.includes(weekdayOf(localDate));
}

/** Next chosen strengthening day on or after `fromLocalDate` (or strictly after when includeFrom is false). */
export function nextScheduledDay(schedule: Pick<ChosenSchedule, 'weekdays'>, fromLocalDate: string, includeFrom = true): string | null {
  if (schedule.weekdays.length === 0) return null;
  for (let i = includeFrom ? 0 : 1; i <= 7; i += 1) {
    const d = addDays(fromLocalDate, i);
    if (isScheduledDay(schedule, d)) return d;
  }
  return null;
}

export type PracticeDayStatus =
  | { kind: 'practised_today' }
  | { kind: 'rest_after_yesterday' }
  | { kind: 'scheduled_today' }
  | { kind: 'moved_day_available' }
  | { kind: 'weekly_amount_done' };

/**
 * One practice a day at most, never on consecutive days, and never more
 * practices in a week than chosen days — so missed days never create
 * catch-up sessions. On a non-chosen day the person may move this week's
 * practice to today if those rules allow.
 */
export function practiceDayStatus(
  schedule: Pick<ChosenSchedule, 'weekdays'>,
  sessions: readonly Pick<SessionRecord, 'localDate'>[],
  todayLocalDate: string,
): PracticeDayStatus {
  if (sessions.some((s) => s.localDate === todayLocalDate)) return { kind: 'practised_today' };
  if (sessions.some((s) => daysBetween(s.localDate, todayLocalDate) === 1)) return { kind: 'rest_after_yesterday' };
  const thisWeek = new Set(sessions.filter((s) => isSameIsoWeek(s.localDate, todayLocalDate)).map((s) => s.localDate)).size;
  if (thisWeek >= schedule.weekdays.length) return { kind: 'weekly_amount_done' };
  if (isScheduledDay(schedule, todayLocalDate)) return { kind: 'scheduled_today' };
  return { kind: 'moved_day_available' };
}

export function mayPractiseToday(status: PracticeDayStatus): boolean {
  return status.kind === 'scheduled_today' || status.kind === 'moved_day_available';
}
