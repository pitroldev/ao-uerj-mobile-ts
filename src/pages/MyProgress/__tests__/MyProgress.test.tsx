import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';
import { LIGHT } from '@root/themes';
import type {
  SubjectsTaken,
  CurriculumSubject,
} from '@root/modules/academics/domain/models';
import { defaultElectiveCredits as mockDefaultElectiveCredits } from '@root/modules/academics/domain/rules/progress';
import { AppError } from '@root/shared/errors/AppError';
import MyProgress from '../MyProgress';
import { ProgressTrack } from '../MyProgress.styles';

const makeQuery = <T,>(data: T | undefined, error: Error | null = null) => ({
  data,
  error,
  isLoading: false,
  isPaused: false,
  isFetching: false,
  dataUpdatedAt: data === undefined ? 0 : 1700000000000,
  refetch: jest.fn(),
});
let mockHistory: ReturnType<typeof makeQuery<SubjectsTaken[]>>;
let mockCurriculum: ReturnType<typeof makeQuery<CurriculumSubject[]>>;
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useHistory: () => mockHistory,
  useCurriculum: () => mockCurriculum,
}));
jest.mock('@hooks/useElectiveCreditsConfig', () => ({
  useElectiveCreditsConfig: () => ({
    config: mockDefaultElectiveCredits,
    setConfig: jest.fn(),
  }),
}));
jest.mock('@react-native-vector-icons/material-icons', () => ({
  MaterialIcons: 'Icon',
}));
jest.mock('@react-native-vector-icons/ant-design', () => ({
  AntDesign: 'Icon',
}));
jest.mock('../CraLineChart', () => 'CraLineChart');
jest.mock('../ElectiveCreditsModal', () => 'ElectiveCreditsModal');

let renderer: ReactTestRenderer;
const history: SubjectsTaken[] = [
  {
    id: 'IME01-12345',
    name: 'Álgebra',
    period: '2024/1',
    credits: 4,
    workload: 60,
    type: 'MANDATORY',
    frequency: 100,
    grade: 8,
    status: 'APPROVED',
  },
];
const curriculum: CurriculumSubject[] = ['IME01-12345', 'IME01-12346'].map(
  id => ({
    id,
    name: 'Álgebra',
    type: 'MANDATORY',
    credits: 4,
    workload: 60,
    minimum_credits: null,
  }),
);
const render = async () => {
  await act(async () => {
    renderer = create(
      <ThemeProvider theme={LIGHT}>
        <MyProgress />
      </ThemeProvider>,
    );
  });
};
const textContent = () =>
  renderer.root
    .findAllByType(Text)
    .map(node =>
      Array.isArray(node.props.children)
        ? node.props.children.join('')
        : node.props.children,
    )
    .join('\n');

beforeEach(() => {
  mockHistory = makeQuery(history);
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

it('preserves completed courses from history without inventing curriculum totals after a partial failure', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>(
    undefined,
    new AppError('NETWORK'),
  );
  await render();
  expect(textContent()).toContain('Concluídas: 1');
  expect(textContent()).toContain('Créditos concl.: 4');
  expect(textContent()).toContain('Currículo indisponível');
  expect(textContent()).not.toContain('1/0');
  expect(textContent()).not.toContain('Ofertadas no currículo: 0');
  expect(renderer.root.findAllByType(ProgressTrack)).toHaveLength(0);
});

it('keeps a known denominator and progress when saved curriculum data survives a refresh failure', async () => {
  mockCurriculum = makeQuery(curriculum, new AppError('NETWORK'));
  await render();
  expect(textContent()).toContain('Concluídas: 1/2');
  expect(textContent()).not.toContain('Currículo indisponível');
  expect(renderer.root.findAllByType(ProgressTrack)).toHaveLength(1);
});

it('does not show a ratio or percentage for a successful empty curriculum', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>([]);
  await render();
  expect(textContent()).not.toContain('1/0');
  expect(textContent()).not.toContain('Currículo indisponível');
  expect(renderer.root.findAllByType(ProgressTrack)).toHaveLength(0);
});
