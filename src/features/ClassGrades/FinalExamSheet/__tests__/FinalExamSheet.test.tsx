import React, { useState } from 'react';
import {
  screen,
  userEvent,
  waitFor,
  within,
} from '@testing-library/react-native';

import { Button } from '@components/ui';
import type {
  ClassGrade,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import type { SubjectLoad } from '@root/modules/academics/domain/rules/subjectLoads';
import { renderWithProviders } from '@root/test-utils/render';

import { FinalExamSheet } from '../FinalExamSheet';

type HistoryQuery = {
  data: SubjectsTaken[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: jest.Mock;
};
let mockHistory: HistoryQuery;
let mockLoads: Map<string, SubjectLoad>;
let mockFailed = false;
const mockRetry = jest.fn();

jest.mock('@root/modules/academics/presentation/useSubjectLoads', () => ({
  useSubjectLoads: () => ({
    loads: mockLoads,
    history: mockHistory,
    loading: false,
    failed: mockFailed,
    retry: mockRetry,
  }),
}));
/** O card do CR lê os dois valores e, depois, a nota. */
const crCard = (current: string, projected: string) =>
  screen.getByLabelText(
    new RegExp(
      `^CR aproximado: ${current}; com as notas do período, ${projected}\\.`,
    ),
  );
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const course = (fields: Partial<SubjectsTaken>): SubjectsTaken => ({
  id: 'IME01-00100',
  name: 'Cálculo I',
  period: '2025/2',
  credits: 4,
  workload: 60,
  type: 'MANDATORY',
  frequency: 100,
  grade: 8,
  status: 'APPROVED',
  ...fields,
});

// o histórico só tem os períodos passados; os créditos do período vêm das
// cargas (currículo, universais ou tentativas antigas)
const HISTORY = [course({ grade: 8 }), course({ id: 'IME01-00101', grade: 6 })];
const LOADS = new Map<string, SubjectLoad>([
  ['777', { credits: 6, workload: 90 }],
  ['778', { credits: 4, workload: 60 }],
  ['779', { credits: 4, workload: 60 }],
]);

const PERIOD = [
  {
    id: 'IME02-00777',
    name: 'Cálculo II',
    grades: { p1: 5.5, p2: 6.1, pf: null, result: null },
  },
  {
    id: 'IME02-00778',
    name: 'Física Experimental II',
    grades: { p1: 8, p2: 7.4, pf: null, result: null },
  },
  {
    id: 'IME02-00779',
    name: 'Álgebra Linear',
    grades: { p1: 3.2, p2: 4, pf: null, result: null },
  },
  {
    id: 'IME02-00780',
    name: 'Programação II',
    grades: { p1: 7.5, p2: null, pf: null, result: null },
  },
] as unknown as ClassGrade[];

const renderSheet = (data = PERIOD) =>
  renderWithProviders(
    <FinalExamSheet visible onClose={jest.fn()} data={data} />,
  );

beforeEach(() => {
  mockHistory = {
    data: HISTORY,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  };
  mockLoads = LOADS;
  mockFailed = false;
});

it('starts each final exam at the minimum and recomputes the final grade', async () => {
  await renderSheet();
  expect(screen.getByText('Média 5,8')).toBeOnTheScreen();
  expect(screen.getByLabelText('PF de Cálculo II: 4,2')).toBeOnTheScreen();
  expect(screen.getByText('Média final 5,0')).toBeOnTheScreen();
  // só quem precisa de PF tem contador
  expect(screen.queryByLabelText(/PF de Física/)).not.toBeOnTheScreen();
  expect(screen.queryByLabelText(/PF de Álgebra/)).not.toBeOnTheScreen();

  await userEvent.press(
    screen.getByRole('button', { name: 'Aumentar PF de Cálculo II' }),
  );
  expect(screen.getByLabelText('PF de Cálculo II: 4,5')).toBeOnTheScreen();
  expect(screen.getByText('Média final 5,15')).toBeOnTheScreen();

  const less = screen.getByRole('button', {
    name: 'Diminuir PF de Cálculo II',
  });
  await userEvent.press(less);
  await userEvent.press(less);
  expect(screen.getByLabelText('PF de Cálculo II: 3,5')).toBeOnTheScreen();
  expect(screen.getByText('Média final 4,65')).toBeOnTheScreen();

  await userEvent.press(screen.getByRole('button', { name: 'Restaurar' }));
  expect(screen.getByLabelText('PF de Cálculo II: 4,2')).toBeOnTheScreen();
});

it('projects the approximate CR with the period grades, weighted by credits', async () => {
  await renderSheet();
  // (8·4 + 6·4) / 8 = 7,00 → com 5,0 (6 cr), 7,7 (4 cr) e 3,6 (4 cr): 5,96
  const card = crCard('7,00', '5,96');
  expect(within(card).getByText('−1,04')).toBeOnTheScreen();
  expect(
    within(card).getByText(/^Inclui 3 disciplinas deste período\./),
  ).toBeOnTheScreen();
  expect(
    screen.getByText('Fica de fora até as duas provas saírem: Programação II.'),
  ).toBeOnTheScreen();

  await userEvent.press(
    screen.getByRole('button', { name: 'Aumentar PF de Cálculo II' }),
  );
  // Cálculo II com 5,15: (131,2 + 0,9) / 22 = 6,00
  expect(crCard('7,00', '6,00')).toBeOnTheScreen();
});

it('names the subjects left out for lack of credits', async () => {
  mockLoads = new Map([['777', { credits: 6, workload: 90 }]]);
  await renderSheet();
  // só Cálculo II: (8·4 + 6·4 + 5·6) / 14 = 6,14
  const card = crCard('7,00', '6,14');
  expect(
    within(card).getByText(
      /^Inclui 1 disciplina deste período\. Sem os créditos de Física Experimental II, Álgebra Linear\./,
    ),
  ).toBeOnTheScreen();
  // as fontes responderam: não há o que buscar de novo
  expect(
    screen.queryByRole('button', { name: 'Buscar os créditos de novo' }),
  ).not.toBeOnTheScreen();
});

it('offers to fetch the credits again when a source failed', async () => {
  mockLoads = new Map([['777', { credits: 6, workload: 90 }]]);
  mockFailed = true;
  await renderSheet();
  await userEvent.press(
    screen.getByRole('button', { name: 'Buscar os créditos de novo' }),
  );
  expect(mockRetry).toHaveBeenCalled();
});

it('explains when the history is missing and offers a retry', async () => {
  mockHistory = {
    data: undefined,
    isLoading: false,
    error: new Error('offline'),
    refetch: jest.fn(),
  };
  await renderSheet();
  expect(
    screen.getByText('O CR depende do histórico, que não foi carregado.'),
  ).toBeOnTheScreen();
  await userEvent.press(
    screen.getByRole('button', { name: 'Tentar novamente' }),
  );
  expect(mockHistory.refetch).toHaveBeenCalled();
  // a simulação da PF continua sem o histórico
  expect(screen.getByText('Média final 5,0')).toBeOnTheScreen();
});

it('says when no subject needs the final exam', async () => {
  await renderSheet([PERIOD[1]]);
  expect(
    screen.getByText('Nenhuma disciplina precisa de PF agora.'),
  ).toBeOnTheScreen();
  // (8·4 + 6·4 + 7,7·4) / 12 = 7,23
  expect(crCard('7,00', '7,23')).toBeOnTheScreen();
});

it('starts over each time the sheet opens', async () => {
  function Harness() {
    const [visible, setVisible] = useState(true);
    return (
      <>
        <Button label="Abrir simulação" onPress={() => setVisible(true)} />
        <FinalExamSheet
          visible={visible}
          onClose={() => setVisible(false)}
          data={PERIOD}
        />
      </>
    );
  }
  await renderWithProviders(<Harness />);
  const header = () =>
    screen.queryByRole('header', { name: 'Simular PF e CR' });
  expect(header()).toBeOnTheScreen();
  await userEvent.press(
    screen.getByRole('button', { name: 'Aumentar PF de Cálculo II' }),
  );
  expect(screen.getByLabelText('PF de Cálculo II: 4,5')).toBeOnTheScreen();

  await userEvent.press(screen.getByRole('button', { name: 'Pronto' }));
  await waitFor(() => expect(header()).not.toBeOnTheScreen());
  await userEvent.press(
    screen.getByRole('button', { name: 'Abrir simulação' }),
  );
  expect(screen.getByLabelText('PF de Cálculo II: 4,2')).toBeOnTheScreen();
});

it('has no current CR before the first graded period', async () => {
  mockHistory = { ...mockHistory, data: [] };
  await renderSheet();
  // (5·6 + 7,7·4 + 3,6·4) / 14 = 5,37, sem variação para mostrar
  const card = crCard('sem CR ainda', '5,37');
  expect(
    within(card).getByText(/^Você ainda não tem CR no histórico\./),
  ).toBeOnTheScreen();
  expect(within(card).getByText('–')).toBeOnTheScreen();
  expect(within(card).queryByText(/^[+−]/)).not.toBeOnTheScreen();
});

it('leaves a final exam without both exams out of the CR', async () => {
  await renderSheet([
    PERIOD[0],
    {
      id: 'IME02-00781',
      name: 'Estatística',
      grades: { p1: 7, p2: null, pf: 6, result: null },
    } as unknown as ClassGrade,
  ]);
  expect(
    screen.getByText('Fica de fora até as duas provas saírem: Estatística.'),
  ).toBeOnTheScreen();
  // só Cálculo II, com a PF simulada em 4,2: (8·4 + 6·4 + 5·6) / 14
  expect(
    within(crCard('7,00', '6,14')).getByText(/^Inclui 1 disciplina/),
  ).toBeOnTheScreen();
});
