import { RemoteStatus } from '@root/modules/delivery/application/RemoteStatus';
import { createMemoryStore } from '@root/modules/delivery/application/__tests__/fakes';
import type { IdentityState } from '@root/modules/identity/domain/types';
import type { AppServices } from '../../composition/createAppServices';
import { createPortalCheckTask } from '../portalCheckTask';

const ACCOUNT = {
  scope: 'account-1',
  period: '2026.2',
  matricula: '202310045612',
  name: 'Marina',
};

const SIGNED_IN: IdentityState = {
  status: 'signedIn',
  account: ACCOUNT,
  error: null,
};

const RESTORING: IdentityState = {
  status: 'restoring',
  account: null,
  error: null,
};

/**
 * `answers`: respostas de `canRun`, na ordem (o padrão é verificar).
 * `before`: identidade antes da tarefa; `restored`: depois de `initialize`.
 */
function setup({
  answers = [] as boolean[],
  supported = true,
  before = RESTORING,
  restored = SIGNED_IN,
} = {}) {
  const calls: string[] = [];
  const step = (name: string) =>
    jest.fn(async () => {
      calls.push(name);
    });
  // o aviso remoto de verdade, com a rede falsa: a busca aparece em `calls`
  const source = {
    fetch: jest.fn(async () => {
      calls.push('fetch');
      return {
        schemaVersion: 1,
        minSupportedVersion: '1.0.0',
        notices: [],
        disabledFeatures: [],
      };
    }),
  };
  const status = new RemoteStatus({
    source,
    store: createMemoryStore(),
    now: () => Date.now(),
  });
  let identity = before;
  const check = {
    canRun: jest.fn(async () => {
      calls.push('can-run');
      return answers.shift() ?? true;
    }),
    run: jest.fn(async () => {
      calls.push('run');
      return 'ok';
    }),
    signInFailed: jest.fn(async () => {
      calls.push('sign-in-failed');
      return 'blocked';
    }),
  };
  const portalReturn = {
    checkInBackground: jest.fn(async () => {
      calls.push('return-check');
      return 'waiting';
    }),
  };
  const current = {
    initialize: jest.fn(async () => {
      calls.push('initialize');
      identity = restored;
      return null;
    }),
    flushCache: step('flush'),
    identity: { getSnapshot: () => identity },
    delivery: { status },
    notifications: {
      portalCheck: supported ? check : null,
      portalReturn: supported ? portalReturn : null,
    },
  } as unknown as AppServices;
  return {
    task: createPortalCheckTask(() => current),
    calls,
    check,
    source,
    portalReturn,
  };
}

it('decides with what is on the device before using the network', async () => {
  const { task, calls, check } = setup();
  await task();
  expect(calls).toEqual([
    'can-run',
    'fetch',
    'can-run',
    'initialize',
    'run',
    'flush',
  ]);
  expect(check.run).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
});

it('does not touch the network at night, during a pause or with alerts off', async () => {
  const { task, calls, source } = setup({ answers: [false] });
  await task();
  expect(calls).toEqual(['can-run', 'flush']);
  expect(source.fetch).not.toHaveBeenCalled();
});

it('does not sign in when the remote switch turned the alerts off', async () => {
  const { task, calls, check } = setup({ answers: [true, false] });
  await task();
  expect(calls).not.toContain('initialize');
  expect(check.run).not.toHaveBeenCalled();
});

it('records a failed restore instead of signing in again for the pages', async () => {
  const { task, check } = setup({
    restored: {
      ...SIGNED_IN,
      error: 'Aguarde um pouco antes de tentar novamente.',
      errorCode: 'RATE_LIMITED',
    },
  });
  await task();
  expect(check.signInFailed).toHaveBeenCalledWith('RATE_LIMITED');
  expect(check.run).not.toHaveBeenCalled();
});

it('checks normally when the error is from an earlier restore', async () => {
  // runtime vivo: a conta já foi restaurada, e o erro é de outra abertura
  const stale: IdentityState = {
    ...SIGNED_IN,
    error: 'Verifique sua conexão e tente novamente.',
    errorCode: 'NETWORK',
  };
  const { task, check } = setup({ before: stale, restored: stale });
  await task();
  expect(check.signInFailed).not.toHaveBeenCalled();
  expect(check.run).toHaveBeenCalled();
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

it('only tests the portal in the return mode, without signing in', async () => {
  const { task, calls, source, portalReturn } = setup();
  await task({ mode: 'return' });
  expect(calls).toEqual(['return-check']);
  expect(portalReturn.checkInBackground).toHaveBeenCalledTimes(1);
  expect(source.fetch).not.toHaveBeenCalled();
});
