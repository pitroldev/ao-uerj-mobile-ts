import type {
  ClassGrade,
  EnrollmentResult,
  PartialRidResult,
} from '@root/modules/academics/domain/models';
import type { StudentDocument } from '@root/modules/documents/domain/models';
import { AppError } from '@root/shared/errors/AppError';
import { PAUSE_AFTER_REFUSAL } from '../../domain/checkState';
import { CHECK_STATE_KEY, PREFERENCES_KEY } from '../NotificationSettings';
import { PortalCheck } from '../PortalCheck';
import type { AcademicCachePort, CachedResource } from '../ports';
import { createDevice, createRemote, createStore } from './fakes';

const ACCOUNT = { scope: 'account-1', period: '2026.2' };
/** Sexta, 16/10/2026, 14h: fora do horário de silêncio. */
const AFTERNOON = new Date(2026, 9, 16, 14, 0).getTime();

const grades = (p2: number | null): ClassGrade[] => [
  {
    id: 'IME02-00001',
    name: 'Cálculo II',
    class: '3',
    grades: { p1: 7, p2, pf: null, result: null },
  },
];

const rid = (position: number): PartialRidResult => ({
  updatedAt: '16/10/2026 10:00',
  subjects: [
    {
      id: 'IME02-00001',
      name: 'Cálculo II',
      classNumber: 3,
      available: 40,
      requested: 50,
      position,
      status: 'Em análise',
    },
  ],
});

const result = (accepted: boolean): EnrollmentResult => ({
  subjects: [
    {
      id: 'IME02-00001',
      name: 'Cálculo II',
      classNumber: '3',
      accepted,
      reason: accepted ? '' : 'Falta Requisito (CO/PRE)',
    },
  ],
});

const expiring: StudentDocument = {
  id: '1:2:3',
  title: 'Declaração de Matrícula',
  validUntil: '18/10/2026',
  hasExistingDocument: true,
  canIssue: true,
  canDelete: true,
  revision: '3',
};

function createCache(initial: Partial<Record<CachedResource, unknown>> = {}) {
  const data = new Map<CachedResource, { data: unknown; updatedAt: number }>(
    Object.entries(initial).map(([resource, value]) => [
      resource as CachedResource,
      { data: value, updatedAt: 1 },
    ]),
  );
  const cache = {
    data,
    read: jest.fn(
      (_account: unknown, resource: CachedResource) =>
        data.get(resource) ?? null,
    ),
    write: jest.fn(
      (_account: unknown, resource: CachedResource, value: unknown) => {
        data.set(resource, { data: value, updatedAt: AFTERNOON });
      },
    ),
    flush: jest.fn(async () => undefined),
  };
  return cache as typeof cache & AcademicCachePort;
}

function setup({
  preferences = { grades: true, rid: true, documents: true },
  state,
  cache = createCache(),
  device = createDevice(),
  remote = createRemote(),
  now = AFTERNOON,
  account = ACCOUNT,
}: {
  preferences?: Record<string, unknown>;
  state?: Record<string, unknown>;
  cache?: ReturnType<typeof createCache>;
  device?: ReturnType<typeof createDevice>;
  remote?: ReturnType<typeof createRemote>;
  now?: number;
  account?: typeof ACCOUNT | null;
} = {}) {
  const store = createStore({
    [`${ACCOUNT.scope}/${PREFERENCES_KEY}`]: preferences,
    ...(state ? { [`${ACCOUNT.scope}/${CHECK_STATE_KEY}`]: state } : {}),
  });
  const records = {
    getGrades: jest.fn(async () => grades(8.5)),
    getPartialRid: jest.fn(async () => rid(5)),
    getEnrollmentResult: jest.fn(async () => result(true)),
    getSchedule: jest.fn(async () => []),
  };
  const documents = { list: jest.fn(async () => [expiring]) };
  const current = { account };
  const onRecorded = jest.fn();
  const check = new PortalCheck({
    records,
    documents,
    cache,
    device,
    store,
    account: () => current.account,
    // a conta salva no aparelho é a mesma que a restauração ativa
    savedScope: async () => account?.scope ?? null,
    remote,
    now: () => now,
    onRecorded,
  });
  const saved = () => store.data.get(`${ACCOUNT.scope}/${CHECK_STATE_KEY}`);
  return {
    check,
    records,
    documents,
    cache,
    device,
    store,
    current,
    saved,
    onRecorded,
  };
}

