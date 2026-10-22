import { AppError } from '@root/shared/errors/AppError';
import { RETRY_WAITS } from '../../domain/portalAvailability';
import type { SharedPortalStatus } from '../../domain/sharedStatus';
import { isPortalAnswer, PortalMonitor } from '../PortalMonitor';

const START = Date.UTC(2026, 9, 22, 14, 5);

function setup({
  online = true,
  active = true,
  shared = null as SharedPortalStatus | null,
} = {}) {
  let now = START;
  let status: number | Error = 200;
  const timers: Array<{ at: number; run: () => void }> = [];
  const probe = jest.fn(async () => {
    if (status instanceof Error) throw status;
    return status;
  });
  const read = jest.fn(async () => shared);
  const state = { online, active };
  const monitor = new PortalMonitor({
    now: () => now,
    online: () => state.online,
    active: () => state.active,
    probe,
    shared: { read },
    setTimer: (run, ms) => {
      const timer = { at: now + ms, run };
      timers.push(timer);
      return timer;
    },
    clearTimer: timer => {
      timers.splice(timers.indexOf(timer as (typeof timers)[number]), 1);
    },
  });
  return {
    monitor,
    probe,
    read,
    state,
    answer: (next: number | Error) => {
      status = next;
    },
    /** Avança o relógio e dispara os timers vencidos. */
    advance: async (ms: number) => {
      now += ms;
      for (const timer of timers.filter(item => item.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.run();
      }
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

const settle = async () => {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
};

it('classifies gateway answers as the portal being down', () => {
  expect([200, 302, 404, 500].every(isPortalAnswer)).toBe(true);
  expect([502, 503, 504].some(isPortalAnswer)).toBe(false);
});

it('fails reads at once while the portal is down, until the next attempt', async () => {
  const { monitor, probe } = setup();
  monitor.answered(503, 100);
  expect(monitor.getSnapshot()).toMatchObject({
    state: 'down',
    since: START,
    observedAt: START,
  });
  expect(() => monitor.guard()).toThrow(new AppError('SERVICE_UNAVAILABLE'));
  // a leitura pedida testa o portal (uma vez a cada 30 s)
  expect(probe).toHaveBeenCalledTimes(1);
  expect(() => monitor.guard()).toThrow(AppError);
  expect(probe).toHaveBeenCalledTimes(1);
});

it('does not blame the portal while the device is offline', () => {
  const { monitor } = setup({ online: false });
  monitor.failed('network');
  monitor.failed('network');
  expect(monitor.getSnapshot().state).toBe('up');
  expect(() => monitor.guard()).not.toThrow();
});

it('retries by itself when the wait ends with the app on screen', async () => {
  const { monitor, probe, answer, advance } = setup();
  const recovered = jest.fn();
  monitor.onRecovered(recovered);
  answer(503);
  monitor.failed('unavailable');
  await advance(RETRY_WAITS[0]);
  expect(probe).toHaveBeenCalledTimes(1);
  // ainda fora: a espera seguinte é maior
  expect(monitor.getSnapshot().retryAt).toBe(
    START + RETRY_WAITS[0] + RETRY_WAITS[1],
  );
  answer(200);
  await advance(RETRY_WAITS[1]);
  await settle();
  expect(monitor.getSnapshot().state).toBe('up');
  expect(recovered).toHaveBeenCalledTimes(1);
});

it('waits for the app to come back to the screen to retry', async () => {
  const { monitor, probe, state, advance } = setup({ active: false });
  monitor.failed('unavailable');
  await advance(RETRY_WAITS[0]);
  expect(probe).not.toHaveBeenCalled();
  state.active = true;
  monitor.resume();
  await settle();
  expect(probe).toHaveBeenCalledTimes(1);
  expect(monitor.getSnapshot().state).toBe('up');
});

it('retries now on request, sharing one probe', async () => {
  const { monitor, probe, answer } = setup();
  monitor.failed('unavailable');
  answer(new AppError('NETWORK'));
  await Promise.all([monitor.retryNow(), monitor.retryNow()]);
  expect(probe).toHaveBeenCalledTimes(1);
  expect(monitor.getSnapshot()).toMatchObject({ state: 'down', attempts: 1 });
  // no ar, não há o que tentar
  answer(200);
  await monitor.retryNow();
  expect(monitor.getSnapshot().state).toBe('up');
  await monitor.retryNow();
  expect(probe).toHaveBeenCalledTimes(2);
});

it('reads the shared status once when the portal goes down', async () => {
  const shared = {
    state: 'down' as const,
    since: START - 60_000,
    checkedAt: START,
  };
  const { monitor, read } = setup({ shared });
  monitor.failed('unavailable');
  await settle();
  expect(read).toHaveBeenCalledTimes(1);
  expect(monitor.getSnapshot().shared).toEqual(shared);
  monitor.failed('network');
  await settle();
  expect(read).toHaveBeenCalledTimes(1);
  // voltou: a situação compartilhada sai junto
  monitor.responded(100);
  expect(monitor.getSnapshot().shared).toBeNull();
});

it('flags a slow portal and clears it on the next quick answer', () => {
  const { monitor } = setup();
  monitor.answered(200, 9_000);
  expect(monitor.getSnapshot().slow).toBe(true);
  monitor.answered(200, 400);
  expect(monitor.getSnapshot().slow).toBe(false);
});

it('tells the screens only when something changes', () => {
  const { monitor } = setup();
  const listener = jest.fn();
  monitor.subscribe(listener);
  monitor.answered(200, 300);
  monitor.answered(200, 400);
  expect(listener).not.toHaveBeenCalled();
  monitor.answered(200, 9000);
  expect(listener).toHaveBeenCalledTimes(1);
});
