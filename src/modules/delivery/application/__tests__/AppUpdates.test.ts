import { FLEXIBLE_PROMPT_INTERVAL } from '../../domain/updatePolicy';
import { AppUpdates, FLEXIBLE_PROMPT_KEY } from '../AppUpdates';
import type { UpdateFlowResult } from '../ports';
import {
  appUpdate,
  createMemoryStore,
  createStoreListing,
  createUpdatesPort,
  type FakeUpdatesPort,
  type MemoryStore,
} from './fakes';

let now: number;
const create = (
  port: FakeUpdatesPort | null,
  store: MemoryStore,
  storeListing: ReturnType<typeof createStoreListing>,
) => new AppUpdates({ updates: port, storeListing, store, now: () => now });

const setup = ({
  port = createUpdatesPort(),
  store = createMemoryStore(),
  storeListing = createStoreListing(),
}: {
  port?: FakeUpdatesPort;
  store?: MemoryStore;
  storeListing?: ReturnType<typeof createStoreListing>;
} = {}) => ({
  port,
  store,
  storeListing,
  updates: create(port, store, storeListing),
});

/** Sem atualização pela loja dentro do app (iOS). */
const setupWithoutPort = (storeListing = createStoreListing()) => ({
  storeListing,
  updates: create(null, createMemoryStore(), storeListing),
});

/** A resposta da loja a um fluxo chega fora da fila dos checks. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** Fluxo que a Play nunca responde (tela da loja fechada sem resultado). */
const unanswered = () => new Promise<UpdateFlowResult>(() => {});

beforeEach(() => {
  now = Date.parse('2026-10-12T12:00:00Z');
});

it('does nothing where there are no in-app updates (iOS)', async () => {
  const { updates } = setupWithoutPort();
  await updates.check({ required: true });
  expect(updates.getSnapshot().phase).toBe('idle');
  expect(updates.listen()).toEqual(expect.any(Function));
  expect(updates.canUpdate).toBe(true);
  expect(setupWithoutPort(createStoreListing(false)).updates.canUpdate).toBe(
    false,
  );
});

it('stays quiet when the store cannot be asked (debug, emulator, sideload)', async () => {
  const port = createUpdatesPort(null);
  const { updates } = setup({ port });
  await updates.check({ required: true });
  port.check.mockRejectedValueOnce(new Error('ERROR_APP_NOT_OWNED'));
  await updates.check({ required: false });
  expect(port.start).not.toHaveBeenCalled();
  expect(updates.getSnapshot()).toEqual({
    phase: 'idle',
    progress: null,
    storeUpToDate: false,
  });
});

it('asks for the immediate update once per session when the version is unsupported', async () => {
  const { port, updates } = setup();
  await updates.check({ required: true });
  await updates.check({ required: true });
  expect(port.start).toHaveBeenCalledTimes(1);
  expect(port.start).toHaveBeenCalledWith('immediate');
});

it('resumes an interrupted immediate update on every return to the app', async () => {
  const { port, updates } = setup();
  // reabrir pelo ícone fecha a tela da loja, e a Play pode nunca responder
  port.start.mockReturnValueOnce(unanswered());
  await updates.check({ required: true });
  port.check.mockResolvedValue(appUpdate({ availability: 'inProgress' }));
  await updates.check({ required: true });
  await updates.check({ required: true });
  expect(port.start).toHaveBeenCalledTimes(3);
  expect(port.start).toHaveBeenNthCalledWith(3, 'immediate');
});

it('records whether the store has anything newer for this device', async () => {
  const port = createUpdatesPort(appUpdate({ availability: 'none' }));
  const { updates } = setup({ port });
  await updates.check({ required: true });
  expect(port.start).not.toHaveBeenCalled();
  expect(updates.getSnapshot().storeUpToDate).toBe(true);
  // sem resposta da loja, vale a última
  port.check.mockRejectedValueOnce(new Error('offline'));
  await updates.check({ required: true });
  expect(updates.getSnapshot().storeUpToDate).toBe(true);
  port.check.mockResolvedValueOnce(appUpdate());
  await updates.check({ required: true });
  expect(updates.getSnapshot().storeUpToDate).toBe(false);
});

it('asks for the flexible update at most every two days and tracks the download', async () => {
  const { port, store, updates } = setup();
  await updates.check({ required: false });
  await flush();
  expect(port.start).toHaveBeenCalledWith('flexible');
  expect(store.data.get(FLEXIBLE_PROMPT_KEY)).toBe(now);
  expect(updates.getSnapshot()).toEqual({
    phase: 'downloading',
    progress: null,
    storeUpToDate: false,
  });

  // nova sessão, dentro do intervalo: não pergunta de novo
  const next = setup({ store });
  now += FLEXIBLE_PROMPT_INTERVAL - 1;
  await next.updates.check({ required: false });
  expect(next.port.start).not.toHaveBeenCalled();

  const later = setup({ store });
  now += 1;
  await later.updates.check({ required: false });
  expect(later.port.start).toHaveBeenCalledWith('flexible');
});

it('runs a required check after a flexible prompt the store never answers', async () => {
  // o pedido seguinte não some nem fica preso atrás da flexível
  const { port, updates } = setup();
  port.start.mockReturnValueOnce(unanswered());
  await Promise.all([
    updates.check({ required: false }),
    updates.check({ required: true }),
  ]);
  expect(port.start).toHaveBeenNthCalledWith(1, 'flexible');
  expect(port.start).toHaveBeenNthCalledWith(2, 'immediate');
});

