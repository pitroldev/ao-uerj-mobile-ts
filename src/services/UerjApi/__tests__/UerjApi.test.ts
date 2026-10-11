import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { Buffer } from 'buffer';

import api from '../UerjApi';
import { refreshAuth } from '../lib/refreshAuth';
import { getRequisitionID } from '../utils/getRequisitionID';

jest.mock('@root/store', () => ({
  __esModule: true,
  default: {
    getState: () => mockState,
    dispatch: (action: { type: string; payload: Record<string, string> }) => {
      if (action.type === 'apiConfig/addDictionary') {
        Object.assign(mockState.apiConfig.dictionary, action.payload);
      }
    },
  },
}));
jest.mock('../lib/refreshAuth', () => ({ refreshAuth: jest.fn() }));
jest.mock('@reducers/apiConfig', () => ({
  addDictionary: (payload: Record<string, string>) => ({
    type: 'apiConfig/addDictionary',
    payload,
  }),
  setIsBlocked: (payload: boolean) => ({
    type: 'apiConfig/setIsBlocked',
    payload,
  }),
}));

const mockRefreshAuth = jest.mocked(refreshAuth);
let mockState: {
  apiConfig: {
    createdAt: number;
    _token: string;
    dictionary: Record<string, string>;
  };
  userInfo: { matricula: string; password: string };
};

// Sanitized structure observed when the portal has no valid session cookie.
const expiredPage = `<!DOCTYPE html><html><head>
  <title>Sistema de Graduação da UERJ</title></head><body>
  <div class="topo">ALUNO ONLINE</div>
  <div class="conteudo">Página não encontrada!</div>
  <div class="conteudo">Endereço do AlunoOnline:
    https://www.alunoonline.uerj.br/</div></body></html>`;
const validPage = '<div id="divCabecalhoAplicacao">Aluno</div><p>Notas</p>';

function response(
  config: InternalAxiosRequestConfig,
  html = validPage,
  status = 200,
): AxiosResponse {
  return {
    config,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    data: Buffer.from(html, 'latin1'),
  };
}

function renewSession() {
  mockState.apiConfig = {
    createdAt: 2,
    _token: 'new-token',
    dictionary: {
      notas: 'new-notas-request',
      DisciplinasCursar: 'new-curriculum-request',
    },
  };
}

