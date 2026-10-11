import { handleLogin } from '@features/Login/core';
import store from '@root/store';
import { refreshAuth } from '../lib/refreshAuth';

jest.mock('@root/store', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(),
    dispatch: jest.fn(),
  },
}));
jest.mock('@features/Login/core', () => ({ handleLogin: jest.fn() }));
jest.mock('@reducers/apiConfig', () => ({
  clear: () => ({ type: 'apiConfig/clear' }),
  setIsBlocked: (payload: boolean) => ({
    type: 'apiConfig/setIsBlocked',
    payload,
  }),
}));

const mockLogin = jest.mocked(handleLogin);
const mockGetState = jest.mocked(store.getState);
const successfulLogin = {
  nome: 'Aluno de Teste',
  periodo: '2026.2',
  fail_reason: '',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetState.mockReturnValue({
    userInfo: { matricula: 'test-student', password: 'test-password' },
  } as ReturnType<typeof store.getState>);
  mockLogin.mockResolvedValue(successfulLogin);
});

it('shares one login among simultaneous session renewals', async () => {
  let finishLogin!: (data: typeof successfulLogin) => void;
  mockLogin.mockImplementationOnce(
    () => new Promise(resolve => (finishLogin = resolve)),
  );

  const first = refreshAuth();
  const second = refreshAuth();
  expect(first).toBe(second);
  expect(mockLogin).toHaveBeenCalledTimes(1);
  expect(mockLogin).toHaveBeenCalledWith('test-student', 'test-password', {
    isRefresh: true,
  });
  finishLogin(successfulLogin);
  await Promise.all([first, second]);
});

it.each([{ fail_reason: '' }, { fail_reason: 'Credenciais inválidas' }])(
  'rejects unsuccessful login result %j and clears the invalid session',
  async result => {
    mockLogin.mockResolvedValueOnce(result);

    await expect(refreshAuth()).rejects.toThrow('LOGIN_FAILED');
    expect(store.dispatch).toHaveBeenCalledWith({ type: 'apiConfig/clear' });
  },
);

it('propagates a terminal login failure to every waiter without retrying credentials', async () => {
  const failure = new Error('LOGIN_TOKEN_NOT_FOUND');
  mockLogin.mockRejectedValueOnce(failure);

  const results = await Promise.allSettled([refreshAuth(), refreshAuth()]);

  expect(results).toEqual([
    { status: 'rejected', reason: failure },
    { status: 'rejected', reason: failure },
  ]);
  expect(mockLogin).toHaveBeenCalledTimes(1);
  await expect(refreshAuth()).resolves.toBeUndefined();
  expect(mockLogin).toHaveBeenCalledTimes(2);
});

it('rejects renewal without stored credentials', async () => {
  mockGetState.mockReturnValue({
    userInfo: {},
  } as ReturnType<typeof store.getState>);

  await expect(refreshAuth()).rejects.toThrow('NOT_LOGGED_IN');
  expect(mockLogin).not.toHaveBeenCalled();
});
