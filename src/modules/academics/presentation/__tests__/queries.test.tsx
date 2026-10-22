import React from 'react';
import {
  act,
  renderHook,
  screen,
  waitFor,
  type RenderHookResult,
} from '@testing-library/react-native';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { AcademicRecordsPort } from '../../application/ports';
import { IdentityState } from '@root/modules/identity/domain/types';
import { useHistory, useSubjectDetails } from '../queries';
import { academicKeys } from '../queryKeys';
import { AppError } from '@root/shared/errors/AppError';
import { QueryNotice } from '../QueryNotice';
import type { IconName } from '@components/ui/Icon';
import { OUTLINED_GLYPHS } from '@components/ui/Icon/glyphs';
import {
  createTestQueryClient,
  createWrapper,
  renderWithProviders,
} from '@root/test-utils/render';

let mockIdentity: IdentityState;
const mockRecords = { getHistory: jest.fn(), getSubjectDetails: jest.fn() };
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => mockIdentity,
  useAppServices: () => ({
    academicRecords: mockRecords,
    // a leitura espera o login da abertura e confere a conta na hora
    identity: {
      settled: () => Promise.resolve(),
      getSnapshot: () => mockIdentity,
    },
  }),
}));

const account = (scope: string) => ({
  scope,
  name: 'Estudante',
  matricula: '123',
  period: '2026/1',
});

/**
 * Lê na renderização os campos que uma tela exibe: o React Query só renderiza
 * de novo quando muda uma propriedade já lida.
 */
function useHistoryView() {
  const { data, error, isPaused, refetch } = useHistory();
  return { data, error, isPaused, refetch };
}

let client: QueryClient;
let history: RenderHookResult<ReturnType<typeof useHistoryView>, unknown>;
const result = () => history.result.current;
const renderHistory = async () => {
  history = await renderHook(() => useHistoryView(), {
    wrapper: createWrapper({ queryClient: client }),
  });
  await settle();
};
const settle = () =>
  act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 5));
  });
/**
 * O ícone do aviso é decorativo (fora da acessibilidade): confere o glifo
 * desenhado.
 */
const drawsIcon = (name: IconName) =>
  screen.container.queryAll(node => node.props.d === OUTLINED_GLYPHS[name])
    .length > 0;

beforeEach(() => {
  onlineManager.setOnline(true);
  client = createTestQueryClient();
  mockIdentity = {
    status: 'signedIn',
    account: account('account-a'),
    error: null,
  };
  mockRecords.getHistory.mockReset().mockResolvedValue([]);
  mockRecords.getSubjectDetails
    .mockReset()
    .mockResolvedValue({ id: 'IME02-01388' });
});
afterEach(() => {
  client.clear();
  onlineManager.setOnline(true);
});

it('does not request academic data without an authenticated account', async () => {
  mockIdentity = { status: 'signedOut', account: null, error: null };
  await renderHistory();
  expect(mockRecords.getHistory).not.toHaveBeenCalled();
});

it('uses one account and period cache across mounts and silent session refresh', async () => {
  await renderHistory();
  mockIdentity = { ...mockIdentity, status: 'refreshing' };
  await history.rerender(undefined);
  await settle();
  expect(mockRecords.getHistory).toHaveBeenCalledTimes(1);
  expect(
    client
      .getQueryCache()
      .getAll()
      .map(query => query.queryKey),
  ).toEqual([academicKeys.resource('account-a', '2026/1', 'history')]);
});

it('never displays account A cached data in account B and forwards cancellation', async () => {
  let resolveLate!: (
    value: Awaited<ReturnType<AcademicRecordsPort['getHistory']>>,
  ) => void;
  let requestSignal: AbortSignal | undefined;
  mockRecords.getHistory.mockImplementationOnce(
    (options: { signal?: AbortSignal }) => {
      requestSignal = options.signal;
      return new Promise(resolve => {
        resolveLate = resolve;
      });
    },
  );
  await renderHistory();
  mockIdentity = { ...mockIdentity, account: account('account-b') };
  await history.rerender(undefined);
  await settle();
  expect(requestSignal?.aborted).toBe(true);
  resolveLate([{ id: 'private-a' }] as Awaited<
    ReturnType<AcademicRecordsPort['getHistory']>
  >);
  await settle();
  expect(result().data).toEqual([]);
  expect(
    client.getQueryData(
      academicKeys.resource('account-a', '2026/1', 'history'),
    ),
  ).toBeUndefined();
});

