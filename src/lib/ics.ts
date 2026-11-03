import type { Weekday } from '../domain/types';

// RFC 5545 calendar file for a weekly repeating practice reminder. Importing it
// is always the person's own action; the app never adds events by itself.

const BYDAY: Record<Weekday, string> = {
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
  Saturday: 'SA',
  Sunday: 'SU',
};

const AUCKLAND_VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Pacific/Auckland',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+1200',
  'TZOFFSETTO:+1300',
  'TZNAME:NZDT',
  'DTSTART:19700927T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=9;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+1300',
  'TZOFFSETTO:+1200',
  'TZNAME:NZST',
  'DTSTART:19700405T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line to ≤ 75 octets (UTF-8), continuing with CRLF + space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      out.push(current);
      current = ch;
      bytes = size;
    } else {
      current += ch;
      bytes += size;
    }
  }
  out.push(current);
  return out.join('\r\n ');
}

function stamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export interface IcsParams {
  weekdays: Weekday[];
  /** HH:MM, local to `timezone` */
  time: string;
  timezone: string;
  /** First occurrence (a chosen practice day), YYYY-MM-DD */
  firstDate: string;
  title: string;
  description: string;
  uid: string;
  nowIso: string;
  durationMinutes?: number;
}

export function buildPracticeIcs(p: IcsParams): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) throw new Error('Invalid time');
  if (p.weekdays.length === 0) throw new Error('No practice days');
  const [hh, mm] = p.time.split(':');
  const dtstart = `${p.firstDate.replace(/-/g, '')}T${hh}${mm}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//A Little Stronger//Practice reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(p.timezone === 'Pacific/Auckland' ? AUCKLAND_VTIMEZONE : []),
    'BEGIN:VEVENT',
    `UID:${p.uid}`,
    `DTSTAMP:${stamp(p.nowIso)}`,
    `DTSTART;TZID=${p.timezone}:${dtstart}`,
    `DURATION:PT${p.durationMinutes ?? 20}M`,
    `RRULE:FREQ=WEEKLY;BYDAY=${p.weekdays.map((d) => BYDAY[d]).join(',')}`,
    `SUMMARY:${escapeIcsText(p.title)}`,
    `DESCRIPTION:${escapeIcsText(p.description)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(p.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