it('does not track a download the student declined', async () => {
  const { port, updates } = setup();
  port.start.mockResolvedValueOnce('canceled');
  await updates.check({ required: false });
  await flush();
  expect(updates.getSnapshot().phase).toBe('idle');
});

it('waits for a fresh update before asking for the flexible one', async () => {
  const port = createUpdatesPort(appUpdate({ stalenessDays: 1 }));
  const { updates } = setup({ port });
  await updates.check({ required: false });
  expect(port.start).not.toHaveBeenCalled();
});

it('follows the download progress and finds a download finished in the background', async () => {
  const { port, updates } = setup();
  const stop = updates.listen();
  const listener = jest.fn();
  updates.subscribe(listener);
  port.emit({ status: 'downloading', bytesDownloaded: 25, totalBytes: 100 });
  expect(updates.getSnapshot()).toMatchObject({
    phase: 'downloading',
    progress: 0.25,
  });
  port.emit({ status: 'downloaded', bytesDownloaded: 100, totalBytes: 100 });
  expect(updates.getSnapshot()).toMatchObject({
    phase: 'downloaded',
    progress: 1,
  });
  port.emit({ status: 'installing', bytesDownloaded: 100, totalBytes: 100 });
  expect(updates.getSnapshot().phase).toBe('downloaded');
  port.emit({ status: 'failed', bytesDownloaded: 0, totalBytes: 0 });
  expect(updates.getSnapshot().phase).toBe('idle');
  expect(listener).toHaveBeenCalledTimes(3);
  stop();
  expect(port.listening).toBe(false);

  const resumed = setup({
    port: createUpdatesPort(appUpdate({ installStatus: 'downloaded' })),
  });
  await resumed.updates.check({ required: true });
  expect(resumed.updates.getSnapshot().phase).toBe('downloaded');
  expect(resumed.port.start).not.toHaveBeenCalled();
});

it('restarts to install the downloaded update', async () => {
  const { port, updates } = setup();
  await expect(updates.restart()).resolves.toBe(true);
  expect(port.complete).toHaveBeenCalled();
});

it('reports a failed restart and keeps the banner only while the download is there', async () => {
  const { port, updates } = setup();
  updates.listen();
  port.emit({ status: 'downloaded', bytesDownloaded: 1, totalBytes: 1 });
  port.complete.mockRejectedValue(new Error('ERROR_INSTALL_NOT_ALLOWED'));

  port.check.mockResolvedValueOnce(appUpdate({ installStatus: 'downloaded' }));
  await expect(updates.restart()).resolves.toBe(false);
  expect(updates.getSnapshot().phase).toBe('downloaded');

  // o download sumiu: o aviso "Reiniciar" sai do Início
  await expect(updates.restart()).resolves.toBe(false);
  expect(updates.getSnapshot().phase).toBe('idle');

  await expect(setupWithoutPort().updates.restart()).resolves.toBe(false);
});

describe('updateNow (unsupported version screen)', () => {
  it('counts as the immediate request of the session', async () => {
    const { port, updates } = setup();
    // a tela da loja continua aberta quando a busca do aviso termina
    port.start.mockReturnValueOnce(unanswered());
    void updates.updateNow();
    await updates.check({ required: true });
    expect(port.start).toHaveBeenCalledTimes(1);
  });

  it('is not held by a flexible prompt the store never answered', async () => {
    const { port, updates } = setup();
    port.start.mockReturnValueOnce(unanswered());
    await updates.check({ required: false });
    port.start.mockResolvedValueOnce('accepted');
    await updates.updateNow();
    expect(port.start).toHaveBeenLastCalledWith('immediate');
  });

  it('does not open a second flow when a check already in line opens one', async () => {
    const { port, storeListing, updates } = setup({
      port: createUpdatesPort(appUpdate({ availability: 'inProgress' })),
    });
    const checking = updates.check({ required: true });
    await Promise.all([checking, updates.updateNow()]);
    expect(port.start).toHaveBeenCalledTimes(1);
    expect(storeListing.open).not.toHaveBeenCalled();
  });

  it('opens the immediate update again after the student canceled it', async () => {
    const { port, updates } = setup();
    port.start.mockResolvedValueOnce('canceled');
    await updates.updateNow();
    await updates.updateNow();
    expect(port.start).toHaveBeenCalledTimes(2);
  });

  it('installs an update already downloaded', async () => {
    const port = createUpdatesPort(appUpdate({ installStatus: 'downloaded' }));
    const { storeListing, updates } = setup({ port });
    await updates.updateNow();
    expect(port.complete).toHaveBeenCalled();
    expect(storeListing.open).not.toHaveBeenCalled();
  });

  it.each(['accepted', 'canceled'] as const)(
    'opens the immediate update and stays when the result is %s',
    async result => {
      const { port, storeListing, updates } = setup();
      port.start.mockResolvedValueOnce(result);
      await updates.updateNow();
      expect(port.start).toHaveBeenCalledWith('immediate');
      expect(storeListing.open).not.toHaveBeenCalled();
    },
  );

  it('falls back to the store page when the immediate flow fails or is not offered', async () => {
    const failing = setup();
    failing.port.start.mockRejectedValueOnce(new Error('E_UPDATE_FAILED'));
    await failing.updates.updateNow();
    expect(failing.storeListing.open).toHaveBeenCalled();

    const outside = setup({ port: createUpdatesPort(null) });
    await outside.updates.updateNow();
    expect(outside.port.start).not.toHaveBeenCalled();
    expect(outside.storeListing.open).toHaveBeenCalled();

    const ios = setupWithoutPort(createStoreListing(false));
    await ios.updates.updateNow();
    expect(ios.storeListing.open).not.toHaveBeenCalled();
  });
});