it('retains the last successful data when a background refresh fails without retrying layout errors', async () => {
  const saved = [{ id: 'saved' }] as Awaited<
    ReturnType<AcademicRecordsPort['getHistory']>
  >;
  mockRecords.getHistory.mockResolvedValueOnce(saved);
  await renderHistory();
  mockRecords.getHistory.mockRejectedValueOnce(
    new AppError('PORTAL_LAYOUT_CHANGED'),
  );
  await act(() => result().refetch());
  await settle();
  expect(result().data).toEqual(saved);
  expect(result().error).toMatchObject({ code: 'PORTAL_LAYOUT_CHANGED' });
  expect(mockRecords.getHistory).toHaveBeenCalledTimes(2);
});

it('uses the same subject cache for a full code and its numeric suffix', async () => {
  const { rerender } = await renderHook(
    ({ subjectId }: { subjectId: string }) => useSubjectDetails(subjectId),
    {
      initialProps: { subjectId: 'IME02-01388' },
      wrapper: createWrapper({ queryClient: client }),
    },
  );
  await settle();
  await rerender({ subjectId: '1388' });
  await settle();
  expect(mockRecords.getSubjectDetails).toHaveBeenCalledTimes(1);
  expect(mockRecords.getSubjectDetails).toHaveBeenCalledWith(
    '1388',
    expect.objectContaining({ signal: expect.any(Object) }),
  );
});

it('shows cached offline status and resumes a paused query on reconnect', async () => {
  onlineManager.setOnline(false);
  await renderHistory();
  expect(result().isPaused).toBe(true);
  expect(mockRecords.getHistory).not.toHaveBeenCalled();
  await act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(result().isPaused).toBe(false));
  expect(mockRecords.getHistory).toHaveBeenCalledTimes(1);
});

it('announces cached offline and background errors without hiding the data', async () => {
  await renderWithProviders(
    <QueryNotice
      isPaused
      isFetching={false}
      hasData
      error={null}
      retry={() => undefined}
    />,
  );
  expect(screen.getByText(/últimos dados salvos/)).toBeOnTheScreen();
  await screen.rerender(
    <QueryNotice
      isPaused={false}
      isFetching={false}
      hasData
      error={new AppError('NETWORK')}
      retry={() => undefined}
    />,
  );
  expect(screen.getByText(/^Não foi possível atualizar/)).toBeOnTheScreen();
  await screen.rerender(
    <QueryNotice
      isPaused={false}
      isFetching={false}
      hasData
      error={new AppError('POSSIBLY_BLOCKED')}
      retry={() => undefined}
    />,
  );
  // aviso `blocked`: tom crítico (anunciado como alerta) e cadeado
  const blocked = screen.getByRole('alert');
  expect(blocked).toHaveTextContent(
    /^O Aluno Online está temporariamente bloqueado\./,
  );
  expect(blocked).toHaveTextContent(/últimos dados salvos/);
  expect(drawsIcon('lock')).toBe(true);
  expect(
    screen.queryByText(/Não foi possível atualizar/),
  ).not.toBeOnTheScreen();
});
it('announces offline mode even when a fresh cached query has no paused request', async () => {
  onlineManager.setOnline(false);
  await renderWithProviders(
    <QueryNotice
      isPaused={false}
      isFetching={false}
      hasData
      dataUpdatedAt={1700000000000}
      error={null}
      retry={() => undefined}
    />,
  );
  const text = screen.getByText(/^Sem conexão/);
  expect(text).toHaveTextContent(/Última atualização:/);
});
