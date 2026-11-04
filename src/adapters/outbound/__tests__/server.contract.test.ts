/**
 * Contrato do app com o servidor (server/): os adaptadores de verdade do app,
 * com o mesmo cliente axios, falam com o servidor de verdade (com o banco em
 * memória) num processo à parte. Se uma resposta mudar de um jeito que o app
 * não lê, este teste quebra antes da implantação (o workflow do servidor o
 * roda antes de subir).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { GenerateSchedules } from '@root/modules/planning/application/GenerateSchedules';
import {
  curriculum,
  details,
  form,
} from '@root/modules/planning/application/testFixtures';
import type { ScheduleCreationParams } from '@root/modules/planning/domain/models';
import { testCrypto } from '@root/modules/trust/__tests__/testCrypto';
import { StudentSession } from '@root/modules/trust/application/StudentSession';
import { CompanionCalls } from '@root/modules/companion/application/CompanionCalls';
import {
  CompanionError,
  type Membership,
} from '@root/modules/companion/domain/companion';
import { CampusNowError } from '@root/modules/campus-now/domain/campusNow';
import { AppError } from '@root/shared/errors/AppError';

import { createStudentSessionStore } from '../persistence/student-session-store';
import {
  createPrivateApiAdapters,
  createPrivateApiClient,
} from '../private-api';
import { createCampusNowServer } from '../private-api/campusNow';
import { createCompanionServer } from '../private-api/companion';
import { createSessionClient } from '../private-api/sessionClient';
import { createStudentSessionApi } from '../private-api/studentSession';
import {
  createGeneratorTransport,
  createScheduleGeneratorAdapter,
} from '../schedule-generator';

const SERVER = path.resolve(
  __dirname,
  '../../../../server/test/fixtures/contractServer.ts',
);

let server: ChildProcess;
let base = '';

beforeAll(async () => {
  server = spawn(process.execPath, [SERVER], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', code =>
      reject(new Error(`the contract server exited with code ${code}`)),
    );
    createInterface({ input: server.stdout! }).once('line', line =>
      resolve(JSON.parse(line).port),
    );
  });
  base = `http://127.0.0.1:${port}`;
}, 30000);

afterAll(async () => {
  if (server.exitCode !== null) return;
  const exited = new Promise(resolve => server.once('exit', resolve));
  server.kill('SIGTERM');
  await exited;
});

/**
 * O app inteiro menos a Play: o crypto do Node, um cofre em memória, com a
 * conta logada, e a "Play" do servidor de teste, que só aceita o token
 * `dev:<requestHash>` com o hash que ele mesmo calcula. Assim o hash do app
 * (matrícula e nome em UTF-8) é conferido contra o do servidor.
 */
function studentSession(
  matricula = '209912345678',
  name = 'ESTUDANTE FICTÍCIA',
  attest = async (requestHash: string) => ({ token: `dev:${requestHash}` }),
) {
  const client = createPrivateApiClient(`${base}/aouerj`);
  const items = new Map<string, string>();
  const session = new StudentSession({
    api: createStudentSessionApi(client),
    device: {
      crypto: testCrypto,
      attest,
    },
    store: createStudentSessionStore({
      read: async key => items.get(key) ?? null,
      write: async (key, value) => {
        items.set(key, value);
      },
      remove: async key => {
        items.delete(key);
      },
      removePrefix: async () => undefined,
    }),
    account: () => ({ scope: `account-${matricula}`, matricula, name }),
  });
  return { client, session, student: createSessionClient(client, session) };
}

const api = () => {
  const { client, student } = studentSession();
  return createPrivateApiAdapters(client, student);
};

const thread = {
  subjectId: 'IME01-10001',
  period: '2026.2',
  classNumber: '1',
};

it('reads the portal status the server sees', async () => {
  const status = await api().portalStatus.read();
  expect(status).toEqual({
    state: 'down',
    since: expect.any(Number),
    checkedAt: expect.any(Number),
  });
});

it('posts and reads the mural in the order the app shows', async () => {
  const board = api().messageBoard;
  // o nome vem do portal, sem corte no app
  const longName = 'MARIA '.repeat(25).trim();
  const first = await board.post({
    ...thread,
    authorName: longName,
    text: 'x'.repeat(2000),
  });
  expect(first).toMatchObject({
    authorName: longName,
    ...thread,
    text: 'x'.repeat(2000),
  });
  await board.post({ ...thread, authorName: 'Bea', text: 'Segunda' });

  const messages = await board.read(thread);
  expect(messages.map(message => message.authorName)).toEqual([
    longName,
    'Bea',
  ]);
  expect(messages[0].id).toBe(first.id);
  expect(Date.parse(messages[0].createdAt)).not.toBeNaN();
  expect(await board.read({ ...thread, classNumber: '9' })).toEqual([]);
});