it('takes the first reading as the reference, without notifying', async () => {
  const { check, device, cache, saved } = setup({
    preferences: { grades: true, rid: true },
  });
  await expect(check.run()).resolves.toBe('ok');
  expect(device.notify).not.toHaveBeenCalled();
  expect(cache.data.get('grades')?.data).toEqual(grades(8.5));
  expect(cache.data.get('partial-rid')?.data).toEqual(rid(5));
  expect(cache.flush).toHaveBeenCalled();
  expect(saved()).toMatchObject({ lastRunAt: AFTERNOON, lastOutcome: 'ok' });
});

it('notifies new grades, RID changes and expiring documents once', async () => {
  const { check, device, saved, onRecorded } = setup({
    cache: createCache({ grades: grades(null), 'partial-rid': rid(12) }),
  });
  await check.run();
  expect(device.notify.mock.calls.map(([content]) => content)).toEqual([
    expect.objectContaining({
      id: 'grades:IME02-00001:3',
      body: 'Saiu a nota da P2.',
    }),
    expect.objectContaining({
      id: 'rid:IME02-00001:3',
      body: 'Sua posição passou de 12 para 5, com 40 vagas.',
    }),
    expect.objectContaining({
      id: 'documents:1:2:3',
      title: 'Documento vence em 2 dias',
      target: 'documents',
    }),
  ]);
  expect(saved()).toMatchObject({
    documentsCheckedAt: AFTERNOON,
    notifiedDocuments: ['1:2:3|3|18/10/2026'],
  });
  expect(onRecorded).toHaveBeenCalledWith(
    ACCOUNT.scope,
    expect.objectContaining({ lastOutcome: 'ok' }),
  );
});

it('sums up a new enrollment result in one notification', async () => {
  const { check, device, cache } = setup({
    preferences: { rid: true },
    cache: createCache({
      'partial-rid': rid(5),
      'enrollment-result': result(false),
    }),
  });
  await check.run();
  expect(device.notify).toHaveBeenCalledTimes(1);
  expect(device.notify).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'enrollment:result',
      title: 'Resultado da inscrição',
      body: 'Cálculo II (turma 3): inscrição aceita.',
    }),
  );
  expect(cache.data.get('enrollment-result')?.data).toEqual(result(true));
});

it('repeats the whole enrollment result when part of it changes', async () => {
  const before = result(true);
  const after: EnrollmentResult = {
    subjects: [
      ...before.subjects,
      {
        id: 'IME02-00002',
        name: 'Física I',
        classNumber: '1',
        accepted: false,
        reason: 'Sem vaga',
      },
    ],
  };
  const { check, device, records } = setup({
    preferences: { rid: true },
    cache: createCache({ 'partial-rid': rid(5), 'enrollment-result': before }),
  });
  records.getEnrollmentResult.mockResolvedValue(after);
  await check.run();
  expect(device.notify).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'enrollment:result',
      title: 'Resultado da inscrição atualizado',
      body: 'Aceitas: Cálculo II. Não aceitas: Física I — sem vaga.',
    }),
  );
});

it('shows the grade value only when the student asked for it', async () => {
  const { check, device } = setup({
    preferences: { grades: true, gradeValues: true },
    cache: createCache({ grades: grades(null) }),
  });
  await check.run();
  expect(device.notify).toHaveBeenCalledWith(
    expect.objectContaining({ body: 'P2: 8,5' }),
  );
});

it('reads only the pages of the notifications that are on', async () => {
  const { check, records, documents } = setup({ preferences: { rid: true } });
  await check.run();
  expect(records.getGrades).not.toHaveBeenCalled();
  expect(records.getPartialRid).toHaveBeenCalledTimes(1);
  expect(documents.list).not.toHaveBeenCalled();
});

it('checks documents and the schedule at most once a day', async () => {
  const { check, records, documents } = setup({
    preferences: { documents: true, classReminders: true },
    state: { documentsCheckedAt: AFTERNOON - 60 * 60 * 1000 },
    cache: createCache({ schedule: [] }),
  });
  await check.run();
  expect(documents.list).not.toHaveBeenCalled();
  // a grade salva é antiga (updatedAt 1): atualiza para os lembretes
  expect(records.getSchedule).toHaveBeenCalledTimes(1);
});

