import type { AppServices } from '../../composition/createAppServices';
import { createPortalCheckTask } from '../portalCheckTask';

/** `answers`: respostas de `canRun`, na ordem (o padrão é verificar). */
function setup({ answers = [] as boolean[], supported = true } = {}) {
  const calls: string[] = [];
  const step = (name: string) =>
    jest.fn(async () => {
      calls.push(name);
    });
  const check = {
    canRun: jest.fn(async () => {
      calls.push('can-run');
      return answers.shift() ?? true;
    }),
    run: jest.fn(async () => {
      calls.push('run');
      return 'ok';
    }),
  };
  const current = {
    initialize: step('initialize'),
    flushCache: step('flush'),
    delivery: { status: { start: step('status'), refresh: step('refresh') } },
    notifications: { portalCheck: supported ? check : null },
  } as unknown as AppServices;
  return { task: createPortalCheckTask(() => current), calls, check };
}

it('decides with what is on the device and the remote switch before signing in', async () => {
  const { task, calls, check } = setup();
  await task();
  expect(calls).toEqual([
    'status',
    'can-run',
    'refresh',
    'can-run',
    'initialize',
    'run',
    'flush',
  ]);
  expect(check.run).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
});

it('does not touch the network at night, during a pause or with alerts off', async () => {
  const { task, calls } = setup({ answers: [false] });
  await task();
  expect(calls).toEqual(['status', 'can-run', 'flush']);
});

it('does not sign in when the remote switch turned the alerts off', async () => {
  const { task, calls, check } = setup({ answers: [true, false] });
  await task();
  expect(calls).not.toContain('initialize');
  expect(check.run).not.toHaveBeenCalled();
});

it('ends quietly when the check fails', async () => {
  const { task, calls, check } = setup();
  check.run.mockRejectedValue(new Error('falhou'));
  await expect(task()).resolves.toBeUndefined();
  expect(calls).toContain('flush');
});

it('does nothing where the check is not supported', async () => {
  const { task, calls } = setup({ supported: false });
  await task();
  expect(calls).toEqual([]);
});

it('joins a check already running instead of starting another', async () => {
  const { task, check } = setup();
  let finish = () => {};
  check.run.mockImplementationOnce(
    () =>
      new Promise<string>(resolve => {
        finish = () => resolve('ok');
      }),
  );
  const first = task();
  const second = task();
  expect(second).toBe(first);
  await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
  finish();
  await Promise.all([first, second]);
  expect(check.run).toHaveBeenCalledTimes(1);

  await task();
  expect(check.run).toHaveBeenCalledTimes(2);
});
