import type {
  BackgroundRound,
  BackgroundRounds,
} from '@root/adapters/outbound/native/NativeBackgroundRounds';
import { IOS_DEADLINE, runBackgroundRounds } from '../backgroundRounds';
import type { PortalCheckTask } from '../portalCheckTask';

/** O aparelho falso: entrega rodadas e expirações e anota os encerramentos. */
function setup() {
  let start: ((round: BackgroundRound) => void) | null = null;
  let expire: ((id: string) => void) | null = null;
  const stop = jest.fn();
  const finished: [string, boolean][] = [];
  const rounds: BackgroundRounds = {
    listen(handlers) {
      start = handlers.start;
      expire = handlers.expire;
      return stop;
    },
    finish: jest.fn(async (id: string, success: boolean) => {
      finished.push([id, success]);
    }),
  };
  /** Cada chamada da tarefa, com o sinal; `hold` segura a próxima. */
  const calls: { data: unknown; signal?: AbortSignal }[] = [];
  let hold: Promise<void> | null = null;
  const task = jest.fn(async (data?: unknown, signal?: AbortSignal) => {
    calls.push({ data, signal });
    if (hold) await hold;
  }) as unknown as PortalCheckTask & jest.Mock;
  const unsubscribe = runBackgroundRounds(rounds, task);
  const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  return {
    calls,
    finished,
    stop,
    task,
    unsubscribe,
    settle,
    start: (round: BackgroundRound) => start!(round),
    expire: (id: string) => expire!(id),
    holdNext() {
      let release = () => {};
      hold = new Promise<void>(resolve => {
        release = () => {
          hold = null;
          resolve();
        };
      });
      return () => release();
    },
  };
}

afterEach(() => {
  jest.useRealTimers();
});

it('runs the due modes in order through the Android task and then ends the round', async () => {
  const { calls, finished, start, settle } = setup();
  start({ id: 'r1', modes: ['return', 'check'] });
  await settle();
  // `check` é a tarefa sem modo do Android
  expect(calls.map(call => call.data)).toEqual([{ mode: 'return' }, null]);
  expect(calls.every(call => call.signal?.aborted === false)).toBe(true);
  expect(finished).toEqual([['r1', true]]);
});

it('stops the queries when iOS says the time is over and ends the round as unfinished', async () => {
  const { calls, finished, start, expire, settle, holdNext } = setup();
  const release = holdNext();
  start({ id: 'r2', modes: ['check', 'return'] });
  await settle();
  expect(finished).toEqual([]);
  expire('r2');
  expect(calls[0].signal?.aborted).toBe(true);
  release();
  await settle();
  // o modo seguinte nem começa
  expect(calls).toHaveLength(1);
  expect(finished).toEqual([['r2', false]]);
});

it('gives up before the iOS budget ends', async () => {
  jest.useFakeTimers();
  const { calls, finished, start, holdNext } = setup();
  const release = holdNext();
  start({ id: 'r3', modes: ['check'] });
  await jest.advanceTimersByTimeAsync(IOS_DEADLINE - 1);
  expect(calls[0].signal?.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1);
  expect(calls[0].signal?.aborted).toBe(true);
  release();
  await jest.advanceTimersByTimeAsync(0);
  expect(finished).toEqual([['r3', false]]);
});

it('ignores a round that is already running and an expiration of an unknown one', async () => {
  const { task, finished, start, expire, settle, holdNext } = setup();
  const release = holdNext();
  start({ id: 'r4', modes: ['check'] });
  start({ id: 'r4', modes: ['check'] });
  expire('other');
  release();
  await settle();
  expect(task).toHaveBeenCalledTimes(1);
  expect(finished).toEqual([['r4', true]]);
});

it('ends the round even when the task fails, and stops listening on request', async () => {
  const { task, finished, start, settle, stop, unsubscribe } = setup();
  task.mockRejectedValueOnce(new Error('falhou'));
  start({ id: 'r5', modes: ['return'] });
  await settle();
  expect(finished).toEqual([['r5', true]]);
  unsubscribe();
  expect(stop).toHaveBeenCalledTimes(1);
});
