import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import { GenerateSchedules } from '@root/modules/planning/application/GenerateSchedules';
import { LoadPlanningSubjects } from '@root/modules/planning/application/LoadPlanningSubjects';
import {
  availableClasses,
  hasScheduleConflict,
  subjectEligibility,
} from '@root/modules/planning/domain/rules';
import { createScheduleDraft } from '@root/modules/planning/domain/models';
import { parseGeneratorResponse } from '../../schedule-generator/response';
import {
  createDemoBackend,
  demoCredentials,
  demoScenarioOf,
  DEMO_STUDENT,
  DEMO_SCENARIOS,
} from '../index';
import { CATALOG_IDS, CURRICULUM, HISTORY } from '../data';

const DEMO_PROFILE = { ...DEMO_STUDENT, matricula: 'demo' };
const backend = () => createDemoBackend({ latencyMs: 0, slowLatencyMs: 0 });

describe('demo credentials', () => {
  it.each([
    [{ matricula: 'demo', password: 'demo' }, 'padrao'],
    [{ matricula: ' DEMO ', password: 'demo' }, 'padrao'],
    [{ matricula: 'demo-rid', password: 'demo' }, 'rid'],
    [{ matricula: 'Demo-Bloqueado', password: 'demo' }, 'bloqueado'],
  ])('recognizes %j', (credentials, scenario) => {
    expect(demoScenarioOf(credentials)).toBe(scenario);
  });

  it.each([
    { matricula: '202310045612', password: 'demo' },
    { matricula: 'demo', password: 'senha-real' },
    { matricula: 'demo', password: 'DEMO' },
    { matricula: 'demo-inexistente', password: 'demo' },
    { matricula: 'demonstracao', password: 'demo' },
    { matricula: '', password: '' },
  ])('treats %j as a real credential', credentials => {
    expect(demoScenarioOf(credentials)).toBeNull();
  });

  it('round-trips every scenario', () => {
    DEMO_SCENARIOS.forEach(scenario =>
      expect(demoScenarioOf(demoCredentials(scenario))).toBe(scenario),
    );
  });
});