it('lists the teachers and reads one with subjects and classes', async () => {
  const teachers = api().teacherDirectory;
  expect(await teachers.list()).toEqual(['ADA LOVELACE']);
  expect(await teachers.find('ADA LOVELACE')).toEqual({
    id: 'teacher-1',
    name: 'ADA LOVELACE',
    updatedAt: '2023-03-01T00:00:00.000Z',
    subjects: [
      {
        id: 'IME01-10001',
        name: 'CÁLCULO I',
        classes: [
          { number: '1', location: 'F-6001' },
          { number: '2', location: '' },
        ],
      },
    ],
  });
  expect(await teachers.find('NINGUÉM')).toBeNull();
});

it('sends an error report the server accepts', async () => {
  await expect(
    api().errorReporter.submit({
      page: 'Notas',
      description: 'A nota não apareceu',
      diagnostic: {
        schemaVersion: 1,
        operation: 'grades',
        category: 'USER_REPORT',
        appVersion: '2.10.0',
        parserVersion: '1',
      },
    }),
  ).resolves.toBeUndefined();
});

it('turns a refused request into the error the app expects', async () => {
  await expect(
    api().messageBoard.read({ ...thread, subjectId: '' }),
  ).rejects.toEqual(new AppError('INVALID_INPUT'));
});

it('generates schedules the app accepts, with the most subjects first', async () => {
  const subject = (id: string, day: string) => ({
    curriculum: { ...curriculum, id },
    details: {
      ...details,
      id,
      classes: [
        { ...details.classes![0], schedule: [{ [day]: [['M1', 'M2']] }] },
      ],
    },
  });
  // A e B cabem juntas; C bate com A
  const subjects = [
    subject('IME01-10001', 'Segunda'),
    subject('IME01-10002', 'Terça'),
    subject('IME01-10003', 'Segunda'),
  ];
  const request: ScheduleCreationParams = {
    ...form,
    min_subject_amount: 1,
    max_subject_amount: 3,
    priority: ['MIN_GAPS', 'MAX_CREDITS'],
    subjectsToTake: subjects.map(entry => entry.curriculum),
    selectedSubjects: subjects.map(entry => entry.curriculum),
    subjects: subjects.map(entry => entry.details),
    selectedClasses: subjects.map(entry => ({
      ...entry.details.classes[0],
      subject_id: entry.curriculum.id,
    })),
  };

  const schedules = await new GenerateSchedules(
    createScheduleGeneratorAdapter(
      createGeneratorTransport(`${base}/schedules`),
    ),
  ).execute(request);

  expect(schedules.length).toBeGreaterThan(0);
  expect(schedules[0].schedule).toHaveLength(2);
  expect(schedules[0].schedule.map(option => option.subject_id).sort()).toEqual(
    expect.arrayContaining(['IME01-10002']),
  );
  for (const schedule of schedules)
    expect(
      new Set(schedule.schedule.map(option => option.subject_id)).size,
    ).toBe(schedule.schedule.length);
});

it('puts the subject that locks more pending subjects first with CRITICAL_FIRST', async () => {
  const subject = (id: string, day: string) => ({
    curriculum: { ...curriculum, id },
    details: {
      ...details,
      id,
      classes: [
        { ...details.classes![0], schedule: [{ [day]: [['M1', 'M2']] }] },
      ],
    },
  });
  // A e C batem na segunda; as duas cabem com B
  const subjects = [
    subject('IME01-10001', 'Segunda'),
    subject('IME01-10002', 'Terça'),
    subject('IME01-10003', 'Segunda'),
  ];
  const request: ScheduleCreationParams = {
    ...form,
    min_subject_amount: 2,
    max_subject_amount: 2,
    priority: ['CRITICAL_FIRST'],
    subjectsToTake: subjects.map(entry => entry.curriculum),
    selectedSubjects: subjects.map(entry => entry.curriculum),
    subjects: subjects.map(entry => entry.details),
    selectedClasses: subjects.map(entry => ({
      ...entry.details.classes[0],
      subject_id: entry.curriculum.id,
    })),
  };
  const generate = (criticality?: Record<string, number>) =>
    new GenerateSchedules(
      createScheduleGeneratorAdapter(
        createGeneratorTransport(`${base}/schedules`),
      ),
    ).execute({ ...request, criticality });
  const first = (schedules: Awaited<ReturnType<typeof generate>>) =>
    schedules[0].schedule.map(option => option.subject_id).sort();

  // sem a conta, empate: vale a ordem em que a busca acha (A antes de C)
  expect(first(await generate())).toEqual(['IME01-10001', 'IME01-10002']);
  // C trava 5 obrigatórias que faltam
  expect(first(await generate({ 'IME01-10003': 5 }))).toEqual([
    'IME01-10002',
    'IME01-10003',
  ]);
});

