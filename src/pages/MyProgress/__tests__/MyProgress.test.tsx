import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';
import Toast from 'react-native-toast-message';
import { LIGHT } from '@root/themes';
import type {
  SubjectsTaken,
  CurriculumSubject,
} from '@root/modules/academics/domain/models';
import { defaultElectiveCredits as mockDefaultElectiveCredits } from '@root/modules/academics/domain/rules/progress';
import { AppError } from '@root/shared/errors/AppError';
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  NumberStepper,
  ProgressBar,
  StatGroup,
} from '@components/ui';
import MyProgress from '../MyProgress';
import CrChart from '../CrChart';
import { Polyline, Text as SvgText } from 'react-native-svg';

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
const mockSetConfig = jest.fn();
jest.mock('@root/modules/academics/presentation/queries', () => ({
  useHistory: () => mockHistory,
  useCurriculum: () => mockCurriculum,
}));
jest.mock('@hooks/useElectiveCreditsConfig', () => ({
  useElectiveCreditsConfig: () => ({
    config: mockDefaultElectiveCredits,
    setConfig: mockSetConfig,
  }),
}));
jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));

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
const flatten = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(flatten).join('')
    : typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : '';
const textContent = () =>
  renderer.root
    .findAllByType(Text)
    .map(node => flatten(node.props.children))
    .join('\n');
const pressButton = async (label: string) => {
  const button = renderer.root
    .findAllByType(Button)
    .find(b => b.props.label === label);
  if (!button) throw new Error(`Botão "${label}" não encontrado`);
  await act(async () => button.props.onPress());
};

beforeEach(() => {
  mockHistory = makeQuery(history);
  mockCurriculum = makeQuery(curriculum);
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
  expect(textContent()).toContain('1 concluída · 4 créditos concluídos');
  expect(textContent()).toContain('Currículo indisponível');
  expect(textContent()).not.toMatch(/\d+ de 0 /);
  expect(textContent()).not.toMatch(/\d+ no currículo/);
  expect(renderer.root.findAllByType(ProgressBar)).toHaveLength(0);
  // uma só ação de nova tentativa: a do aviso de falha no topo
  expect(
    renderer.root
      .findAllByType(Button)
      .filter(b => b.props.label === 'Tentar novamente'),
  ).toHaveLength(1);
});

it('keeps a known denominator and progress when saved curriculum data survives a refresh failure', async () => {
  mockCurriculum = makeQuery(curriculum, new AppError('NETWORK'));
  await render();
  expect(textContent()).toContain('1 de 2 disciplinas · faltam 1');
  expect(textContent()).toContain('50%');
  expect(textContent()).not.toContain('Currículo indisponível');
  expect(renderer.root.findAllByType(ProgressBar)).toHaveLength(1);
});

it('does not show a ratio or percentage for a successful empty curriculum', async () => {
  mockCurriculum = makeQuery<CurriculumSubject[]>([]);
  await render();
  expect(textContent()).not.toMatch(/\d+ de 0 /);
  expect(textContent()).not.toContain('Currículo indisponível');
  expect(renderer.root.findAllByType(ProgressBar)).toHaveLength(0);
});

it('shows the completed count and the approximate CR with its disclaimer', async () => {
  await render();
  expect(renderer.root.findByType(StatGroup).props.items).toEqual([
    { value: '1', label: 'Disciplinas concluídas' },
    { value: '8,00', label: 'CR aproximado' },
  ]);
  expect(textContent()).toContain('pode ser diferente do oficial');
  expect(renderer.root.findByType(CrChart).props.points).toEqual([
    { label: '2024/1', cra: 8, periodAverage: 8 },
  ]);
});

it('shows a skeleton instead of empty numbers while the first load runs', async () => {
  mockHistory = { ...makeQuery<SubjectsTaken[]>(undefined), isLoading: true };
  mockCurriculum = {
    ...makeQuery<CurriculumSubject[]>(undefined),
    isLoading: true,
  };
  await render();
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Carregando dados…' })
      .length,
  ).toBeGreaterThan(0);
  expect(renderer.root.findAllByType(StatGroup)).toHaveLength(0);
});

it('offers a retry when nothing could be loaded', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>(undefined, new AppError('NETWORK'));
  mockCurriculum = makeQuery<CurriculumSubject[]>(undefined);
  await render();
  const state = renderer.root.findByType(ErrorState);
  expect(state.props.message).toBe(
    'Não foi possível carregar seu progresso. Toque para tentar novamente.',
  );
  expect(renderer.root.findAllByType(StatGroup)).toHaveLength(0);
  await pressButton('Tentar novamente');
  expect(mockHistory.refetch).toHaveBeenCalled();
  expect(mockCurriculum.refetch).toHaveBeenCalled();
});

it('explains when there is no history or curriculum yet', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([]);
  mockCurriculum = makeQuery<CurriculumSubject[]>([]);
  await render();
  expect(renderer.root.findByType(EmptyState).props.text).toBe(
    'Ainda não há histórico ou currículo disponível.',
  );
  expect(renderer.root.findAllByType(StatGroup)).toHaveLength(0);
});

it('asks for the elective credits and saves them from the sheet', async () => {
  mockSetConfig.mockResolvedValue(true);
  await render();
  expect(textContent()).toContain(
    'Configure os créditos necessários para ver o progresso.',
  );
  expect(textContent()).toContain('Sem meta');
  expect(renderer.root.findByType(BottomSheet).props.visible).toBe(false);

  await pressButton('Configurar créditos');
  expect(renderer.root.findByType(BottomSheet).props.visible).toBe(true);

  const restricted = renderer.root
    .findAllByType(NumberStepper)
    .find(s => s.props.accessibilityLabel.includes('Eletiva Restrita'))!;
  await act(async () => restricted.props.onChangeText('16'));
  await pressButton('Salvar');

  expect(mockSetConfig).toHaveBeenCalledWith({
    RESTRICTED: 16,
    DEFINED: 0,
    UNIVERSAL: 0,
  });
  expect(renderer.root.findByType(BottomSheet).props.visible).toBe(false);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'success', text1: 'Créditos salvos' }),
  );
});

it('draws the CR line, the period average and the values once measured', async () => {
  mockHistory = makeQuery<SubjectsTaken[]>([
    ...history,
    { ...history[0], id: 'IME01-2', period: '2024/2', grade: 6 },
    { ...history[0], id: 'IME01-3', period: '2025/1', grade: 9 },
  ]);
  await render();
  const chart = renderer.root.findByType(CrChart);
  const box = chart.findAll(
    node => node.props.accessibilityRole === 'image' && node.props.onLayout,
  )[0];
  expect(box.props.accessibilityLabel).toBe(
    'CR acumulado de 2024/1 a 2025/1: de 8,00 para 7,67',
  );
  await act(async () =>
    box.props.onLayout({
      nativeEvent: { layout: { width: 354, height: 200 } },
    }),
  );
  expect(chart.findAllByType(Polyline)).toHaveLength(2);
  const labels = chart
    .findAllByType(SvgText)
    .map(node => flatten(node.props.children));
  expect(labels).toEqual(
    expect.arrayContaining(['8,00', '7,00', '7,67', '2024/1', '2025/1']),
  );
});
