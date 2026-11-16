import { summarizeComplementary } from '@root/modules/academics/domain/rules/complementary';
import { reconcileCurriculumCompletion } from '@root/modules/academics/domain/rules/completion';
import { finalExamOutlook } from '@root/modules/academics/domain/rules/finalExam';
import { isCurrentPartialRid } from '@root/modules/academics/domain/rules/partialRid';
import {
  calculateAcademicProgress,
  calculateCraProgression,
  currentInProgress,
  getPeriodList,
  normalizeElectiveCredits,
  synthesisElectiveCredits,
} from '@root/modules/academics/domain/rules/progress';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import {
  planInputs,
  planSubject,
} from '@root/modules/graduation/application/planInputs';
import { prerequisiteEntry } from '@root/modules/graduation/application/PrerequisiteCatalog';
import {
  deadlineSlack,
  planScenarios,
} from '@root/modules/graduation/domain/plan';
import {
  findNextClass,
  shiftOf,
} from '@root/features/AttendedClassesSchedule/scheduleFormat';
import { createDemoClock } from '../clock';
import { CATALOG, UNIVERSALS, numericCode } from '../data/catalog';
import { ENROLLED } from '../data/enrolled';
import { PAST_PERIODS } from '../data/student';
import { createDemoRecords } from '../ports/records';

/** 15/03, 31/07 (fim do .1), 01/08 (início do .2), Natal e um domingo. */
const DATES = [
  new Date(2026, 2, 15, 10, 0),
  new Date(2026, 6, 31, 23, 59),
  new Date(2026, 7, 1, 0, 0),
  new Date(2026, 11, 25, 12, 0),
  new Date(2026, 10, 15, 20, 0),
];

function demo(now = DATES[0]) {
  const clock = createDemoClock(() => now.getTime(), 0);
  return { clock, records: createDemoRecords(clock) };
}

describe('periods follow the clock', () => {
  it.each([
    [DATES[0], '2026.1', '2025.2'],
    [DATES[1], '2026.1', '2025.2'],
    [DATES[2], '2026.2', '2026.1'],
    [DATES[3], '2026.2', '2026.1'],
    [new Date(2027, 0, 2), '2027.1', '2026.2'],
  ])('on %s the current period is %s', async (now, current, previous) => {
    const { records } = demo(now);
    const history = await records.getHistory();
    const periods = [...new Set(history.map(item => item.period))].sort();
    expect(periods).toHaveLength(PAST_PERIODS + 1);
    expect(periods[periods.length - 1]).toBe(current);
    expect(periods[periods.length - 2]).toBe(previous);
    expect(
      history
        .filter(item => item.status === 'IN_PROGRESS')
        .every(item => item.period === current),
    ).toBe(true);
    await expect(records.getSynthesis()).resolves.toMatchObject({
      currentPeriod: current,
    });
  });
});

describe.each(DATES)('demo records on %s', now => {
  it('answers every read with data', async () => {
    const { records } = demo(now);
    const lists = await Promise.all([
      records.getGrades(),
      records.getHistory(),
      records.getCurriculum(),
      records.getSchedule(),
      records.getUniversalSubjects(),
      records.getPartialRid().then(rid => rid.subjects),
      records.getEnrollmentResult().then(result => result.subjects),
      records.getComplementaryActivities().then(data => data.activities),
      records.getSynthesis().then(data => data.requirements),
    ]);
    lists.forEach(list => expect(list.length).toBeGreaterThan(0));
  });

  it('keeps the RID current and one subject refused, with the reason', async () => {
    const { records } = demo(now);
    const rid = await records.getPartialRid();
    expect(isCurrentPartialRid(rid, now)).toBe(true);
    expect(rid.updatedAt).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    const { subjects } = await records.getEnrollmentResult();
    const refused = subjects.filter(item => !item.accepted);
    expect(refused).toEqual([
      expect.objectContaining({ reason: 'Falta Requisito (CO/PRE)' }),
    ]);
  });

  it('always has a next class', async () => {
    const { records } = demo(now);
    const schedule = await records.getSchedule();
    for (let hour = 0; hour < 24; hour += 3) {
      const at = new Date(now);
      at.setHours(hour);
      expect(findNextClass(schedule, at)).not.toBeNull();
    }
  });
});

