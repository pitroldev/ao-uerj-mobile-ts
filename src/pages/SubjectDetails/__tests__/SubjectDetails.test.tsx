import React from 'react';
import { Linking } from 'react-native';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';

import { AppError } from '@root/shared/errors/AppError';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import type {
  SubjectInfo,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import {
  createTestQueryClient,
  renderWithProviders,
} from '@root/test-utils/render';
import { headerStore } from '@templates/Header';
import { snackbar } from '@components/ui';
import { SubjectDetailPage } from '../SubjectDetails';

const mockGetSubjectDetails = jest.fn();
const mockNavigation = { navigate: jest.fn(), setParams: jest.fn() };
let mockParams: { subjectId?: string; sourceRoute?: string } | undefined;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@services/rootNavigation', () => ({
  isNavigationReady: () => false,
  getCurrentRouteName: () => undefined,
  toggleDrawer: jest.fn(),
  navigate: jest.fn(),
}));
jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    useNavigation: () => mockNavigation,
    useRoute: () => ({ params: mockParams }),
  };
});
const mockIdentityState = {
  status: 'signedIn',
  account: { scope: 's', name: 'Marina', matricula: '1', period: '2026.2' },
};
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => mockIdentityState,
  useAppServices: () => ({
    academicRecords: { getSubjectDetails: mockGetSubjectDetails },
    identity: {
      settled: () => Promise.resolve(),
      getSnapshot: () => mockIdentityState,
    },
  }),
}));

const SUBJECT: SubjectInfo = {
  id: 'IME02-10892',
  name: 'Sistemas Distribuídos',
  credits: 4,
  workload: 60,
  duration: 'Semestral',
  prerequisite: [
    [{ id: 'IME02-10860', name: 'Sistemas Operacionais I' }],
    [{ id: 'Trava de Créditos', name: '140 Créditos' }],
  ],
  classes: [
    {
      classNumber: 1,
      hasPreference: true,
      teachers: ['Ricardo Moura Lemos'],
      vacancies: {
        uerj: {
          requestedTaken: 38,
          requestedAvailable: 40,
          taken: 36,
          available: 40,
        },
        freshman: {},
      },
      schedule: [{ Segunda: [['M3', 'M4']] }, { Quarta: [['M3', 'M4']] }],
    },
    {
      classNumber: 3,
      hasPreference: false,
      teachers: ['Paulo César Antunes', 'Lívia Moraes Prado'],
      vacancies: {
        uerj: {
          requestedTaken: 40,
          requestedAvailable: 40,
          taken: 40,
          available: 40,
        },
        freshman: {},
      },
      schedule: [{ Terça: [['N1', 'N2']] }, { Quinta: [['N1', 'N2']] }],
    },
  ],
};

const HISTORY = [
  {
    id: 'IME02-10860',
    name: 'Sistemas Operacionais I',
    period: '2025.2',
    status: 'APPROVED',
  },
] as SubjectsTaken[];

let client: QueryClient;

const renderPage = () =>
  renderWithProviders(<SubjectDetailPage />, { queryClient: client });

/** A disciplina chega depois da consulta: espera o título dela. */
const findSubjectTitle = () =>
  screen.findByRole('header', { name: 'Sistemas Distribuídos' });

const searchButton = () =>
  screen.getByRole('button', { name: 'Buscar disciplina' });

beforeEach(() => {
  client = createTestQueryClient();
  mockParams = undefined;
});

afterEach(() => {
  client.clear();
  headerStore.setBack(null);
});

