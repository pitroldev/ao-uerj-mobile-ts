import { useLayoutEffect } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';
import type {
  CurriculumSubject,
  SubjectInfo,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { createTestQueryClient, createWrapper } from '@root/test-utils/render';
import { usePlanningSubjects } from '../usePlanningSubjects';
import { curriculum, details } from '../../application/testFixtures';

const mockGetSubjectDetails = jest.fn();
const mockServices = {
  academicRecords: { getSubjectDetails: mockGetSubjectDetails },
};
let mockAccount: { scope: string; period: string } | null = null;
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({ account: mockAccount }),
  useAppServices: () => mockServices,
}));

const other: CurriculumSubject = { ...curriculum, id: 'IME01-54321' };
const history: SubjectsTaken[] = [];
let client: QueryClient;

/** Estado de cada render aplicado à tela, antes do efeito que inicia a carga. */
let commits: { loading: boolean; completed: number }[];
const renderPlanning = (
  subjects: CurriculumSubject[],
  taken: SubjectsTaken[] | undefined,
) =>
  renderHook(
    (props: { subjects: CurriculumSubject[] }) => {
      const state = usePlanningSubjects(props.subjects, taken);
      useLayoutEffect(() => {
        commits.push({ loading: state.loading, completed: state.completed });
      });
      return state;
    },
    {
      initialProps: { subjects },
      wrapper: createWrapper({ queryClient: client }),
    },
  );

beforeEach(() => {
  commits = [];
  mockAccount = { scope: 'account-a', period: '2026.2' };
  mockGetSubjectDetails.mockReset().mockResolvedValue(details);
  client = createTestQueryClient();
});
afterEach(() => {
  client.clear();
});

it('reports the load as running from the first render until every subject arrives', async () => {
  const { result } = await renderPlanning([curriculum], history);
  expect(commits[0]).toEqual({ loading: true, completed: 0 });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.completed).toBe(1);
  expect(result.current.results[0]).toMatchObject({
    subject: curriculum,
    details,
    eligible: true,
  });
});

it('starts a new selection from zero instead of showing the previous results', async () => {
  const { result, rerender } = await renderPlanning([curriculum], history);
  await waitFor(() => expect(result.current.completed).toBe(1));
  mockGetSubjectDetails.mockReturnValue(new Promise<SubjectInfo>(() => {}));
  const before = commits.length;
  await rerender({ subjects: [other] });
  expect(commits[before]).toEqual({ loading: true, completed: 0 });
  expect(result.current).toMatchObject({
    loading: true,
    completed: 0,
    total: 1,
    results: [],
  });
  expect(mockGetSubjectDetails).toHaveBeenLastCalledWith(
    other.id,
    expect.anything(),
  );
});

it.each([
  ['the history', () => renderPlanning([curriculum], undefined)],
  [
    'an account',
    () => {
      mockAccount = null;
      return renderPlanning([curriculum], history);
    },
  ],
])('stays idle without %s', async (_missing, renderIdle) => {
  const { result } = await renderIdle();
  expect(result.current).toMatchObject({ loading: false, completed: 0 });
  expect(mockGetSubjectDetails).not.toHaveBeenCalled();
});