describe('schedule', () => {
  it('has classes from Monday to Saturday, morning, afternoon and night', async () => {
    const schedule = await demo().records.getSchedule();
    expect(new Set(schedule.map(item => item.dayNumber))).toEqual(
      new Set([1, 2, 3, 4, 5, 6]),
    );
    expect(
      new Set(schedule.map(item => shiftOf(item.start_time_in_minutes))),
    ).toEqual(new Set(['morning', 'afternoon', 'night']));
    // a próxima aula a partir de cada dia da semana, inclusive o domingo
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(2026, 10, 15 + day, 23, 0);
      expect(findNextClass(schedule, date)?.dayOffset).toBe(day === 6 ? 2 : 1);
    }
  });

  it('is sorted and in the parser format', async () => {
    const schedule = await demo().records.getSchedule();
    const keys = schedule.map(
      item => item.dayNumber * 10000 + item.start_time_in_minutes,
    );
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    schedule.forEach(item => {
      expect(item.dayAlias).toMatch(
        /^(Segunda|Terça|Quarta|Quinta|Sexta)-feira$|^Sábado$/,
      );
      expect(item.startTimeAlias).toMatch(/^\d{1,2}:\d{2}$/);
      expect(item.end_time_in_minutes).toBeGreaterThan(
        item.start_time_in_minutes,
      );
      expect(item.subject_id).toBe(item.class.id);
      expect(item.class.status).toBe('ACTIVE');
      expect(item.class.class).toMatch(/^\d+$/);
    });
  });

  it('has grades for every subject in the schedule, mid-period', async () => {
    const { records } = demo();
    const [schedule, grades] = await Promise.all([
      records.getSchedule(),
      records.getGrades(),
    ]);
    schedule.forEach(item => {
      const grade = grades.find(entry => entry.id === item.class.id);
      expect(grade).toBeDefined();
      expect(grade?.class).toBe(item.class.class);
      expect(grade?.name).toBe(item.class.name);
    });
    expect(grades.some(item => typeof item.grades.p1 === 'number')).toBe(true);
    expect(grades.every(item => item.grades.p2 === null)).toBe(true);
  });
});