describe('demo academic records', () => {
  it('signs in with the fictitious student of the prototype', async () => {
    const ports = backend().ports('padrao');
    await expect(
      ports.authentication.signIn(demoCredentials()),
    ).resolves.toEqual({
      matricula: 'demo',
      name: 'Marina Albuquerque Teixeira',
      period: '2026.2',
    });
    // The vault requires the profile to echo the matricula typed at sign-in.
    await expect(
      ports.authentication.signIn({ matricula: 'DEMO', password: 'demo' }),
    ).resolves.toMatchObject({ matricula: 'DEMO' });
    await expect(ports.authentication.refresh()).resolves.toMatchObject({
      matricula: 'DEMO',
    });
    await expect(
      ports.authentication.signIn({ matricula: 'x', password: 'y' }),
    ).rejects.toMatchObject({ code: 'LOGIN_FAILED' });
  });

  it('mirrors the prototype schedule, including its edge cases', async () => {
    const schedule = await backend().ports('padrao').records.getSchedule();
    const tuesday = schedule.filter(item => item.dayNumber === 2);
    expect(
      tuesday.map(item => [
        item.class.name,
        item.startTimeAlias,
        item.endTimeAlias,
        item.periodAlias,
      ]),
    ).toEqual([
      ['Compiladores', '8:50', '10:30', 'M3'],
      ['Otimização Combinatória', '12:20', '14:10', 'T1'],
    ]);
    expect(tuesday[1].dayAlias).toBe('Terça-feira');
    expect(tuesday[1].class.uerjLocation).toContain('Sala 6019 B');

    const byName = (name: string) =>
      schedule.find(item => item.class.name === name)!.class;
    expect(byName('Compiladores').avaLocation).toBe('SALA12IMECOMP');
    expect(byName('Ética e Computação').uerjLocation).toBe('Não Informado');
    expect(byName('Computação Gráfica')).toMatchObject({ status: 'CANCELED' });
    expect(byName('Computação Gráfica').uerjLocation).toBeUndefined();

    // Same ordering contract as the portal parser.
    const order = schedule.map(
      item => item.dayNumber * 10000 + item.start_time_in_minutes,
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('returns grades, RID and history in domain format', async () => {
    const { records } = backend().ports('padrao');
    const grades = await records.getGrades();
    expect(grades).toHaveLength(5);
    expect(grades[0]).toEqual({
      id: 'IME02-10892',
      name: 'Sistemas Distribuídos',
      class: '2',
      grades: { p1: 8.5, p2: null, pf: null, result: null },
    });
    const rid = await records.getPartialRid();
    expect(rid.updatedAt).toBe('12/08/2026 14:32');
    expect(rid.subjects.find(subject => subject.position === 0)).toMatchObject({
      name: 'Computação Gráfica',
      status: 'Indeferida: choque de horário',
    });
    const history = await records.getHistory();
    expect(new Set(history.map(subject => subject.status))).toEqual(
      new Set([
        'APPROVED',
        'FAILED_BY_GRADE',
        'FAILED_BY_ATTENDANCE',
        'CANCELED',
        'IN_PROGRESS',
      ]),
    );
  });

  it('never exposes the shared fixtures to callers', async () => {
    const { records } = backend().ports('padrao');
    const first = await records.getGrades();
    first[0].name = 'alterado';
    expect((await records.getGrades())[0].name).toBe('Sistemas Distribuídos');
  });

  it('keeps curriculum consistent with the history', () => {
    const approved = new Set(
      HISTORY.filter(item => item.status === 'APPROVED').map(item => item.id),
    );
    CURRICULUM.forEach(subject =>
      expect(subject.alreadyTaken).toBe(approved.has(subject.id)),
    );
  });

  it('resolves subject details by full or numeric code', async () => {
    const { records } = backend().ports('padrao');
    const details = await records.getSubjectDetails(
      normalizeSubjectId('IME02-10892'),
    );
    expect(details).toMatchObject({
      id: 'IME02-10892',
      code: 10892,
      name: 'Sistemas Distribuídos',
    });
    expect(details.classes).toHaveLength(3);
    expect(details.classes![0]).toMatchObject({
      classNumber: 1,
      hasPreference: true,
      teachers: ['Ricardo Moura Lemos'],
      schedule: [{ Segunda: [['M3', 'M4']] }, { Quarta: [['M3', 'M4']] }],
      vacancies: { uerj: { requestedTaken: 38, requestedAvailable: 40 } },
    });
    await expect(records.getSubjectDetails('99999')).rejects.toMatchObject({
      code: 'PORTAL_LAYOUT_CHANGED',
    });
  });

  // The schedule generator (LoadPlanningSubjects) sends the full AO id, while
  // Pesquisa sends the numeric code; both must resolve to the same subject.
  it.each(['IME02-10880', '10880'])(
    'resolves subject details for %s on a cold backend',
    async subjectId => {
      const { records } = backend().ports('padrao');
      await expect(records.getSubjectDetails(subjectId)).resolves.toMatchObject(
        { id: 'IME02-10880', code: 10880 },
      );
    },
  );

  it('rejects an unknown full id like the portal does', async () => {
    const { records } = backend().ports('padrao');
    await expect(
      records.getSubjectDetails('IME02-99999'),
    ).rejects.toMatchObject({ code: 'PORTAL_LAYOUT_CHANGED' });
  });

  it('gives every catalog subject unique, searchable details', async () => {
    const { records } = backend().ports('padrao');
    const numeric = CATALOG_IDS.map(id => normalizeSubjectId(id));
    expect(new Set(numeric).size).toBe(numeric.length);
    for (const id of numeric) {
      const details = await records.getSubjectDetails(id);
      expect(details.classes?.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['rid', 0, 0, 5],
    ['vazio', 0, 0, 0],
  ] as const)(
    'scenario %s changes only the current-period data',
    async (scenario, schedule, grades, rid) => {
      const { records } = backend().ports(scenario);
      expect(await records.getSchedule()).toHaveLength(schedule);
      expect(await records.getGrades()).toHaveLength(grades);
      expect((await records.getPartialRid()).subjects).toHaveLength(rid);
      expect((await records.getHistory()).length).toBeGreaterThan(0);
    },
  );

  it.each([
    ['bloqueado', 'POSSIBLY_BLOCKED'],
    ['erro', 'PORTAL_LAYOUT_CHANGED'],
  ] as const)('scenario %s fails academic reads', async (scenario, code) => {
    const ports = backend().ports(scenario);
    await expect(
      ports.authentication.signIn(demoCredentials(scenario)),
    ).resolves.toEqual({ ...DEMO_STUDENT, matricula: `demo-${scenario}` });
    await expect(ports.records.getSchedule()).rejects.toMatchObject({ code });
    await expect(ports.records.getCurriculum()).rejects.toMatchObject({
      code,
    });
  });

  it('cancels simulated latency', async () => {
    const { records } = createDemoBackend({ slowLatencyMs: 60_000 }).ports(
      'lento',
    );
    const controller = new AbortController();
    const pending = records.getGrades({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});

describe('demo community and support', () => {
  const thread = {
    subjectId: 'IME02-10892',
    classNumber: '2',
    period: '2026.2',
  };

  it('serves the prototype thread and keeps posted messages', async () => {
    const { messageBoard } = backend().ports('padrao');
    const messages = await messageBoard.read(thread);
    expect(messages).toHaveLength(5);
    expect(messages[2].authorName).toBe(DEMO_PROFILE.name);
    expect(
      messages.every(message => !Number.isNaN(Date.parse(message.createdAt))),
    ).toBe(true);
    expect(
      await messageBoard.read({ ...thread, classNumber: '1' }),
    ).toHaveLength(0);
    await messageBoard.post({ ...thread, authorName: 'Marina', text: 'Oi!' });
    expect(await messageBoard.read(thread)).toHaveLength(6);
  });

  it('lists fictitious teachers and accepts reports without network', async () => {
    const ports = backend().ports('padrao');
    const names = await ports.teacherDirectory.list();
    expect(names).toContain('Helena Duarte Viana');
    expect(
      await ports.teacherDirectory.find('helena duarte viana'),
    ).toMatchObject({ name: 'Helena Duarte Viana' });
    await expect(
      ports.errorReporter.submit({
        page: 'Sobre',
        description: 'teste',
        diagnostic: {
          schemaVersion: 1,
          operation: 'Sobre',
          category: 'USER_REPORT',
          appVersion: '1.3.5',
          parserVersion: '2',
        },
      }),
    ).resolves.toBeUndefined();
  });
});

describe('demo schedule generator', () => {
  const candidates = [
    'IME02-10880',
    'IME02-11025',
    'IME02-11032',
    'IME02-11040',
    'IME03-10260',
  ];

  async function draft() {
    const { records } = backend().ports('padrao');
    const subjects = await Promise.all(
      candidates.map(id => records.getSubjectDetails(normalizeSubjectId(id))),
    );
    return {
      ...createScheduleDraft(),
      min_subject_amount: 4,
      max_subject_amount: 6,
      priority: ['MIN_GAPS' as const],
      selectedSubjects: CURRICULUM.filter(subject =>
        candidates.includes(subject.id),
      ),
      takenSubjects: HISTORY,
      subjects,
      selectedClasses: availableClasses(subjects, []),
    };
  }

  it('loads every selected subject on generator step 5 (full AO ids)', async () => {
    const { records } = backend().ports('padrao');
    const results = await new LoadPlanningSubjects(records).execute(
      CURRICULUM.filter(subject => candidates.includes(subject.id)),
      HISTORY,
      new AbortController().signal,
      () => undefined,
    );
    expect(results).toHaveLength(candidates.length);
    results.forEach(result => {
      expect(result.error).toBeUndefined();
      expect(result.details?.id).toBe(result.subject.id);
    });
  });

  it('produces valid, conflict-free schedules through the real use case', async () => {
    const { scheduleGenerator } = backend().ports('padrao');
    const schedules = await new GenerateSchedules(scheduleGenerator).execute(
      await draft(),
    );
    expect(schedules.length).toBeGreaterThan(0);
    expect(schedules.length).toBeLessThanOrEqual(3);
    expect(parseGeneratorResponse({ data: schedules })).toBe(schedules);
    schedules.forEach(result => {
      expect(result.schedule.length).toBeGreaterThanOrEqual(4);
      result.schedule.forEach((group, index) =>
        expect(
          hasScheduleConflict(
            group.schedules,
            result.schedule
              .filter((_, other) => other !== index)
              .flatMap(item => item.schedules),
          ),
        ).toBe(false),
      );
    });
    expect(schedules[0].schedule).toHaveLength(5);
  });

  it('returns an empty result when only conflicting classes remain', async () => {
    const { scheduleGenerator, records } = backend().ports('padrao');
    // Both classes meet on Monday and Wednesday, M3–M4.
    const [graphics, distributed] = await Promise.all([
      records.getSubjectDetails('10880'),
      records.getSubjectDetails('10892'),
    ]);
    const subjects = [graphics, distributed];
    await expect(
      scheduleGenerator.generate({
        preferences: {
          minimumSubjects: 2,
          maximumSubjects: 2,
          priorities: ['MIN_GAPS'],
          busyIntervals: [],
        },
        subjects: subjects.map(details => ({
          details,
          curriculum: CURRICULUM.find(subject => subject.id === details.id)!,
        })),
        classes: subjects.map(details => ({
          ...details.classes![0],
          subject_id: details.id!,
        })),
      }),
    ).resolves.toEqual([]);
  });

  it('refuses Projeto Final II for missing prerequisites, as the prototype does', async () => {
    const { records } = backend().ports('padrao');
    const details = await records.getSubjectDetails('10951');
    const subject = CURRICULUM.find(item => item.id === 'IME02-10951')!;
    expect(subjectEligibility(subject, details, HISTORY)).toEqual({
      eligible: false,
      reason: 'Você não possui os pré-requisitos necessários.',
    });
  });
});
