import type { CampusNotice, NoticeList } from '../../domain/campusNow';
import type { RoomClass } from '../../domain/nearby';
import type { CampusNotification } from '../ports';
import { CAMPUS_STATE_KEY, dayKey, type CampusState } from '../campusState';
import { CampusWatch, MAX_ASKS_PER_DAY } from '../CampusWatch';

/** Segunda, 23/11/2026, às 14:00: a aula das 14:20 é no 6º andar do B. */
const NOW = new Date(2026, 10, 23, 14, 0).getTime();
const CLASSES: RoomClass[] = [
  { weekday: 1, start: 860, end: 960, room: '6019', block: 'B', floor: '6' },
];

function notice(partial: Partial<CampusNotice> = {}): CampusNotice {
  return {
    id: 'lift',
    kind: 'elevators',
    status: 'long_queue',
    place: { type: 'elevators' },
    createdAt: NOW - 20 * 60_000,
    expiresAt: NOW + 40 * 60_000,
    state: 'active',
    confirmations: 7,
    ends: 0,
    confirmed: true,
    level: null,
    mine: false,
    answer: null,
    thanked: false,
    flagged: false,
    views: null,
    thanks: null,
    ...partial,
  };
}

function setup({
  state,
  list = { notices: [notice()], helpersToday: 10, you: standing(2) },
  scope = 'conta',
  allowed = true,
  disabled = false,
  now = NOW,
}: {
  state?: Partial<CampusState>;
  list?: NoticeList | Error;
  scope?: string | null;
  allowed?: boolean;
  disabled?: boolean;
  now?: number;
} = {}) {
  const saved = new Map<string, unknown>();
  if (state)
    saved.set(`conta/${CAMPUS_STATE_KEY}`, {
      day: dayKey(now),
      visited: true,
      classes: CLASSES,
      skipped: [],
      asked: [],
      own: [],
      level: 2,
      ...state,
    });
  const device = {
    notify: jest.fn(async () => undefined),
    setCampusWatch: jest.fn(async () => undefined),
  };
  const listFn = jest.fn(async () => {
    if (list instanceof Error) throw list;
    return list;
  });
  const watch = new CampusWatch({
    device,
    store: {
      read: async <T>(owner: string, key: string) =>
        (saved.get(`${owner}/${key}`) as T) ?? null,
      write: async <T>(owner: string, key: string, value: T) => {
        saved.set(`${owner}/${key}`, value);
      },
    },
    savedScope: async () => scope,
    allowed: async () => allowed,
    disabled: () => disabled,
    list: listFn,
    // os textos de verdade têm teste próprio (campusNowText): aqui, o que entra em cada um
    messages: {
      ask: (item, near) =>
        message(`ask-${item.id}`, `${near.reason}:${near.spot.room}`),
      confirmed: item => message(`confirmed-${item.id}`, item.id),
      thanks: (item, thanks, views) =>
        message(`thanks-${item.id}`, `${thanks}/${views}`),
      level: level => message(`level-${level}`, String(level)),
    },
    now: () => now,
  });
  const read = () => saved.get(`conta/${CAMPUS_STATE_KEY}`) as CampusState;
  return { watch, device, listFn, read };
}

function message(id: string, title: string): CampusNotification {
  return {
    id,
    channel: 'campus',
    title,
    body: '',
    publicTitle: '',
    publicBody: '',
    target: 'campus',
  };
}

function standing(level: number) {
  return { points: level * 100, level, levelAt: 0, nextLevelAt: null };
}

it('stops the task without the account, the choice, the remote switch or the first visit', async () => {
  for (const options of [
    { scope: null, state: {} },
    { allowed: false, state: {} },
    { disabled: true, state: {} },
    { state: { visited: false } },
  ]) {
    const { watch, device, listFn } = setup(options);
    await expect(watch.checkInBackground()).resolves.toBe('stopped');
    expect(device.setCampusWatch).toHaveBeenCalledWith(false);
    expect(listFn).not.toHaveBeenCalled();
  }
});

