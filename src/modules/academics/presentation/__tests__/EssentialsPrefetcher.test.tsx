import React from 'react';
import { AppState } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PortalMonitor } from '@root/modules/connectivity/application/PortalMonitor';
import { PortalStatusProvider } from '@root/modules/connectivity/presentation/PortalStatusContext';
import { createTestQueryClient } from '@root/test-utils/render';
import { academicKeys } from '../queryKeys';
import { EssentialsPrefetcher } from '../EssentialsPrefetcher';

const ACCOUNT = {
  scope: 'account-a',
  name: 'Estudante',
  matricula: '1',
  period: '2026.2',
};
const mockState = {
  status: 'signedIn' as const,
  account: ACCOUNT,
  error: null,
};
const mockReads: string[] = [];
const read = (name: string) =>
  jest.fn(async () => {
    mockReads.push(name);
    return [name];
  });
const mockRecords = {
  getGrades: read('grades'),
  getHistory: read('history'),
  getCurriculum: read('curriculum'),
  getSchedule: read('schedule'),
  getPartialRid: read('partial-rid'),
  getSynthesis: read('synthesis'),
};
let mockClient: QueryClient;
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => mockState,
  useAppServices: () => ({
    academicRecords: mockRecords,
    queryClient: mockClient,
    identity: {
      settled: () => Promise.resolve(),
      getSnapshot: () => mockState,
    },
  }),
}));

const settle = () =>
  act(async () => {
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
  });

beforeEach(() => {
  mockReads.length = 0;
  mockClient = createTestQueryClient();
  onlineManager.setOnline(true);
  // o app na tela
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
  });
});

it('reads what the app needs offline, one page at a time, but not grades or RID', async () => {
  await render(<EssentialsPrefetcher />);
  await settle();
  expect(mockReads).toEqual(['schedule', 'history', 'curriculum', 'synthesis']);
  expect(
    mockClient.getQueryData(
      academicKeys.resource(ACCOUNT.scope, ACCOUNT.period, 'history'),
    ),
  ).toEqual(['history']);
});

it('skips what is still fresh', async () => {
  mockClient.setQueryData(
    academicKeys.resource(ACCOUNT.scope, ACCOUNT.period, 'schedule'),
    ['saved'],
  );
  await render(<EssentialsPrefetcher />);
  await settle();
  expect(mockReads).toEqual(['history', 'curriculum', 'synthesis']);
});

it('waits for the internet and for the portal', async () => {
  onlineManager.setOnline(false);
  const offline = await render(<EssentialsPrefetcher />);
  await settle();
  expect(mockReads).toEqual([]);
  await offline.unmount();

  onlineManager.setOnline(true);
  const monitor = new PortalMonitor({
    now: Date.now,
    online: () => true,
    active: () => false,
    probe: async () => 503,
    setTimer: () => null,
    clearTimer: () => undefined,
  });
  monitor.failed('unavailable');
  await render(
    <PortalStatusProvider
      monitor={monitor}
      identity={{
        subscribe: () => () => undefined,
        getSnapshot: () => mockState,
      }}
      alert={null}
    >
      <EssentialsPrefetcher />
    </PortalStatusProvider>,
  );
  await settle();
  expect(mockReads).toEqual([]);
});