describe('the student session (/aouerj/v2)', () => {
  it('signs in with the matrícula and keeps the session for the next requests', async () => {
    const { session, student } = studentSession();
    const first = await session.token();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(student.get('/v2/teachers')).resolves.toMatchObject({
      data: { docentes: ['ADA LOVELACE'] },
    });
    // a mesma sessão no próximo pedido
    await expect(session.token()).resolves.toBe(first);
  });

  it('is refused when the attestation covers another request (another name, say)', async () => {
    const { session } = studentSession(
      '209912345678',
      'ESTUDANTE FICTÍCIA',
      async () => ({ token: `dev:${'0'.repeat(64)}` }),
    );
    await expect(session.token()).rejects.toEqual(
      new AppError('STUDENT_PROOF_UNAVAILABLE'),
    );
  });

  it('signs in again when the server no longer knows the session', async () => {
    const { session, student } = studentSession();
    const first = await session.token();
    // a saída encerra no servidor; um pedido com a sessão velha entra de novo
    await createStudentSessionApi(createPrivateApiClient(`${base}/aouerj`)).end(
      first,
    );
    await expect(student.get('/v2/teachers')).resolves.toMatchObject({
      data: { docentes: ['ADA LOVELACE'] },
    });
    await expect(session.token()).resolves.not.toBe(first);
  });

  it('runs a Companhia agora call end to end with two students: open, join, phrases, removal and leave', async () => {
    const memory = () => {
      let saved: Membership[] = [];
      return {
        read: async () => saved,
        write: async (next: readonly Membership[]) => {
          saved = [...next];
        },
      };
    };
    const calls = (matricula: string, name: string) => {
      const { student } = studentSession(matricula, name);
      const port = createCompanionServer(student, student);
      return {
        server: port,
        calls: new CompanionCalls({
          server: port,
          store: memory(),
          now: () => Date.now(),
        }),
      };
    };
    const renata = calls('209900000001', 'RENATA ALVES');
    const marina = calls('209900000002', 'MARINA COSTA');
    const bia = calls('209900000003', 'BIA SANTOS');
    const host = renata.calls;
    const guest = marina.calls;

    const opened = await host.open({
      kind: 'home',
      at: Date.now() + 20 * 60_000,
      spot: 'concha',
      destination: 'trem',
      note: 'A pé pelo Portão 1',
      capacity: 2,
      name: 'Renata',
    });
    expect(opened).toMatchObject({
      kind: 'home',
      destination: 'trem',
      members: [{ name: 'Renata', host: true, you: true }],
    });

    const {
      calls: [listed],
      watching,
    } = await guest.list();
    expect(listed).toMatchObject({ id: opened.id, host: 'Renata', going: 1 });
    // quem olha conta em "de olho agora"
    expect(watching).toBeGreaterThanOrEqual(1);
    const joined = await guest.join(opened.id, 'Marina');
    expect(joined.going).toBe(2);
    // o mesmo aluno não entra de novo, nem por outro aparelho
    await expect(marina.server.join(opened.id, 'Marina')).rejects.toEqual(
      new CompanionError('already_member'),
    );
    // a última vaga já foi: um terceiro não entra
    await expect(bia.server.join(opened.id, 'Bia')).rejects.toEqual(
      new CompanionError('full'),
    );
    // o recado com contato o servidor também recusa
    await expect(
      bia.server.open({
        kind: 'lunch',
        at: Date.now() + 20 * 60_000,
        spot: 'ru',
        destination: null,
        note: 'chama no zap',
        capacity: 4,
        name: 'Bia',
      }),
    ).rejects.toEqual(new CompanionError('contact'));

    const said = await guest.say(opened.id, 'at_spot');
    expect(said.feed).toEqual([
      { name: 'Marina', phrase: 'at_spot', at: expect.any(Number), you: true },
    ]);
    const seen = await host.read(opened.id);
    expect(seen.feed[0]).toMatchObject({ name: 'Marina', you: false });
    await guest.report(opened.id, 'other');

    // quem chamou tira alguém pelo apelido; quem saiu assim fica sabendo
    const removed = seen.members.find(member => member.name === 'Marina');
    expect(removed?.ref).toMatch(/^[A-Za-z0-9_-]{11}$/);
    const after = await host.remove(opened.id, removed!.ref);
    expect(after.going).toBe(1);
    await expect(guest.read(opened.id)).rejects.toEqual(
      new CompanionError('removed'),
    );
    expect(guest.wasRemoved(opened.id)).toBe(true);

    // quem chamou encerra: some da lista
    await host.leave(opened.id);
    expect((await guest.list()).calls).toEqual([]);
  });

  it('runs an Agora no campus notice end to end with two students: report, confirm, thanks, refusals and the end', async () => {
    const campus = (matricula: string, name: string) =>
      createCampusNowServer(studentSession(matricula, name).student);
    const renata = campus('209900000011', 'RENATA ALVES');
    const marina = campus('209900000012', 'MARINA COSTA');

    // o subsolo só existe no bloco F
    await expect(
      renata.report({
        kind: 'power',
        status: 'no_power',
        place: { type: 'floor', block: 'A', floor: 'SE' },
      }),
    ).rejects.toEqual(new CampusNowError('place'));

    const reported = await renata.report({
      kind: 'elevators',
      status: 'long_queue',
      place: { type: 'elevators' },
    });
    expect(reported).toMatchObject({
      merged: false,
      replaced: null,
      notice: {
        kind: 'elevators',
        status: 'long_queue',
        place: { type: 'elevators' },
        state: 'active',
        mine: true,
        confirmed: false,
        confirmations: 0,
      },
      you: { earned: 10, points: 10, level: 1, nextLevelAt: 100 },
    });
    const { id } = reported.notice;
    expect(reported.notice.expiresAt).toBeGreaterThan(Date.now());

    const listed = await marina.list();
    expect(listed.notices).toEqual([
      expect.objectContaining({ id, mine: false, answer: null, views: null }),
    ]);
    expect(listed.helpersToday).toBeGreaterThanOrEqual(1);

    // a primeira confirmação de outro aluno vale para todos
    const confirmed = await marina.answer(id, 'confirm');
    expect(confirmed).toMatchObject({
      notice: { confirmed: true, confirmations: 1, answer: 'confirm' },
      you: { earned: 3 },
    });
    await expect(marina.answer(id, 'confirm')).rejects.toEqual(
      new CampusNowError('answered'),
    );
    await expect(renata.answer(id, 'confirm')).rejects.toEqual(
      new CampusNowError('own'),
    );
    await expect(renata.thank(id)).rejects.toEqual(new CampusNowError('own'));
    // o mesmo aviso de novo vira a confirmação que já existe
    await expect(
      renata.report({
        kind: 'elevators',
        status: 'long_queue',
        place: { type: 'elevators' },
      }),
    ).resolves.toMatchObject({ merged: true, notice: { id } });

    expect((await marina.thank(id)).notice.thanked).toBe(true);
    await marina.seen([id]);
    await expect(marina.flag(id)).resolves.toBeUndefined();

    const you = await renata.you();
    // 10 do aviso, 5 da confirmação e 1 do "Valeu"
    expect(you.you.points).toBe(16);
    expect(you.counts).toMatchObject({
      notices: 1,
      confirmedNotices: 1,
      thanksReceived: 1,
      viewsReceived: 1,
    });
    expect(you.today).toEqual([
      expect.objectContaining({ id, mine: true, views: 1, thanks: 1 }),
    ]);

    // "Já resolveu": quem avisou encerra na hora, e o aviso sai da lista
    const ended = await renata.answer(id, 'end');
    expect(ended.notice.state).toBe('ended');
    expect((await marina.list()).notices).toEqual([]);
    await expect(marina.answer(id, 'end')).rejects.toEqual(
      new CampusNowError('gone'),
    );

    // o mês do servidor é o de São Paulo
    const month = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date());
    const community = await marina.community(month);
    expect(community.month.month).toBe(month);
    expect(community.week.notices).toBeGreaterThanOrEqual(1);
    await expect(marina.community('2000-01')).rejects.toEqual(
      new AppError('INVALID_INPUT'),
    );
  });
});
