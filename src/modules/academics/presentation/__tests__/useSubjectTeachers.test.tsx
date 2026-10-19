import { act, renderHook } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';
import type { AttendedClassesSchedule, SubjectInfo } from '../../domain/models';
import { academicKeys } from '../queryKeys';
import {
  useSubjectTeachers,
  type SubjectTeachers,
} from '../useSubjectTeachers';
import { createTestQueryClient, createWrapper } from '@root/test-utils/render';

const mockRecords = { getSubjectDetails: jest.fn() };
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({
    status: 'signedIn',
    account: {
      scope: 'account-a',
      name: 'Estudante',
      matricula: '123',
      period: '2026/1',
    },
    error: null,
  }),
  useAppServices: () => ({ academicRecords: mockRecords }),
}));

const lesson = (
  id: string,
  turma: string,
  day = 1,
): AttendedClassesSchedule => ({
  class: {
    id,
    name: id,
    class: turma,
    avaLocation: '',
    uerjLocation: '',
    status: '',
  },
  dayAlias: '',
  dayNumber: day,
  subject_id: id,
  periodAlias: 'M1',
  startTimeAlias: '7:00',
  endTimeAlias: '8:40',
  start_time_in_minutes: 420,
  end_time_in_minutes: 520,
});

/** Turmas da Pesquisa de Disciplinas: [número, professores]. */
const details = (classes: Array<[number, string[]]>): SubjectInfo => ({
  classes: classes.map(([classNumber, teachers]) => ({
    classNumber,
    teachers,
    vacancies: { uerj: {}, freshman: {} },
  })),
});

let client: QueryClient;
const renderLoader = async () =>
  (
    await renderHook(() => useSubjectTeachers(), {
      wrapper: createWrapper({ queryClient: client }),
    })
  ).result;
const load = async (items: AttendedClassesSchedule[]) => {
  const result = await renderLoader();
  let teachers: SubjectTeachers = new Map();
  await act(async () => {
    teachers = await result.current(items);
  });
  return teachers;
};

beforeEach(() => {
  client = createTestQueryClient();
  mockRecords.getSubjectDetails.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

it("reads the teachers of the student's class, once per subject", async () => {
  mockRecords.getSubjectDetails.mockImplementation(async (id: string) =>
    id === 'IME02-10892'
      ? details([
          [1, ['Lia Prado']],
          [2, ['Ana Souza', '', 'João Lima']],
        ])
      : details([[1, []]]),
  );
  const teachers = await load([
    lesson('IME02-10892', '2'),
    lesson('IME02-10892', '2', 3),
    lesson('IME02-10871', '1'),
  ]);
  expect(mockRecords.getSubjectDetails).toHaveBeenCalledTimes(2);
  // a turma sem professor informado fica fora do mapa
  expect(teachers).toEqual(new Map([['10892', ['Ana Souza', 'João Lima']]]));
});

it('uses the subject details already in the shared cache', async () => {
  client.setQueryData(
    academicKeys.details('account-a', '2026/1', '10892'),
    details([[2, ['Ana Souza']]]),
  );
  const teachers = await load([lesson('IME02-10892', '2')]);
  expect(mockRecords.getSubjectDetails).not.toHaveBeenCalled();
  expect(teachers.get('10892')).toEqual(['Ana Souza']);
});

it('leaves out a subject whose page fails', async () => {
  mockRecords.getSubjectDetails.mockImplementation(async (id: string) => {
    if (id === 'IME02-10871') throw new Error('portal');
    return details([[2, ['Ana Souza']]]);
  });
  const teachers = await load([
    lesson('IME02-10871', '1'),
    lesson('IME02-10892', '2'),
  ]);
  expect(teachers).toEqual(new Map([['10892', ['Ana Souza']]]));
});

it('stops waiting for the portal after the deadline and cancels the reads', async () => {
  jest.useFakeTimers();
  const signals: AbortSignal[] = [];
  mockRecords.getSubjectDetails.mockImplementation(
    (_id: string, { signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return new Promise(() => undefined);
    },
  );
  const result = await renderLoader();
  let teachers: SubjectTeachers | undefined;
  await act(async () => {
    const pending = result
      .current([
        lesson('IME02-10892', '2'),
        lesson('IME02-10871', '1'),
        lesson('IME02-10905', '3'),
      ])
      .then(found => {
        teachers = found;
      });
    await jest.advanceTimersByTimeAsync(10_000);
    await pending;
  });
  expect(teachers).toEqual(new Map());
  // duas leituras por vez no portal, as duas canceladas no prazo
  expect(signals).toHaveLength(2);
  expect(signals.every(signal => signal.aborted)).toBe(true);
});
