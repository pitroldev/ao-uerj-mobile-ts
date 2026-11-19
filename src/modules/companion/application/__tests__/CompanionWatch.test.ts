import { AppError } from '@root/shared/errors/AppError';
import type { CallKind, CompanionCall } from '../../domain/companion';
import { COMPANION_WATCH_KEY, CompanionWatch } from '../CompanionWatch';
import type { CompanionWatchServerPort } from '../ports';

const MINUTE = 60_000;
// segunda, 23 de novembro de 2026, 12:05
const NOW = new Date(2026, 10, 23, 12, 5).getTime();
const at = (h: number, m: number) => new Date(2026, 10, 23, h, m).getTime();

/** O texto do aviso vem da apresentação; aqui basta saber de qual chamada. */
const message = (opened: CompanionCall, count: number) => ({
  id: 'companion:watch',
  channel: 'companion' as const,
  title: `${count} nova(s)`,
  body: `${opened.id} · ${opened.host}`,
  publicTitle: 'Companhia agora',
  publicBody: 'Uma chamada abriu na sua janela livre.',
  target: 'companion' as const,
});

const call = (extra: Partial<CompanionCall>): CompanionCall => ({
  id: 'a',
  kind: 'lunch',
  at: at(12, 30),
  spot: 'ru',
  destination: null,
  note: '',
  host: 'Júlia',
  going: 1,
  capacity: 6,
  listedUntil: at(13, 0),
  expiresAt: at(13, 0),
  ...extra,
});

/** O servidor do "Me avise" por push (iPhone), com um pedido por aluno. */
function createPushServer({ available = true } = {}) {
  let stored: { kind: CallKind; until: number } | null = null;
  const server = {
    status: jest.fn(async () => ({ available, watch: stored })),
    put: jest.fn(
      async (request: {
        kind: CallKind;
        until: number;
        seen: readonly string[];
        token: string;
      }) => {
        if (!available) throw new AppError('SERVICE_UNAVAILABLE');
        stored = { kind: request.kind, until: request.until };
        return stored;
      },
    ),
    remove: jest.fn(async () => {
      stored = null;
    }),
  };
  return {
    server: server satisfies CompanionWatchServerPort,
    /** O servidor mandou o push: o pedido sumiu de lá. */
    pushed: () => {
      stored = null;
    },
  };
}

function setup({
  permission = 'granted',
  scope = 'conta',
  push = null,
}: {
  permission?: 'granted' | 'denied' | 'blocked';
  scope?: string | null;
  push?: {
    token: () => Promise<string | null>;
    server: CompanionWatchServerPort;
  } | null;
} = {}) {
  let now = NOW;
  const saved = new Map<string, unknown>();
  const device = {
    requestPermission: jest.fn(
      async (): Promise<'granted' | 'denied' | 'blocked'> => permission,
    ),
    notify: jest.fn(async () => undefined),
    setCompanionWatch: jest.fn(async (_on: boolean) => undefined),
  };
  const list = jest.fn(async (): Promise<{ calls: CompanionCall[] }> => ({
    calls: [],
  }));
  let disabled = false;
  const watch = new CompanionWatch({
    device,
    push,
    store: {
      read: async <T>(owner: string, key: string) =>
        (saved.get(`${owner}:${key}`) as T) ?? null,
      write: async (owner: string, key: string, value: unknown) => {
        saved.set(`${owner}:${key}`, value);
      },
    },
    account: () => (scope ? { scope } : null),
    savedScope: async () => scope,
    disabled: () => disabled,
    list,
    memberships: async () => [{ callId: 'minha' }],
    message,
    now: () => now,
  });
  return {
    watch,
    device,
    list,
    saved,
    advance: (ms: number) => {
      now += ms;
    },
    disable: () => {
      disabled = true;
    },
  };
}

it('asks for the permission, keeps the request and starts the task', async () => {
  const { watch, device, saved } = setup();
  expect(await watch.request('lunch', at(13, 40), ['vista'])).toBe('requested');
  expect(device.setCompanionWatch).toHaveBeenLastCalledWith(true);
  expect(saved.get(`conta:${COMPANION_WATCH_KEY}`)).toEqual({
    kind: 'lunch',
    until: at(13, 40),
    seen: ['vista'],
  });
  expect(watch.getSnapshot()).toEqual({
    scope: 'conta',
    request: { kind: 'lunch', until: at(13, 40) },
    available: true,
  });
});

it('does not ask without the notifications permission', async () => {
  const { watch, device } = setup({ permission: 'denied' });
  expect(await watch.request('lunch', at(13, 40), [])).toBe('denied');
  expect(device.setCompanionWatch).not.toHaveBeenCalled();
});

it('in the background, notifies once about a new call of the kind, in the window, with room', async () => {
  const { watch, device, list } = setup();
  await watch.request('lunch', at(13, 40), ['vista']);
  // nada novo: espera a próxima rodada
  list.mockResolvedValueOnce({
    calls: [
      call({ id: 'vista' }),
      call({ id: 'minha' }),
      call({ id: 'cheia', going: 6 }),
      call({ id: 'tarde', at: at(14, 0) }),
      call({ id: 'volta', kind: 'home', destination: 'metro', spot: 'concha' }),
    ],
  });
  expect(await watch.checkInBackground()).toBe('waiting');
  expect(device.notify).not.toHaveBeenCalled();

  list.mockResolvedValueOnce({
    calls: [call({ id: 'nova', at: at(12, 45), host: 'Lucas', going: 2 })],
  });
  expect(await watch.checkInBackground()).toBe('notified');
  expect(device.notify).toHaveBeenCalledWith(
    expect.objectContaining({ title: '1 nova(s)', body: 'nova · Lucas' }),
  );
  // avisou: o pedido acaba e a tarefa para
  expect(device.setCompanionWatch).toHaveBeenLastCalledWith(false);
  expect(watch.getSnapshot().request).toBeNull();
  expect(await watch.checkInBackground()).toBe('stopped');
});