describe('catalog', () => {
  it('has unique numeric codes', () => {
    const codes = CATALOG.map(entry => numericCode(entry.id));
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('answers every subject in both id forms', async () => {
    const { records } = demo();
    for (const entry of CATALOG) {
      const full = await records.getSubjectDetails(entry.id);
      const numeric = await records.getSubjectDetails(
        normalizeSubjectId(entry.id),
      );
      expect(numeric).toEqual(full);
      expect(full).toMatchObject({
        id: entry.id,
        name: entry.name,
        credits: entry.credits,
        workload: entry.workload,
      });
      // fora da oferta, sem turmas; na oferta, duas ou três
      const count = full.classes?.length ?? 0;
      expect(entry.offered ? count >= 2 && count <= 3 : count === 0).toBe(true);
    }
  });

  it('rejects an unknown subject like the portal page', async () => {
    const { records } = demo();
    await expect(records.getSubjectDetails('99999')).rejects.toMatchObject({
      code: 'PORTAL_LAYOUT_CHANGED',
    });
    await expect(
      records.getSubjectDetails('XYZ01-99999'),
    ).rejects.toMatchObject({ code: 'PORTAL_LAYOUT_CHANGED' });
  });

  it('describes the class the student attends as in the schedule', async () => {
    const { records } = demo();
    const schedule = await records.getSchedule();
    for (const subject of ENROLLED) {
      const details = await records.getSubjectDetails(subject.id);
      const own = details.classes?.find(
        group => group.classNumber === Number(subject.class),
      );
      expect(own?.teachers).toEqual([subject.teacher]);
      expect(own?.location).toBe(subject.uerjLocation);
      const days = schedule.filter(item => item.class.id === subject.id).length;
      expect(own?.schedule).toHaveLength(days);
    }
  });

  it('agrees with the history and the curriculum', async () => {
    const { records } = demo();
    const [history, curriculum, universals] = await Promise.all([
      records.getHistory(),
      records.getCurriculum(),
      records.getUniversalSubjects(),
    ]);
    const known = new Map(
      [...curriculum, ...universals].map(item => [item.id, item]),
    );
    history.forEach(item => {
      expect(known.get(item.id)?.name).toBe(item.name);
    });
    expect(history.some(item => item.status.startsWith('FAILED'))).toBe(true);
    const approved = new Set(
      history.filter(item => item.status === 'APPROVED').map(item => item.id),
    );
    curriculum.forEach(item =>
      expect(item.alreadyTaken).toBe(approved.has(item.id)),
    );
    expect(universals).toEqual(UNIVERSALS);
  });
});

describe.each(DATES)('domain rules over the demo data on %s', now => {
  it('feeds progress, final exams, complementary hours and the plan', async () => {
    const { records } = demo(now);
    const [history, curriculum, grades, synthesis, complementary, schedule] =
      await Promise.all([
        records.getHistory(),
        records.getCurriculum(),
        records.getGrades(),
        records.getSynthesis(),
        records.getComplementaryActivities(),
        records.getSchedule(),
      ]);

    const electiveCredits = normalizeElectiveCredits(
      synthesisElectiveCredits(synthesis),
    );
    expect(electiveCredits).toEqual({
      RESTRICTED: 16,
      DEFINED: 8,
      UNIVERSAL: 4,
    });
    const progress = calculateAcademicProgress(
      history,
      reconcileCurriculumCompletion(curriculum, history),
      electiveCredits,
    );
    expect(progress.approvedCount).toBeGreaterThan(30);
    expect(progress.byType.percent.MANDATORY).toBeGreaterThan(50);
    expect(progress.byType.percent.MANDATORY).toBeLessThan(100);

    const { currentCRA, pointsOverTime } = calculateCraProgression(history);
    expect(pointsOverTime).toHaveLength(PAST_PERIODS + 1);
    expect(currentCRA).toBe(synthesis.cr);
    expect(getPeriodList(history)[0].label).toContain('CR Atual');
    expect(currentInProgress(history)).toHaveLength(ENROLLED.length);

    const outlooks = grades.map(item => finalExamOutlook(item.grades).kind);
    expect(outlooks).toContain('second-pending');
    expect(outlooks).toContain('no-grades');

    const summary = summarizeComplementary(complementary, synthesis);
    expect(summary?.required).toBe(200);
    expect(summary?.progress).toBe(summary?.counted);
    expect(summary?.progress).toBeGreaterThan(0);

    const inputs = planInputs({
      curriculum,
      history,
      inProgress: [...new Set(schedule.map(item => item.class.id))],
      synthesis,
      electiveCredits,
    });
    const entries: Record<string, ReturnType<typeof prerequisiteEntry>> = {};
    for (const item of inputs.remaining) {
      entries[normalizeSubjectId(item.id)] = prerequisiteEntry(
        await records.getSubjectDetails(item.id),
      );
    }
    const subjects = [
      ...inputs.remaining.map(item => planSubject(item, entries)),
      ...inputs.electives,
    ];
    expect(inputs.remaining.map(item => item.name).sort()).toEqual([
      'Computação Gráfica',
      'Estágio Supervisionado',
      'Projeto Final II',
    ]);
    const scenarios = planScenarios(subjects, {
      completed: inputs.completed,
      credits: inputs.mandatoryCredits,
    });
    expect(scenarios.length).toBeGreaterThan(0);
    scenarios.forEach(({ plan }) => {
      expect(plan.unplanned).toEqual([]);
      expect(
        deadlineSlack(plan, synthesis.periods.remaining),
      ).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('cancellation and copies', () => {
  it('rejects with CANCELLED when the signal is aborted', async () => {
    const { records } = demo();
    const controller = new AbortController();
    controller.abort();
    await expect(
      records.getSchedule({ signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('cancels a read in flight', async () => {
    const clock = createDemoClock(() => DATES[0].getTime(), 50);
    const controller = new AbortController();
    const pending = createDemoRecords(clock).getHistory({
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('returns copies', async () => {
    const { records } = demo();
    const first = await records.getGrades();
    first[0].grades.p1 = 0;
    first.pop();
    const second = await records.getGrades();
    expect(second).toHaveLength(ENROLLED.length);
    expect(second[0].grades.p1).toBe(ENROLLED[0].grades.p1);
    const details = await records.getSubjectDetails(ENROLLED[0].id);
    details.classes?.splice(0);
    expect(
      (await records.getSubjectDetails(ENROLLED[0].id)).classes?.length,
    ).toBeGreaterThan(0);
  });
});
