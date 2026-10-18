import {
  absenceLimit,
  absentSlots,
  attendanceSummary,
  fromIsoDate,
  meetingsWithAbsences,
  pastMeetings,
  setAbsence,
  slotCount,
  toIsoDate,
  type ClassMeeting,
} from '../attendance';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';

const meeting = (fields: Partial<ClassMeeting> = {}): ClassMeeting => ({
  subjectId: '778',
  date: '2026-10-15',
  start: 860,
  end: 960,
  slots: 2,
  ...fields,
});

describe('absence limit', () => {
  it('tolerates 25% of the workload, rounded down', () => {
    expect(absenceLimit(60)).toBe(15);
    expect(absenceLimit(90)).toBe(22);
    expect(absenceLimit(30)).toBe(7);
  });

  it('has no limit without a known workload', () => {
    expect(absenceLimit(null)).toBeNull();
    expect(absenceLimit(undefined)).toBeNull();
    expect(absenceLimit(0)).toBeNull();
    expect(absenceLimit(Number.NaN)).toBeNull();
  });
});

describe('attendance summary', () => {
  it('is good up to half the limit, then warns until the limit', () => {
    expect(attendanceSummary(0, 15)).toMatchObject({
      level: 'none',
      remaining: 15,
    });
    expect(attendanceSummary(7, 15)).toMatchObject({ level: 'good' });
    expect(attendanceSummary(8, 15)).toMatchObject({
      level: 'warn',
      remaining: 7,
    });
    expect(attendanceSummary(15, 15)).toMatchObject({
      level: 'warn',
      remaining: 0,
    });
  });

  it('is bad past the limit', () => {
    expect(attendanceSummary(16, 15)).toMatchObject({
      level: 'bad',
      remaining: -1,
    });
  });

  it('only counts without a limit', () => {
    expect(attendanceSummary(4, null)).toEqual({
      used: 4,
      limit: null,
      remaining: null,
      level: 'unknown',
    });
    expect(attendanceSummary(0, null)).toMatchObject({ level: 'none' });
  });
});

describe('class slots', () => {
  it('counts UERJ slots between start and end, across the T/N break', () => {
    expect(slotCount(860, 960)).toBe(2); // T3–T4
    expect(slotCount(1020, 1130)).toBe(2); // T6–N1, com o intervalo
    expect(slotCount(420, 470)).toBe(1); // M1
    expect(slotCount(1080, 1230)).toBe(3); // N1–N3
  });

  it('falls back to one slot per 50 minutes outside the table', () => {
    expect(slotCount(1335, 1435)).toBe(2); // depois do N5
    expect(slotCount(600, 610)).toBe(1);
  });
});

describe('absences', () => {
  it('marks one absence per class and removes it again', () => {
    const marked = setAbsence([], meeting(), true);
    expect(marked).toEqual([
      { subjectId: '778', date: '2026-10-15', start: 860, end: 960, slots: 2 },
    ]);
    expect(setAbsence(marked, meeting(), true)).toHaveLength(1);
    expect(setAbsence(marked, meeting(), false)).toEqual([]);
  });

  it('adds up slots per subject', () => {
    let absences = setAbsence([], meeting(), true);
    absences = setAbsence(absences, meeting({ date: '2026-10-08' }), true);
    absences = setAbsence(
      absences,
      meeting({ subjectId: '777', start: 1080, end: 1230, slots: 3 }),
      true,
    );
    expect(absentSlots(absences, '778')).toBe(4);
    expect(absentSlots(absences, '777')).toBe(3);
    expect(absentSlots(absences, '1')).toBe(0);
  });
});

describe('subject key', () => {
  it('matches full codes and numeric suffixes', () => {
    expect(subjectKey('IME02-00778')).toBe('778');
    expect(subjectKey(778)).toBe('778');
    expect(subjectKey(' sem código ')).toBe('sem código');
  });
});

describe('past meetings', () => {
  const classes = [
    { subjectId: '778', weekday: 4, start: 860, end: 960 }, // quinta
    { subjectId: '777', weekday: 4, start: 1080, end: 1180 }, // quinta, noite
    { subjectId: '777', weekday: 1, start: 1080, end: 1180 }, // segunda
  ];

  it('lists classes that already ended, newest first', () => {
    // quinta, 15/10/2026, 17h: a aula das 14:20 acabou, a da noite não
    const meetings = pastMeetings(classes, new Date(2026, 9, 15, 17, 0), 8);
    expect(meetings.map(m => `${m.subjectId} ${m.date} ${m.start}`)).toEqual([
      '778 2026-10-15 860',
      '777 2026-10-12 1080',
      '777 2026-10-08 1080',
      '778 2026-10-08 860',
    ]);
    expect(meetings[0]).toMatchObject({ end: 960, slots: 2 });
  });

  it('keeps older absences that left the window, with their own times', () => {
    const meetings = pastMeetings(classes, new Date(2026, 9, 15, 17, 0), 2);
    // T6–N1 (17:00–18:50) passa pelo intervalo: 2 tempos não são 100 minutos
    const absences = [
      {
        subjectId: '778',
        date: '2026-09-17',
        start: 1020,
        end: 1130,
        slots: 2,
      },
      { subjectId: '778', date: '2026-10-15', start: 860, end: 960, slots: 2 },
    ];
    const listed = meetingsWithAbsences(meetings, absences, '778');
    expect(listed.map(m => m.date)).toEqual(['2026-10-15', '2026-09-17']);
    expect(listed[1]).toMatchObject({ start: 1020, end: 1130 });
  });

  it('round-trips local dates', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(fromIsoDate('2026-10-15')).toEqual(new Date(2026, 9, 15));
  });
});
