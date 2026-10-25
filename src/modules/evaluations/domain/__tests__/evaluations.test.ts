import {
  classEvaluation,
  comingReminders,
  isSettled,
  defaultType,
  duplicateOf,
  isEvaluation,
  markDone,
  meetingOn,
  reminderAt,
  remindsLater,
  setEvaluation,
  sortedReminders,
  upcomingClassDates,
  upcomingEvaluations,
  type Evaluation,
} from '../evaluations';

/** Segunda, 23/11/2026, 13:05. */
const NOW = new Date(2026, 10, 23, 13, 5);

const evaluation = (patch: Partial<Evaluation> = {}): Evaluation => ({
  id: 'e1',
  subjectId: '342',
  subjectName: 'Física III',
  type: 'P1',
  date: '2026-11-24',
  time: 8 * 60,
  note: '',
  reminders: ['eve', 'day'],
  earlyTime: 20 * 60,
  dayTime: 7 * 60,
  done: false,
  ...patch,
});

describe('reminderAt', () => {
  it('places the day reminders at the early time and the hour ones before the start', () => {
    const exam = evaluation({ dayTime: 6 * 60 + 30 });
    expect(reminderAt(exam, 'week')).toEqual(new Date(2026, 10, 17, 20, 0));
    expect(reminderAt(exam, 'three')).toEqual(new Date(2026, 10, 21, 20, 0));
    expect(reminderAt(exam, 'eve')).toEqual(new Date(2026, 10, 23, 20, 0));
    expect(reminderAt(exam, 'day')).toEqual(new Date(2026, 10, 24, 6, 30));
    expect(reminderAt(exam, 'h2')).toEqual(new Date(2026, 10, 24, 6, 0));
    expect(reminderAt(exam, 'h1')).toEqual(new Date(2026, 10, 24, 7, 0));
    expect(reminderAt(exam, 'm30')).toEqual(new Date(2026, 10, 24, 7, 30));
  });

  it('crosses the month for the day before', () => {
    const exam = evaluation({ date: '2026-12-01' });
    expect(reminderAt(exam, 'eve')).toEqual(new Date(2026, 10, 30, 20, 0));
  });
});

describe('remindsLater', () => {
  it('drops what already passed and what would come after the start', () => {
    // prova hoje às 14:20: a véspera e o aviso das 7h já passaram
    const today = evaluation({ date: '2026-11-23', time: 14 * 60 + 20 });
    expect(remindsLater(today, 'eve', NOW)).toBe(false);
    expect(remindsLater(today, 'day', NOW)).toBe(false);
    expect(remindsLater(today, 'h1', NOW)).toBe(true);
    // o aviso "No dia" às 7h de uma prova às 6h viria depois do início
    const early = evaluation({ time: 6 * 60 });
    expect(remindsLater(early, 'day', NOW)).toBe(false);
    expect(remindsLater(early, 'eve', NOW)).toBe(true);
  });

  it('lists the coming reminders in the order they arrive', () => {
    const exam = evaluation({ reminders: ['m30', 'eve', 'three', 'day'] });
    expect(sortedReminders(exam)).toEqual(['three', 'eve', 'day', 'm30']);
    expect(comingReminders(exam, NOW)).toEqual(['eve', 'day', 'm30']);
  });
});

describe('upcomingEvaluations', () => {
  it('keeps the ones ahead, without graded exams and the done ones, by date', () => {
    const list = [
      evaluation({ id: 'later', date: '2026-11-30' }),
      evaluation({ id: 'graded', subjectId: '211', type: 'P1' }),
      evaluation({ id: 'past', date: '2026-11-23', time: 8 * 60 }),
      evaluation({ id: 'done', type: 'work', done: true }),
      evaluation({ id: 'soon', type: 'P2', date: '2026-11-23', time: 14 * 60 }),
    ];
    const grades = new Map([['211', { p1: 6.5, p2: null }]]);
    expect(upcomingEvaluations(list, NOW, grades).map(item => item.id)).toEqual(
      ['soon', 'later'],
    );
  });
});

