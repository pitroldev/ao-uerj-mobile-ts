import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';

import { createTestQueryClient, createWrapper } from '@root/test-utils/render';
import { useScheduleSharing } from '@root/modules/academics/presentation/useScheduleSharing';
import { useGenerateSchedules } from '@root/modules/planning/presentation/useGenerateSchedules';
import {
  form,
  generated,
} from '@root/modules/planning/application/testFixtures';
import { AppUpdates } from '../../application/AppUpdates';
import { RemoteStatus } from '../../application/RemoteStatus';
import {
  createMemoryStore,
  createSource,
  createStoreListing,
} from '../../application/__tests__/fakes';
import { DeliveryProvider, type Delivery } from '../DeliveryProvider';

const mockShare = jest.fn();
const mockGenerate = jest.fn();
jest.mock('@root/app/providers/AppServicesProvider', () => ({
  useIdentity: () => ({ account: { scope: 'account-a' } }),
  useAppServices: () => ({
    scheduleSharing: { capturePng: jest.fn(), share: mockShare },
    scheduleGenerator: { generate: mockGenerate },
    identity: { getSnapshot: () => ({ account: { scope: 'account-a' } }) },
  }),
}));
jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml' }));

const notePositiveMoment = jest.fn(async () => false);
let client: QueryClient;

function wrapper() {
  const store = createMemoryStore();
  const now = () => 0;
  const delivery: Delivery = {
    appVersion: '1.3.5',
    status: new RemoteStatus({
      source: createSource(new Error('offline')),
      store,
      now,
    }),
    updates: new AppUpdates({
      updates: null,
      storeListing: createStoreListing(false),
      store,
      now,
    }),
    review: { notePositiveMoment },
  };
  return createWrapper({
    queryClient: client,
    wrapper: ({ children }) => (
      <DeliveryProvider delivery={delivery} ready={false}>
        {children}
      </DeliveryProvider>
    ),
  });
}

beforeEach(() => {
  client = createTestQueryClient();
});
afterEach(() => {
  client.clear();
});

it('counts a shared schedule as a positive moment, but not a cancelled share', async () => {
  const { result } = await renderHook(() => useScheduleSharing(), {
    wrapper: wrapper(),
  });
  mockShare.mockResolvedValueOnce(false);
  await act(() => result.current.share('data:image/svg+xml;base64,PHN2Zy8+'));
  expect(notePositiveMoment).not.toHaveBeenCalled();
  mockShare.mockResolvedValueOnce(true);
  await act(() => result.current.share('data:image/svg+xml;base64,PHN2Zy8+'));
  expect(notePositiveMoment).toHaveBeenCalledTimes(1);
});

it('counts generated schedules as a positive moment, but not an empty result', async () => {
  const { result } = await renderHook(() => useGenerateSchedules(), {
    wrapper: wrapper(),
  });
  mockGenerate.mockResolvedValueOnce([]);
  await act(() => result.current.mutateAsync(form));
  expect(notePositiveMoment).not.toHaveBeenCalled();
  mockGenerate.mockResolvedValueOnce([generated]);
  await act(() => result.current.mutateAsync(form));
  await waitFor(() => expect(notePositiveMoment).toHaveBeenCalledTimes(1));
});
