import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { AcademicRecordsPort } from '../../application/ports';
import { IdentityState } from '@root/modules/identity/domain/types';
import { useHistory, useSubjectDetails } from '../queries';
import { academicKeys } from '../queryKeys';
import { AppError } from '@root/shared/errors/AppError';
import { QueryNotice } from '../QueryNotice';

let mockIdentity: IdentityState;
const mockRecords = { getHistory: jest.fn(), getSubjectDetails: jest.fn() };
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => mockIdentity,
  useAppServices: () => ({ academicRecords: mockRecords }),
}));
jest.mock('@molecules/SmallDummyMessage', () => 'SmallDummyMessage');

const account = (scope: string) => ({
  scope,
  name: 'Estudante',
  matricula: '123',
  period: '2026/1',
});
let result: ReturnType<typeof useHistory>;
function HistoryProbe() {
  result = useHistory();
  return (
    <>
      {JSON.stringify({
        data: result.data,
        error: result.error?.message,
        paused: result.isPaused,
      })}
    </>
  );
}
function DetailsProbe({ subjectId }: { subjectId: string }) {
  useSubjectDetails(subjectId);
  return null;
}

let client: QueryClient;
let renderer: ReactTestRenderer | undefined;
const render = async (child: React.ReactElement = <HistoryProbe />) => {
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>{child}</QueryClientProvider>,
    );
  });
  await settle();
};
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
  });

beforeEach(() => {
  onlineManager.setOnline(true);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
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
afterEach(async () => {
  if (renderer) await act(async () => renderer!.unmount());
  renderer = undefined;
  client.clear();
  onlineManager.setOnline(true);
});

it('does not request academic data without an authenticated account', async () => {
  mockIdentity = { status: 'signedOut', account: null, error: null };
  await render();
  expect(mockRecords.getHistory).not.toHaveBeenCalled();
});

it('uses one account and period cache across mounts and silent session refresh', async () => {
  await render();
  mockIdentity = { ...mockIdentity, status: 'refreshing' };
  await act(async () => {
    renderer!.update(
      <QueryClientProvider client={client}>
        <HistoryProbe />
      </QueryClientProvider>,
    );
  });
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
  await render();
  mockIdentity = { ...mockIdentity, account: account('account-b') };
  await act(async () => {
    renderer!.update(
      <QueryClientProvider client={client}>
        <HistoryProbe />
      </QueryClientProvider>,
    );
  });
  await settle();
  expect(requestSignal?.aborted).toBe(true);
  resolveLate([{ id: 'private-a' }] as Awaited<
    ReturnType<AcademicRecordsPort['getHistory']>
  >);
  await settle();
  expect(result.data).toEqual([]);
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
  await render();
  mockRecords.getHistory.mockRejectedValueOnce(
    new AppError('PORTAL_LAYOUT_CHANGED'),
  );
  await act(async () => {
    await result.refetch();
  });
  await settle();
  expect(result.data).toEqual(saved);
  expect(result.error).toMatchObject({ code: 'PORTAL_LAYOUT_CHANGED' });
  expect(mockRecords.getHistory).toHaveBeenCalledTimes(2);
});

it('uses the same subject cache for a full code and its numeric suffix', async () => {
  await render(<DetailsProbe subjectId="IME02-01388" />);
  await act(async () => {
    renderer!.update(
      <QueryClientProvider client={client}>
        <DetailsProbe subjectId="1388" />
      </QueryClientProvider>,
    );
  });
  await settle();
  expect(mockRecords.getSubjectDetails).toHaveBeenCalledTimes(1);
  expect(mockRecords.getSubjectDetails).toHaveBeenCalledWith(
    '1388',
    expect.objectContaining({ signal: expect.any(Object) }),
  );
});

it('shows cached offline status and resumes a paused query on reconnect', async () => {
  onlineManager.setOnline(false);
  await render();
  expect(result.isPaused).toBe(true);
  expect(mockRecords.getHistory).not.toHaveBeenCalled();
  await act(async () => {
    onlineManager.setOnline(true);
  });
  await settle();
  expect(mockRecords.getHistory).toHaveBeenCalledTimes(1);
  expect(result.isPaused).toBe(false);
});

it('announces cached offline and background errors without hiding the data', async () => {
  await act(async () => {
    renderer = create(
      <QueryNotice
        isPaused
        isFetching={false}
        hasData
        error={null}
        retry={() => undefined}
      />,
    );
  });
  expect(
    renderer!.root.findByType('SmallDummyMessage' as React.ElementType).props
      .text,
  ).toContain('últimos dados salvos');
  await act(async () => {
    renderer!.update(
      <QueryNotice
        isPaused={false}
        isFetching={false}
        hasData
        error={new AppError('NETWORK')}
        retry={() => undefined}
      />,
    );
  });
  expect(
    renderer!.root.findByType('SmallDummyMessage' as React.ElementType).props
      .text,
  ).toContain('Não foi possível atualizar');
});
it('announces offline mode even when a fresh cached query has no paused request', async () => {
  onlineManager.setOnline(false);
  await act(async () => {
    renderer = create(
      <QueryNotice
        isPaused={false}
        isFetching={false}
        hasData
        dataUpdatedAt={1700000000000}
        error={null}
        retry={() => undefined}
      />,
    );
  });
  const text = renderer!.root.findByType(
    'SmallDummyMessage' as React.ElementType,
  ).props.text;
  expect(text).toContain('Sem conexão');
  expect(text).toContain('Última atualização:');
});
