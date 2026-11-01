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
import { AppError } from '@root/shared/errors/AppError';

import {
  createPrivateApiAdapters,
  createPrivateApiClient,
} from '../private-api';
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

const api = () =>
  createPrivateApiAdapters(createPrivateApiClient(`${base}/aouerj`));

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