it('does not even ask the server without a class nearby or an open notice of the student', async () => {
  const { watch, listFn, device } = setup({
    state: {},
    now: new Date(2026, 10, 23, 12, 0).getTime(),
  });
  await expect(watch.checkInBackground()).resolves.toBe('idle');
  expect(listFn).not.toHaveBeenCalled();
  expect(device.notify).not.toHaveBeenCalled();
});

it('asks "still there?" about a confirmed notice on the way to the class, once', async () => {
  const { watch, device, read } = setup({ state: {} });
  await expect(watch.checkInBackground()).resolves.toBe('done');
  expect(device.notify).toHaveBeenCalledTimes(1);
  expect(device.notify).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'ask-lift', title: 'elevators:6019' }),
  );
  expect(read().asked).toEqual(['lift']);
  // a próxima rodada não pergunta de novo
  await watch.checkInBackground();
  expect(device.notify).toHaveBeenCalledTimes(1);
});

it('never asks about a new, answered or skipped notice, and stops after three a day', async () => {
  const unconfirmed = setup({
    state: {},
    list: {
      notices: [notice({ confirmed: false, confirmations: 0 })],
      helpersToday: 1,
      you: standing(2),
    },
  });
  await unconfirmed.watch.checkInBackground();
  expect(unconfirmed.device.notify).not.toHaveBeenCalled();

  const skipped = setup({ state: { skipped: ['lift'] } });
  await skipped.watch.checkInBackground();
  expect(skipped.device.notify).not.toHaveBeenCalled();

  const full = setup({
    state: {
      asked: Array.from({ length: MAX_ASKS_PER_DAY }, (_, i) => `x${i}`),
    },
  });
  await full.watch.checkInBackground();
  expect(full.device.notify).not.toHaveBeenCalled();
});

it('tells the student their notice was confirmed, once, and thanks when it ends', async () => {
  const own = {
    id: 'meu',
    kind: 'ru' as const,
    status: 'short_queue' as const,
    createdAt: NOW - 30 * 60_000,
    thanks: 0,
    views: 0,
    confirmedTold: false,
    done: false,
  };
  const live = notice({
    id: 'meu',
    kind: 'ru',
    status: 'short_queue',
    place: { type: 'ru' },
    mine: true,
    confirmations: 1,
    views: 37,
    thanks: 12,
  });
  // fora do horário das aulas: só os avisos do próprio aluno
  const at = new Date(2026, 10, 23, 12, 30).getTime();
  const first = setup({
    state: { own: [own] },
    now: at,
    list: { notices: [live], helpersToday: 3, you: standing(2) },
  });
  await first.watch.checkInBackground();
  expect(first.device.notify).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'confirmed-meu' }),
  );
  const after = first.read().own[0];
  expect(after).toMatchObject({ confirmedTold: true, thanks: 12, views: 37 });

  const ended = setup({
    state: { own: [after] },
    now: at,
    list: { notices: [], helpersToday: 3, you: standing(2) },
  });
  await ended.watch.checkInBackground();
  expect(ended.device.notify).toHaveBeenCalledTimes(1);
  expect(ended.device.notify).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'thanks-meu', title: '12/37' }),
  );
  expect(ended.read().own[0].done).toBe(true);
});

it('tells about a new level once, but not on the first reading', async () => {
  const up = setup({
    state: { level: 2 },
    list: { notices: [], helpersToday: 1, you: standing(3) },
  });
  await up.watch.checkInBackground();
  expect(up.device.notify).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'level-3' }),
  );
  expect(up.read().level).toBe(3);

  const unknown = setup({
    state: { level: null },
    list: { notices: [], helpersToday: 1, you: standing(3) },
  });
  await unknown.watch.checkInBackground();
  expect(unknown.device.notify).not.toHaveBeenCalled();
});

it('waits for the next round when the list fails', async () => {
  const { watch, device } = setup({ state: {}, list: new Error('offline') });
  await expect(watch.checkInBackground()).resolves.toBe('waiting');
  expect(device.notify).not.toHaveBeenCalled();
  expect(device.setCampusWatch).not.toHaveBeenCalled();
});