describe('setEvaluation', () => {
  it('replaces the same exam of the subject and keeps the rest', () => {
    const first = evaluation({ id: 'a' });
    const work = evaluation({ id: 'b', type: 'work' });
    const again = evaluation({ id: 'c', date: '2026-11-26' });
    expect(duplicateOf([first, work], again)).toBe(first);
    expect(setEvaluation([first, work], again)).toEqual([work, again]);
    // dois trabalhos da mesma disciplina convivem
    expect(duplicateOf([work], { ...work, id: null })).toBeNull();
  });

  it('marks done and undoes it', () => {
    const list = [evaluation({ id: 'a' }), evaluation({ id: 'b' })];
    const done = markDone(list, ['b'], true);
    expect(done.map(item => item.done)).toEqual([false, true]);
    expect(markDone(done, ['b'], false)[1].done).toBe(false);
  });
});

describe('class dates', () => {
  const meetings = [
    { weekday: 1, start: 14 * 60 + 20 },
    { weekday: 3, start: 14 * 60 + 20 },
  ];

  it('lists the next classes, today only before it starts', () => {
    expect(upcomingClassDates(meetings, NOW)).toEqual([
      '2026-11-23',
      '2026-11-25',
      '2026-11-30',
      '2026-12-02',
    ]);
    const afterClass = new Date(2026, 10, 23, 15, 0);
    expect(upcomingClassDates(meetings, afterClass, 2)).toEqual([
      '2026-11-25',
      '2026-11-30',
    ]);
    expect(upcomingClassDates([], NOW)).toEqual([]);
  });

  it('finds the class of a day', () => {
    expect(meetingOn(meetings, '2026-11-25')).toEqual(meetings[1]);
    expect(meetingOn(meetings, '2026-11-24')).toBeNull();
  });
});

describe('defaultType', () => {
  it('suggests the first exam without grade nor date, then an assignment', () => {
    const grades = new Map([['342', { p1: 6.5 }]]);
    expect(defaultType([], '342', grades)).toBe('P2');
    expect(defaultType([evaluation({ type: 'P2' })], '342', grades)).toBe(
      'work',
    );
    expect(defaultType([], '211', grades)).toBe('P1');
  });
});

describe('isEvaluation', () => {
  it('accepts the saved shape and rejects the rest', () => {
    expect(isEvaluation(evaluation())).toBe(true);
    expect(isEvaluation({ ...evaluation(), type: 'P3' })).toBe(false);
    expect(isEvaluation({ ...evaluation(), date: '24/11/2026' })).toBe(false);
    expect(isEvaluation({ ...evaluation(), time: 24 * 60 })).toBe(false);
    expect(isEvaluation({ ...evaluation(), reminders: ['soon'] })).toBe(false);
    expect(isEvaluation({ ...evaluation(), done: undefined })).toBe(false);
    expect(isEvaluation(null)).toBe(false);
  });
});

describe('isSettled', () => {
  it('lets the grade decide: the exam graded, the PF exempt, without right or published', () => {
    const exam = (type: Evaluation['type']) => evaluation({ type });
    const grades = (grade: object) => new Map([['342', grade]]);
    expect(isSettled(exam('P1'), grades({ p1: 6 }))).toBe(true);
    expect(isSettled(exam('P2'), grades({ p1: 6 }))).toBe(false);
    // média 8,5: dispensado da PF
    expect(isSettled(exam('PF'), grades({ p1: 8, p2: 9 }))).toBe(true);
    // média 3: sem direito à PF
    expect(isSettled(exam('PF'), grades({ p1: 3, p2: 3 }))).toBe(true);
    // média 5,5: a PF acontece
    expect(isSettled(exam('PF'), grades({ p1: 5, p2: 6 }))).toBe(false);
    expect(isSettled(exam('P2'), grades({ result: 7 }))).toBe(true);
    expect(isSettled(exam('work'), grades({ result: 7 }))).toBe(false);
    expect(isSettled(exam('PF'), new Map())).toBe(false);
  });
});

describe('classEvaluation', () => {
  it('marks only the class whose time holds the exam', () => {
    const list = [evaluation({ date: '2026-11-23', time: 14 * 60 + 20 })];
    const morning = { start: 7 * 60, end: 8 * 60 + 40 };
    const afternoon = { start: 14 * 60 + 20, end: 16 * 60 };
    expect(classEvaluation(list, '342', '2026-11-23', morning)).toBeNull();
    expect(classEvaluation(list, '342', '2026-11-23', afternoon)).toBe(list[0]);
    // trabalhos são prazos, não aulas
    const work = [evaluation({ type: 'work', date: '2026-11-23', time: 860 })];
    expect(classEvaluation(work, '342', '2026-11-23', afternoon)).toBeNull();
  });
});