it('does not repeat a document already notified', async () => {
  const { check, device } = setup({
    preferences: { documents: true },
    state: { notifiedDocuments: ['1:2:3|3|18/10/2026'] },
  });
  await check.run();
  expect(device.notify).not.toHaveBeenCalled();
});

it.each([
  ['nobody is signed in', { account: null }],
  ['only class reminders are on', { preferences: { classReminders: true } }],
  [
    'the remote switch turned notifications off',
    { remote: createRemote(true) },
  ],
  [
    'the permission was withdrawn',
    { device: createDevice({ permission: 'denied' }) },
  ],
  ['it is night', { now: new Date(2026, 9, 16, 23, 0).getTime() }],
  ['the portal refused recently', { state: { pausedUntil: AFTERNOON + 1000 } }],
])('skips without reading the portal when %s', async (_case, options) => {
  const { check, records, documents } = setup(options);
  // decidido antes do login, com a conta salva no aparelho
  await expect(check.canRun()).resolves.toBe(false);
  await expect(check.run()).resolves.toBe('skipped');
  expect(records.getGrades).not.toHaveBeenCalled();
  expect(records.getPartialRid).not.toHaveBeenCalled();
  expect(documents.list).not.toHaveBeenCalled();
});

it('lets the task sign in when a check is due', async () => {
  await expect(setup().check.canRun()).resolves.toBe(true);
});

it('stops when the session is lost again after the adapter signed in once more', async () => {
  const { check, records, documents, saved } = setup();
  records.getGrades.mockRejectedValue(new AppError('SESSION_EXPIRED'));
  await expect(check.run()).resolves.toBe('failed');
  expect(records.getPartialRid).not.toHaveBeenCalled();
  expect(documents.list).not.toHaveBeenCalled();
  expect(saved()).toMatchObject({ lastOutcome: 'failed', pausedUntil: null });
});

it('stops notifying and saving when the account leaves while notifying', async () => {
  const { check, device, store, current } = setup({
    cache: createCache({ grades: grades(null), 'partial-rid': rid(12) }),
  });
  device.notify.mockImplementationOnce(async () => {
    current.account = null;
  });
  await expect(check.run()).resolves.toBe('skipped');
  expect(device.notify).toHaveBeenCalledTimes(1);
  expect(store.write).not.toHaveBeenCalled();
});

it('pauses after the portal blocks or limits requests, and stops reading', async () => {
  const { check, records, saved, device } = setup();
  records.getGrades.mockRejectedValue(new AppError('POSSIBLY_BLOCKED'));
  await expect(check.run()).resolves.toBe('blocked');
  expect(records.getPartialRid).not.toHaveBeenCalled();
  expect(device.notify).not.toHaveBeenCalled();
  expect(saved()).toMatchObject({
    lastOutcome: 'blocked',
    pausedUntil: AFTERNOON + PAUSE_AFTER_REFUSAL,
  });
});

it.each([
  ['SERVICE_UNAVAILABLE', 'unavailable'],
  ['NETWORK', 'offline'],
  ['LOGIN_FAILED', 'signed-out'],
] as const)('stops on %s without pausing', async (code, outcome) => {
  const { check, records, saved } = setup();
  records.getGrades.mockRejectedValue(new AppError(code));
  await expect(check.run()).resolves.toBe(outcome);
  expect(records.getPartialRid).not.toHaveBeenCalled();
  expect(saved()).toMatchObject({ lastOutcome: outcome, pausedUntil: null });
});

it('keeps checking other pages when one page has an unexpected layout', async () => {
  const { check, records, device } = setup({
    cache: createCache({ 'partial-rid': rid(12) }),
  });
  records.getGrades.mockRejectedValue(new AppError('PORTAL_LAYOUT_CHANGED'));
  await expect(check.run()).resolves.toBe('failed');
  expect(device.notify).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'rid:IME02-00001:3' }),
  );
});

it('neither notifies nor saves when the account changes during the check', async () => {
  const { check, records, device, store, current } = setup({
    cache: createCache({ grades: grades(null) }),
  });
  records.getGrades.mockImplementation(async () => {
    current.account = null;
    return grades(8.5);
  });
  await expect(check.run()).resolves.toBe('skipped');
  expect(device.notify).not.toHaveBeenCalled();
  expect(store.write).not.toHaveBeenCalled();
});
