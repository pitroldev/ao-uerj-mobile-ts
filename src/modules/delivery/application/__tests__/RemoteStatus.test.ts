import { AppError } from '@root/shared/errors/AppError';
import {
  APP_STATUS_KEY,
  DISMISSED_NOTICES_KEY,
  REFRESH_INTERVAL,
  RemoteStatus,
} from '../RemoteStatus';
import { createMemoryStore, createSource } from './fakes';

const notice = (id: string) => ({
  id,
  level: 'info',
  title: 'Aviso',
  message: 'Mensagem do aviso.',
});
const doc = (minSupportedVersion: string, ids: string[] = []) => ({
  schemaVersion: 1,
  minSupportedVersion,
  notices: ids.map(notice),
  disabledFeatures: [],
});

let now: number;
const clock = () => now;
beforeEach(() => {
  now = Date.parse('2026-10-12T12:00:00Z');
});

it('shows the saved copy first and replaces it with the fetched one, saving it', async () => {
  const store = createMemoryStore({ [APP_STATUS_KEY]: doc('1.0.0') });
  let release!: (value: unknown) => void;
  const source = {
    fetch: jest.fn(
      () =>
        new Promise<unknown>(resolve => {
          release = resolve;
        }),
    ),
  };
  const remote = new RemoteStatus({ source, store, now: clock });
  const started = remote.start();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  expect(remote.getSnapshot().status?.minSupportedVersion).toBe('1.0.0');
  release(doc('1.2.0'));
  await started;
  expect(remote.getSnapshot().status?.minSupportedVersion).toBe('1.2.0');
  expect(store.data.get(APP_STATUS_KEY)).toEqual(doc('1.2.0'));
});

it.each([
  ['a network failure', new AppError('NETWORK')],
  ['a response that is not an object', 'texto'],
  ['an unknown schema', { ...doc('9.9.9'), schemaVersion: 2 }],
  ['a malformed document', { notices: 'x' }],
])('keeps the last good copy after %s', async (_label, response) => {
  const store = createMemoryStore({ [APP_STATUS_KEY]: doc('1.0.0') });
  const remote = new RemoteStatus({
    source: createSource(response),
    store,
    now: clock,
  });
  await remote.start();
  expect(remote.getSnapshot().status?.minSupportedVersion).toBe('1.0.0');
  expect(store.write).not.toHaveBeenCalled();
});

it('ignores a corrupted saved copy', async () => {
  const store = createMemoryStore({ [APP_STATUS_KEY]: 'lixo' });
  const remote = new RemoteStatus({
    source: createSource(new AppError('NETWORK')),
    store,
    now: clock,
  });
  await remote.start();
  expect(remote.getSnapshot().status).toBeNull();
});

it('limits how often it fetches again and shares a fetch in flight', async () => {
  const source = createSource(doc('1.0.0'));
  const remote = new RemoteStatus({
    source,
    store: createMemoryStore(),
    now: clock,
  });
  await remote.start();
  await remote.start();
  await remote.refresh();
  expect(source.fetch).toHaveBeenCalledTimes(1);
  now += REFRESH_INTERVAL - 1;
  await remote.refresh();
  expect(source.fetch).toHaveBeenCalledTimes(1);
  now += 1;
  await Promise.all([remote.refresh(), remote.refresh()]);
  expect(source.fetch).toHaveBeenCalledTimes(2);
});

it('notifies subscribers on every new snapshot', async () => {
  const remote = new RemoteStatus({
    source: createSource(doc('1.0.0', ['a'])),
    store: createMemoryStore(),
    now: clock,
  });
  const listener = jest.fn();
  const unsubscribe = remote.subscribe(listener);
  await remote.start();
  expect(listener).toHaveBeenCalled();
  unsubscribe();
  listener.mockClear();
  await remote.dismiss('a');
  expect(listener).not.toHaveBeenCalled();
});

it('remembers dismissed notices, keeping only ids still in the document', async () => {
  const store = createMemoryStore({
    [DISMISSED_NOTICES_KEY]: ['antigo', 'b', 42],
  });
  const remote = new RemoteStatus({
    source: createSource(doc('1.0.0', ['a', 'b'])),
    store,
    now: clock,
  });
  await remote.start();
  expect([...remote.getSnapshot().dismissed]).toEqual(['antigo', 'b']);
  await remote.dismiss('a');
  expect(remote.getSnapshot().dismissed.has('a')).toBe(true);
  expect(store.data.get(DISMISSED_NOTICES_KEY)).toEqual(['b', 'a']);
  store.write.mockClear();
  await remote.dismiss('a');
  expect(store.write).not.toHaveBeenCalled();
});

it('survives a failing storage', async () => {
  const store = createMemoryStore();
  store.read = jest.fn(async () => {
    throw new AppError('STORAGE_FAILED');
  });
  store.write = jest.fn(async () => {
    throw new AppError('STORAGE_FAILED');
  });
  const remote = new RemoteStatus({
    source: createSource(doc('1.1.0', ['a'])),
    store,
    now: clock,
  });
  await expect(remote.start()).resolves.toBeUndefined();
  expect(remote.getSnapshot().status?.minSupportedVersion).toBe('1.1.0');
  await expect(remote.dismiss('a')).resolves.toBeUndefined();
});