function fetchGrades() {
  return api.get('/requisicaoaluno/', {
    params: {
      controle: 'Aluno',
      requisicao: 'old-notas-request',
      _token: 'old-token',
      periodo: '2026.2',
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = {
    apiConfig: {
      createdAt: 1,
      _token: 'old-token',
      dictionary: {
        notas: 'old-notas-request',
        DisciplinasCursar: 'old-curriculum-request',
        DadosDisciplina: 'old-subject-request',
      },
    },
    userInfo: { matricula: 'test-student', password: 'test-password' },
  };
  mockRefreshAuth.mockImplementation(async () => renewSession());
});

it('recognizes the real HTTP 200 expired-session page and replays with new IDs', async () => {
  const requests: Record<string, string>[] = [];
  api.defaults.adapter = async config => {
    requests.push({ ...config.params });
    return response(config, requests.length === 1 ? expiredPage : validPage);
  };

  const result = await fetchGrades();

  expect(result.data).toBe(validPage);
  expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
  expect(requests).toEqual([
    {
      controle: 'Aluno',
      requisicao: 'old-notas-request',
      _token: 'old-token',
      periodo: '2026.2',
    },
    {
      controle: 'Aluno',
      requisicao: 'new-notas-request',
      _token: 'new-token',
      periodo: '2026.2',
    },
  ]);
});

it.each([401, 403, 419, 500])(
  'recovers an expired request returning HTTP %s',
  async status => {
    let requests = 0;
    api.defaults.adapter = async config => {
      requests += 1;
      if (requests === 1) {
        throw new AxiosError(
          'Request failed',
          'ERR_BAD_RESPONSE',
          config,
          undefined,
          response(config, '', status),
        );
      }
      expect(config.params.requisicao).toBe('new-notas-request');
      expect(config.params._token).toBe('new-token');
      return response(config);
    };

    await expect(fetchGrades()).resolves.toMatchObject({ data: validPage });
    expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
    expect(requests).toBe(2);
  },
);

it('does not mistake a valid short response for an expired session', async () => {
  api.defaults.adapter = async config => response(config, '<p>Sem notas</p>');

  await expect(fetchGrades()).resolves.toMatchObject({
    data: '<p>Sem notas</p>',
  });
  expect(mockRefreshAuth).not.toHaveBeenCalled();
});

it('rejects a second expired response instead of returning it to feature parsers', async () => {
  const adapter = jest.fn(async config => response(config, expiredPage));
  api.defaults.adapter = adapter;

  await expect(fetchGrades()).rejects.toThrow('SESSION_EXPIRED');
  expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
  expect(adapter).toHaveBeenCalledTimes(2);
});

it('propagates a failed refresh without replaying the unauthenticated request', async () => {
  const failure = new Error('LOGIN_FAILED');
  mockRefreshAuth.mockRejectedValueOnce(failure);
  const adapter = jest.fn(async config => response(config, expiredPage));
  api.defaults.adapter = adapter;

  await expect(fetchGrades()).rejects.toBe(failure);
  expect(adapter).toHaveBeenCalledTimes(1);
});

it('uses an already renewed session for a late response from the old session', async () => {
  let releaseLateResponse!: () => void;
  let requests = 0;
  const firstRequestsStarted = new Promise<void>(resolve => {
    api.defaults.adapter = async config => {
      requests += 1;
      if (requests === 1) return response(config, expiredPage);
      if (requests === 2) {
        resolve();
        return new Promise(resolveResponse => {
          releaseLateResponse = () =>
            resolveResponse(response(config, expiredPage));
        });
      }
      return response(config);
    };
  });

  const first = fetchGrades();
  const second = fetchGrades();
  await firstRequestsStarted;
  await first;
  releaseLateResponse();
  await second;

  expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
  expect(requests).toBe(4);
});

it('resolves the derived subject ID again after login, preserving the selected subject', async () => {
  const derivedId = 'freshSubjectRequest1234567890';
  const requests: Record<string, string>[] = [];
  api.defaults.adapter = async config => {
    requests.push({ ...config.params });
    if (config.params.requisicao === 'old-subject-request') {
      return response(config, expiredPage);
    }
    if (config.params.requisicao === 'new-curriculum-request') {
      return response(config, `<input name="requisicao" value="${derivedId}">`);
    }
    return response(config);
  };

  await api.get('/requisicaoaluno/', {
    params: {
      controle: 'Aluno',
      requisicao: 'old-subject-request',
      _token: 'old-token',
      'disciplinas[0]': '12345',
    },
  });

  expect(requests.map(request => request.requisicao)).toEqual([
    'old-subject-request',
    'new-curriculum-request',
    derivedId,
  ]);
  expect(requests[2]).toMatchObject({
    _token: 'new-token',
    'disciplinas[0]': '12345',
  });
  expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
});

it('updates an ID resolved before a concurrent login before sending it', async () => {
  const requisicao = await getRequisitionID('notas');
  renewSession();
  const adapter = jest.fn(async config => response(config));
  api.defaults.adapter = adapter;

  await api.get('/requisicaoaluno/', {
    params: { controle: 'Aluno', requisicao, _token: 'old-token' },
  });

  expect(adapter.mock.calls[0][0].params).toMatchObject({
    requisicao: 'new-notas-request',
    _token: 'new-token',
  });
  expect(mockRefreshAuth).not.toHaveBeenCalled();
});

it('keeps the request ID and token in the same session when login finishes before dispatch', async () => {
  const requests: Record<string, string>[] = [];
  api.defaults.adapter = async config => {
    requests.push({ ...config.params });
    if (config.params.requisicao === 'old-notas-request') {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response(config, '', 500),
      );
    }
    return response(config);
  };

  const request = fetchGrades();
  // Axios starts its interceptor before this microtask. A needless await in
  // ID resolution lets this login finish before the token snapshot is read.
  const concurrentLogin = Promise.resolve().then(renewSession);
  await Promise.all([request, concurrentLogin]);

  expect(
    requests.map(({ requisicao, _token }) => [requisicao, _token]),
  ).toEqual([
    ['old-notas-request', 'old-token'],
    ['new-notas-request', 'new-token'],
  ]);
  expect(mockRefreshAuth).not.toHaveBeenCalled();
});

it('discards a derived ID returned after another login and fetches the current one', async () => {
  delete mockState.apiConfig.dictionary.DadosDisciplina;
  const oldDerivedId = 'oldSubjectRequest1234567890';
  const newDerivedId = 'newSubjectRequest1234567890';
  let releaseOldResponse!: () => void;
  let notifyStarted!: () => void;
  const started = new Promise<void>(resolve => (notifyStarted = resolve));
  const requests: string[] = [];
  api.defaults.adapter = async config => {
    requests.push(config.params.requisicao);
    if (config.params.requisicao === 'old-curriculum-request') {
      notifyStarted();
      return new Promise(resolve => {
        releaseOldResponse = () =>
          resolve(
            response(
              config,
              `<input name="requisicao" value="${oldDerivedId}">`,
            ),
          );
      });
    }
    expect(mockState.apiConfig.dictionary.DadosDisciplina).toBeUndefined();
    return response(
      config,
      `<input name="requisicao" value="${newDerivedId}">`,
    );
  };

  const requestId = getRequisitionID('DadosDisciplina');
  await started;
  renewSession();
  releaseOldResponse();

  await expect(requestId).resolves.toBe(newDerivedId);
  expect(mockState.apiConfig.dictionary.DadosDisciplina).toBe(newDerivedId);
  expect(requests).toEqual([
    'old-curriculum-request',
    'new-curriculum-request',
  ]);
  expect(mockRefreshAuth).not.toHaveBeenCalled();
});

it('renews a missing request dictionary once instead of failing permanently', async () => {
  mockState.apiConfig.dictionary = {};

  await expect(getRequisitionID('notas')).resolves.toBe('new-notas-request');
  expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
});

it('renews an empty dictionary before resolving a derived subject ID', async () => {
  mockState.apiConfig.dictionary = {};
  const derivedId = 'freshSubjectRequest1234567890';
  const adapter = jest.fn(async config =>
    response(config, `<input name="requisicao" value="${derivedId}">`),
  );
  api.defaults.adapter = adapter;

  await expect(getRequisitionID('DadosDisciplina')).resolves.toBe(derivedId);
  expect(mockRefreshAuth).toHaveBeenCalledTimes(1);
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(adapter.mock.calls[0][0].params).toMatchObject({
    requisicao: 'new-curriculum-request',
    _token: 'new-token',
  });
});

it('does not attempt login for network errors', async () => {
  const failure = new AxiosError('Network Error', 'ERR_NETWORK');
  api.defaults.adapter = async () => {
    throw failure;
  };

  await expect(fetchGrades()).rejects.toBe(failure);
  expect(mockRefreshAuth).not.toHaveBeenCalled();
});
