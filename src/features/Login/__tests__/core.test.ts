import authApi from '@services/UerjApi/authApi';
import { clearAllCookies, getCookies } from '@services/cookies';
import store from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as userInfoReducer from '@reducers/userInfo';

import { handleLogin } from '../core';
import {
  blockedHomePage,
  homePage,
  loginPage,
  rejectedLoginPage,
  studentHeader,
} from '../__fixtures__/loginPages';

jest.mock('@services/UerjApi/authApi', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('@services/UerjApi/utils', () => ({
  retry: (operation: () => Promise<unknown>) => operation(),
}));
jest.mock('@services/cookies', () => ({
  clearAllCookies: jest.fn(),
  getCookies: jest.fn(),
}));
jest.mock('@root/store', () => ({
  __esModule: true,
  default: { dispatch: jest.fn() },
}));
jest.mock('@reducers/apiConfig', () => ({
  setState: (payload: unknown) => ({ type: 'apiConfig/setState', payload }),
  setIsBlocked: (payload: boolean) => ({
    type: 'apiConfig/setIsBlocked',
    payload,
  }),
}));
jest.mock('@reducers/userInfo', () => ({
  setState: (payload: unknown) => ({ type: 'user/setState', payload }),
}));

const mockGet = jest.mocked(authApi.get);
const mockGetCookies = jest.mocked(getCookies);
const syntheticCookies = {
  PHPSESSID: { name: 'PHPSESSID', value: 'synthetic-session' },
};

function mockLoginResponses(home = homePage, login = loginPage) {
  mockGet
    .mockResolvedValueOnce({ data: '' })
    .mockResolvedValueOnce({ data: login })
    .mockResolvedValueOnce({ data: home });
}

describe('handleLogin', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetCookies.mockResolvedValue(syntheticCookies);
  });

  it('authenticates and persists a validated student, menu, token and cookies', async () => {
    mockLoginResponses();

    await expect(handleLogin('test-student', 'test-password')).resolves.toEqual(
      {
        nome: 'Estudante de Teste',
        periodo: '2026.2',
        fail_reason: '',
      },
    );

    expect(clearAllCookies).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/requisicaoaluno/');
    expect(mockGet).toHaveBeenNthCalledWith(3, '/requisicaoaluno/', {
      params: {
        requisicao: 'synthetic-login-requisition',
        matricula: 'test-student',
        senha: 'test-password',
        _token: 'synthetic-csrf-token',
      },
    });
    expect(store.dispatch).toHaveBeenCalledWith(
      userInfoReducer.setState({
        name: 'Estudante de Teste',
        periodo: '2026.2',
        matricula: 'test-student',
        password: 'test-password',
      }),
    );
    expect(store.dispatch).toHaveBeenCalledWith(
      apiConfigReducer.setState({
        cookies: syntheticCookies,
        dictionary: {
          login: 'synthetic-login-requisition',
          notas: 'synthetic_grades_requisition_1234',
          DisciplinasCursar: 'synthetic_courses_requisition_1234',
        },
        _token: 'synthetic-csrf-token',
      }),
    );
    expect(store.dispatch).toHaveBeenCalledWith(
      apiConfigReducer.setIsBlocked(false),
    );
  });

  it('preserves existing cookies during a background refresh', async () => {
    mockLoginResponses();

    await handleLogin('test-student', 'test-password', { isRefresh: true });

    expect(clearAllCookies).not.toHaveBeenCalled();
    expect(mockGetCookies).toHaveBeenCalledTimes(1);
  });

  it('preserves the server rejection reason without persisting a session', async () => {
    mockLoginResponses(rejectedLoginPage);

    await expect(handleLogin('test-student', 'test-password')).resolves.toEqual(
      {
        fail_reason: 'Matrícula ou senha inválida.',
      },
    );

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(mockGetCookies).not.toHaveBeenCalled();
  });

  it.each([loginPage, '<html><body>Página não encontrada!</body></html>', ''])(
    'returns an explicit failure for an unauthenticated response',
    async html => {
      mockLoginResponses(html);

      const result = await handleLogin('test-student', 'test-password');

      expect(result.fail_reason).toEqual(expect.any(String));
      expect(result.fail_reason.length).toBeGreaterThan(0);
      expect(store.dispatch).not.toHaveBeenCalled();
      expect(mockGetCookies).not.toHaveBeenCalled();
    },
  );

  it('does not submit credentials when the login form is missing', async () => {
    mockLoginResponses(homePage, '<html>Serviço indisponível</html>');

    await expect(handleLogin('test-student', 'test-password')).rejects.toThrow(
      'LOGIN_REQ_ID_NOT_FOUND',
    );

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(store.dispatch).not.toHaveBeenCalled();
    expect(mockGetCookies).not.toHaveBeenCalled();
  });

  it('rejects a blocked account before any session state is persisted', async () => {
    mockLoginResponses(blockedHomePage);

    await expect(handleLogin('test-student', 'test-password')).rejects.toThrow(
      'POSSIBLY_BLOCKED',
    );

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(mockGetCookies).not.toHaveBeenCalled();
  });

  it('rejects an incomplete home page without usable requisitions', async () => {
    mockLoginResponses(studentHeader);

    await expect(handleLogin('test-student', 'test-password')).rejects.toThrow(
      'LOGIN_REQUISITIONS_NOT_FOUND',
    );

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(mockGetCookies).not.toHaveBeenCalled();
  });

  it('does not persist partial state if the cookie store fails', async () => {
    mockLoginResponses();
    mockGetCookies.mockRejectedValueOnce(new Error('COOKIE_STORE_UNAVAILABLE'));

    await expect(handleLogin('test-student', 'test-password')).rejects.toThrow(
      'COOKIE_STORE_UNAVAILABLE',
    );

    expect(store.dispatch).not.toHaveBeenCalled();
  });
});