it('stops when the window ended, the Companhia is off or there is no account', async () => {
  const ended = setup();
  await ended.watch.request('lunch', at(12, 30), []);
  ended.advance(30 * MINUTE);
  expect(await ended.watch.checkInBackground()).toBe('stopped');
  expect(ended.list).not.toHaveBeenCalled();

  const off = setup();
  await off.watch.request('lunch', at(13, 40), []);
  off.disable();
  expect(await off.watch.checkInBackground()).toBe('stopped');

  const signedOut = setup({ scope: null });
  expect(await signedOut.watch.checkInBackground()).toBe('stopped');
  expect(signedOut.device.setCompanionWatch).toHaveBeenCalledWith(false);
});

it('waits when the list fails, and ends when the screen already shows a call', async () => {
  const { watch, list } = setup();
  await watch.request('home', at(22, 50), []);
  list.mockRejectedValueOnce(new Error('sem rede'));
  expect(await watch.checkInBackground()).toBe('waiting');
  await watch.satisfied();
  expect(watch.getSnapshot().request).toBeNull();
});

describe('on the iPhone (push from the server)', () => {
  const TOKEN = 'ab'.repeat(32);

  it('is available only after the server says it sends push', async () => {
    const { server } = createPushServer();
    const { watch } = setup({ push: { token: async () => TOKEN, server } });
    expect(watch.getSnapshot().available).toBe(false);
    await watch.load();
    expect(watch.getSnapshot().available).toBe(true);

    const off = createPushServer({ available: false });
    const without = setup({
      push: { token: async () => TOKEN, server: off.server },
    });
    await without.watch.load();
    expect(without.watch.getSnapshot().available).toBe(false);
  });

  it('sends the request with the push token and keeps a copy for the screen, without the task', async () => {
    const { server } = createPushServer();
    const { watch, device, saved } = setup({
      push: { token: async () => TOKEN, server },
    });
    expect(await watch.request('lunch', at(13, 40), ['vista'])).toBe(
      'requested',
    );
    expect(server.put).toHaveBeenCalledWith({
      kind: 'lunch',
      until: at(13, 40),
      seen: ['vista'],
      token: TOKEN,
    });
    expect(device.setCompanionWatch).not.toHaveBeenCalled();
    expect(saved.get(`conta:${COMPANION_WATCH_KEY}`)).toEqual({
      kind: 'lunch',
      until: at(13, 40),
      seen: ['vista'],
    });
    expect(watch.getSnapshot().request).toEqual({
      kind: 'lunch',
      until: at(13, 40),
    });
  });

  it('does not keep the request without the token or the server', async () => {
    const { server } = createPushServer();
    const noToken = setup({ push: { token: async () => null, server } });
    expect(await noToken.watch.request('lunch', at(13, 40), [])).toBe('failed');
    expect(server.put).not.toHaveBeenCalled();
    expect(noToken.watch.getSnapshot().request).toBeNull();

    const down = createPushServer({ available: false });
    const failing = setup({
      push: { token: async () => TOKEN, server: down.server },
    });
    expect(await failing.watch.request('lunch', at(13, 40), [])).toBe('failed');
    expect(failing.saved.size).toBe(0);

    const denied = setup({
      permission: 'denied',
      push: { token: async () => TOKEN, server },
    });
    expect(await denied.watch.request('lunch', at(13, 40), [])).toBe('denied');
  });

  it('forgets the copy once the server already sent the push', async () => {
    const { server, pushed } = createPushServer();
    const { watch } = setup({ push: { token: async () => TOKEN, server } });
    await watch.request('home', at(22, 0), []);
    await watch.load();
    expect(watch.getSnapshot().request).not.toBeNull();

    pushed();
    await watch.load();
    expect(watch.getSnapshot().request).toBeNull();
    // o servidor já apagou: nada a cancelar lá
    expect(server.remove).not.toHaveBeenCalled();
  });

  it('a late answer from the server does not undo a newer request', async () => {
    const { server } = createPushServer();
    const { watch } = setup({ push: { token: async () => TOKEN, server } });
    let answer!: (value: { available: boolean; watch: null }) => void;
    server.status.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    const loading = watch.load();
    await watch.request('lunch', at(13, 40), []);
    // a leitura saiu antes do pedido: o "sem pedido" dela é velho
    answer({ available: true, watch: null });
    await loading;
    expect(watch.getSnapshot().request).toEqual({
      kind: 'lunch',
      until: at(13, 40),
    });
  });

  it('cancels on the server, also when the screen shows a call and on sign out', async () => {
    const { server } = createPushServer();
    const { watch } = setup({ push: { token: async () => TOKEN, server } });
    await watch.request('lunch', at(13, 40), []);
    await watch.cancel();
    expect(server.remove).toHaveBeenCalledTimes(1);
    expect(watch.getSnapshot().request).toBeNull();

    await watch.request('lunch', at(13, 40), []);
    await watch.satisfied();
    expect(server.remove).toHaveBeenCalledTimes(2);

    await watch.signOut();
    expect(server.remove).toHaveBeenCalledTimes(3);

    // sem rede, o pedido do aparelho acaba mesmo assim
    server.remove.mockRejectedValueOnce(new AppError('NETWORK'));
    await watch.request('lunch', at(13, 40), []);
    await watch.cancel();
    expect(watch.getSnapshot().request).toBeNull();
  });
});
