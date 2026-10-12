import React from 'react';
import { Linking, Text as RNText } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'styled-components/native';
import Toast from 'react-native-toast-message';

import { LIGHT } from '@root/themes';
import { AppError } from '@root/shared/errors/AppError';
import { academicKeys } from '@root/modules/academics/presentation/queryKeys';
import type {
  SubjectInfo,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import { ListRow, SearchField } from '@components/ui';
import { headerStore } from '@templates/Header';
import SubjectDetails from '../SubjectDetails';

const mockGetSubjectDetails = jest.fn();
const mockNavigation = { navigate: jest.fn(), setParams: jest.fn() };
let mockParams: { subjectId?: string; sourceRoute?: string } | undefined;

jest.mock('react-native-modal', () => 'Modal');
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
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
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({
    status: 'signedIn',
    account: { scope: 's', name: 'Marina', matricula: '1', period: '2026.2' },
  }),
  useAppServices: () => ({
    academicRecords: { getSubjectDetails: mockGetSubjectDetails },
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
let renderer: ReactTestRenderer;

const render = async () => {
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <ThemeProvider theme={LIGHT}>
          <SubjectDetails />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
};

/** O react-query avisa os observadores num setTimeout(0): espera alguns ciclos. */
const flush = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
};

const texts = () =>
  renderer.root
    .findAllByType(RNText)
    .map(t =>
      Array.isArray(t.props.children)
        ? t.props.children.join('')
        : String(t.props.children ?? ''),
    );

const byLabel = (label: string) =>
  renderer.root.findAll(
    n => n.props.accessibilityLabel === label && typeof n.type !== 'string',
  )[0];

beforeEach(() => {
  client = new QueryClient();
  mockParams = undefined;
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
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
    await render();

    expect(texts()).toEqual(
      expect.arrayContaining([
        'Sistemas Distribuídos',
        'IME02-10892',
        '60 horas',
        'Semestral',
        'Requisitos exigidos',
        'Grupo 1',
        'Grupo 2',
        'Aprovado em 2025.2',
        'Turmas',
        '2 turmas',
        '38/40',
        'Lotada',
        'Preferencial',
        'Paulo César Antunes, Lívia Moraes Prado',
        'Segunda e Quarta · M3–M4 · 8:50–10:30',
        'Terça e Quinta · N1–N2 · 18:00–19:40',
        'Acessar ementa',
      ]),
    );
    expect(
      byLabel(
        'Turma 1. Solicitadas: 38 de 40, Crítico. Ocupadas: 36 de 40, Crítico. ' +
          'Docente: Ricardo Moura Lemos. Preferencial. ' +
          'Segunda e Quarta, M3 a M4, 8:50 às 10:30',
      ),
    ).toBeTruthy();
  });

  it('opens a requirement, ignores credit locks and links the syllabus', async () => {
    mockParams = {
      subjectId: '10892',
      sourceRoute: 'Disciplinas do Currículo',
    };
    mockGetSubjectDetails.mockResolvedValue(SUBJECT);
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
    await render();

    await act(async () =>
      byLabel('Sistemas Operacionais I, IME02-10860').props.onPress(),
    );
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Pesquisa de Disciplinas',
      { subjectId: '10860', sourceRoute: 'Disciplinas do Currículo' },
    );
    expect(
      byLabel('140 Créditos, Trava de Créditos').props.onPress,
    ).toBeUndefined();

    await act(async () => byLabel('Acessar ementa').props.onPress());
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
    await render();

    const onBack = headerStore.getSnapshot().onBack;
    expect(onBack).toEqual(expect.any(Function));
    await act(async () => onBack?.());
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
    await render();

    expect(texts()).toContain('Buscando disciplina 10892');
    expect(byLabel('Carregando…')).toBeTruthy();
  });

  it('shows the error with a retry that queries again', async () => {
    mockParams = { subjectId: '10892' };
    // erro não transitório: sem a nova tentativa automática da consulta
    mockGetSubjectDetails.mockRejectedValue(
      new AppError('PORTAL_LAYOUT_CHANGED'),
    );
    await render();

    expect(texts()).toContain(
      'Ops, ocorreu um erro ao buscar as informações da disciplina. Toque aqui para tentar novamente.',
    );
    const calls = mockGetSubjectDetails.mock.calls.length;
    await act(async () => byLabel('Tentar novamente').props.onPress());
    await flush();
    expect(mockGetSubjectDetails.mock.calls.length).toBe(calls + 1);
  });

  it('explains a blocked portal when there is nothing saved', async () => {
    mockParams = { subjectId: '10892' };
    mockGetSubjectDetails.mockRejectedValue(new AppError('POSSIBLY_BLOCKED'));
    await render();

    expect(texts()).toEqual(
      expect.arrayContaining([
        'Parece que o Aluno Online está temporariamente bloqueado. Tente novamente mais tarde.',
        'Tentar novamente',
        'Acessar ementa',
      ]),
    );
  });
});

describe('subject search', () => {
  it('lists recent searches from the cache and opens them', async () => {
    client.setQueryData(
      [...academicKeys.resource('s', '2026.2', 'subject-details'), '10892'],
      SUBJECT,
    );
    await render();

    expect(texts()).toEqual(
      expect.arrayContaining(['Pesquisas recentes', 'Sistemas Distribuídos']),
    );
    const rows = renderer.root.findAllByType(ListRow);
    expect(rows).toHaveLength(1);
    await act(async () => rows[0].props.onPress());
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'Pesquisa de Disciplinas',
      { subjectId: '10892', sourceRoute: undefined },
    );
  });

  it('shows the real empty text and rejects invalid codes', async () => {
    await render();

    expect(texts()).toContain(
      'Parece que você não pesquisou nenhuma disciplina ainda, use a caixa acima para realizar a suas buscas.',
    );
    expect(byLabel('Buscar disciplina').props.disabled).toBe(true);

    await act(async () =>
      renderer.root.findByType(SearchField).props.onChangeText('abc'),
    );
    expect(byLabel('Buscar disciplina').props.disabled).toBe(false);
    await act(async () => byLabel('Buscar disciplina').props.onPress());
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text1: 'Parece que esse código não é válido :(',
      }),
    );
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});
