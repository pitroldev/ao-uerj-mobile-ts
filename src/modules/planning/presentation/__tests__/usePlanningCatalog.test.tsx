import { renderHook } from '@testing-library/react-native';

import type {
  CurriculumSubject,
  SubjectInfo,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';

import { usePlanningCatalog } from '../usePlanningCatalog';

type Query<T> = {
  data: T | undefined;
  error: unknown;
  refetch: jest.Mock;
};
const query = <T,>(data: T | undefined, error: unknown = null): Query<T> => ({
  data,
  error,
  refetch: jest.fn(),
});

let mockHistory: Query<SubjectsTaken[]>;
let mockCurriculum: Query<CurriculumSubject[]>;
let mockDetails: Query<SubjectInfo>[];
const mockAsked = jest.fn();
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useHistory: () => mockHistory,
  useCurriculum: () => mockCurriculum,
  useSubjectDetailsList: (ids: readonly string[]) => {
    mockAsked(ids);
    return mockDetails;
  },
}));

const subject = (
  id: string,
  extra: Partial<CurriculumSubject> = {},
): CurriculumSubject => ({
  id,
  name: `Disciplina ${id}`,
  type: 'MANDATORY',
  credits: 4,
  workload: 60,
  minimum_credits: null,
  ...extra,
});
const info = (id: string, extra: Partial<SubjectInfo> = {}): SubjectInfo => ({
  id,
  name: `Disciplina ${id}`,
  classes: [],
  ...extra,
});

const A = subject('IME01-1');
const B = subject('IME01-2');
const C = subject('IME01-3', { minimum_credits: 140 });
const D = subject('IME01-4');

beforeEach(() => {
  mockHistory = query<SubjectsTaken[]>([]);
  mockCurriculum = query<CurriculumSubject[]>([]);
  mockDetails = [];
});

it('asks for the classes of each chosen subject, in the order chosen', async () => {
  mockDetails = [query(info(A.id)), query(info(B.id))];
  await renderHook(() => usePlanningCatalog([A, B]));
  expect(mockAsked).toHaveBeenLastCalledWith([A.id, B.id]);
});

it('tells what the portal said of each subject', async () => {
  mockDetails = [
    query(info(A.id)),
    query(
      info(B.id, {
        prerequisite: [[{ id: 'IME01-9', name: 'Cálculo I' }]],
      }),
    ),
    query(info(C.id)),
    query<SubjectInfo>(undefined),
  ];
  const { result } = await renderHook(() => usePlanningCatalog([A, B, C, D]));
  const { availability, loading, failed } = result.current;
  expect(availability.get(A.id)).toEqual({
    status: 'ready',
    details: info(A.id),
  });
  expect(availability.get(B.id)).toMatchObject({
    status: 'refused',
    reason: 'Falta cursar antes: Cálculo I',
  });
  expect(availability.get(C.id)).toMatchObject({
    status: 'refused',
    reason: 'Exige 140 créditos cursados',
  });
  expect(availability.get(D.id)).toEqual({ status: 'loading' });
  expect({ loading, failed }).toEqual({ loading: 1, failed: 0 });
});

it('counts a failed reading and retries only what failed', async () => {
  mockDetails = [
    query(info(A.id)),
    query<SubjectInfo>(undefined, new Error('portal')),
  ];
  const { result } = await renderHook(() => usePlanningCatalog([A, B]));
  expect(result.current.availability.get(B.id)).toEqual({ status: 'failed' });
  expect(result.current.failed).toBe(1);

  result.current.retry();
  expect(mockDetails[1].refetch).toHaveBeenCalledTimes(1);
  expect(mockDetails[0].refetch).not.toHaveBeenCalled();
  expect(mockHistory.refetch).not.toHaveBeenCalled();
});

it('cannot tell who may take what without the history', async () => {
  mockDetails = [query(info(A.id))];
  mockHistory = query<SubjectsTaken[]>(undefined);
  const waiting = await renderHook(() => usePlanningCatalog([A]));
  expect(waiting.result.current.availability.get(A.id)).toEqual({
    status: 'loading',
  });

  mockHistory = query<SubjectsTaken[]>(undefined, new Error('portal'));
  const broken = await renderHook(() => usePlanningCatalog([A]));
  expect(broken.result.current.availability.get(A.id)).toEqual({
    status: 'failed',
  });
  broken.result.current.retry();
  expect(mockHistory.refetch).toHaveBeenCalledTimes(1);
});