describe('subject details', () => {
  it('shows properties, requirements and the classes table', async () => {
    mockParams = { subjectId: '10892' };
    mockGetSubjectDetails.mockResolvedValue(SUBJECT);
    client.setQueryData(
      academicKeys.resource('s', '2026.2', 'history'),
      HISTORY,
    );
    await renderPage();

    expect(await findSubjectTitle()).toBeOnTheScreen();
    for (const text of [
      'IME02-10892',
      '60 horas',
      'Semestral',
      'Aprovado em 2025.2',
      '2 turmas',
      '38/40',
      'Preferencial',
      'Paulo César Antunes, Lívia Moraes Prado',
      'Segunda e Quarta · M3–M4 · 8:50–10:30',
      'Terça e Quinta · N1–N2 · 18:00–19:40',
    ]) {
      expect(screen.getByText(text)).toBeOnTheScreen();
    }
    for (const title of [
      'Requisitos exigidos',
      'Grupo 1',
      'Grupo 2',
      'Turmas',
    ]) {
      expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    }
    // vagas solicitadas e ocupadas da turma 3
    expect(screen.getAllByText('Lotada')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Acessar ementa' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Turma 1. Solicitadas: 38 de 40, Crítico. Ocupadas: 36 de 40, Crítico. ' +
          'Docente: Ricardo Moura Lemos. Preferencial. ' +
          'Segunda e Quarta, M3 a M4, 8:50 às 10:30',
      ),
    ).toBeOnTheScreen();
  });

  it('opens a requirement, ignores credit locks and links the syllabus', async () => {
    mockParams = {
      subjectId: '10892',
      sourceRoute: 'Disciplinas do Currículo',
    };
    mockGetSubjectDetails.mockResolvedValue(SUBJECT);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderPage();
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', {
        name: 'Sistemas Operacionais I, IME02-10860',
      }),
    );
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Pesquisa de Disciplinas',
      { subjectId: '10860', sourceRoute: 'Disciplinas do Currículo' },
    );
    // a trava de créditos aparece, mas não é uma disciplina que se possa abrir
    expect(
      screen.getByLabelText('140 Créditos, Trava de Créditos'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: '140 Créditos, Trava de Créditos' }),
    ).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Acessar ementa' }));
    expect(openURL).toHaveBeenCalledWith(
      'https://www.ementario.uerj.br/ementa.php?cdg_disciplina=10892',
    );
  });

  it('goes back through the header arrow, as the Android back does', async () => {
    mockParams = {
      subjectId: '10892',
      sourceRoute: 'Disciplinas do Currículo',
    };
    mockGetSubjectDetails.mockResolvedValue(SUBJECT);
    await renderPage();
    await findSubjectTitle();

    // a seta fica no cabeçalho do app (fora desta tela), que lê o headerStore
    const onBack = headerStore.getSnapshot().onBack;
    expect(onBack).toEqual(expect.any(Function));
    await act(() => onBack?.());
    expect(mockNavigation.setParams).toHaveBeenCalledWith({
      subjectId: undefined,
      sourceRoute: undefined,
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Disciplinas do Currículo',
    );
  });

  it('shows a skeleton while the first load is running', async () => {
    mockParams = { subjectId: '10892' };
    mockGetSubjectDetails.mockReturnValue(new Promise(() => undefined));
    await renderPage();

    expect(screen.getByText('Buscando disciplina 10892')).toBeOnTheScreen();
    expect(screen.getByLabelText('Carregando…')).toBeBusy();
  });

  it('shows the error with a retry that queries again', async () => {
    mockParams = { subjectId: '10892' };
    // erro não transitório: sem a nova tentativa automática da consulta
    mockGetSubjectDetails.mockRejectedValue(
      new AppError('PORTAL_LAYOUT_CHANGED'),
    );
    await renderPage();

    expect(
      await screen.findByText(
        'Ops, ocorreu um erro ao buscar as informações da disciplina. Toque aqui para tentar novamente.',
      ),
    ).toBeOnTheScreen();
    const calls = mockGetSubjectDetails.mock.calls.length;
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() =>
      expect(mockGetSubjectDetails).toHaveBeenCalledTimes(calls + 1),
    );
  });

  it('explains a blocked portal when there is nothing saved', async () => {
    mockParams = { subjectId: '10892' };
    mockGetSubjectDetails.mockRejectedValue(new AppError('POSSIBLY_BLOCKED'));
    await renderPage();

    expect(
      await screen.findByText(
        'Parece que o Aluno Online está temporariamente bloqueado. Tente novamente mais tarde.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Acessar ementa' }),
    ).toBeOnTheScreen();
  });
});

describe('subject search', () => {
  it('lists recent searches from the cache and opens them', async () => {
    client.setQueryData(
      [...academicKeys.resource('s', '2026.2', 'subject-details'), '10892'],
      SUBJECT,
    );
    await renderPage();

    expect(
      screen.getByRole('header', { name: 'Pesquisas recentes' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Sistemas Distribuídos')).toBeOnTheScreen();
    // além do botão de busca, só a linha da disciplina salva
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAccessibleName('Buscar disciplina');
    expect(buttons[1]).toHaveAccessibleName(/^Sistemas Distribuídos /);

    await userEvent.setup().press(buttons[1]);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Pesquisa de Disciplinas',
      { subjectId: '10892', sourceRoute: undefined },
    );
  });

  it('shows the real empty text and rejects invalid codes', async () => {
    const showError = jest.spyOn(snackbar, 'error');
    await renderPage();

    expect(
      screen.getByText(
        'Parece que você não pesquisou nenhuma disciplina ainda, use a caixa acima para realizar a suas buscas.',
      ),
    ).toBeOnTheScreen();
    expect(searchButton()).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código da disciplina'), 'abc');
    expect(searchButton()).toBeEnabled();
    await user.press(searchButton());
    expect(showError).toHaveBeenCalledWith(
      'Parece que esse código não é válido :(',
      'Certifique-se de que escreveu o código corretamente.',
    );
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});
