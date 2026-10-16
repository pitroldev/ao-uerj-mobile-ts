import { createAlunoOnlineAdapter } from '../createAlunoOnlineAdapter';
import type {
  PortalRequest,
  PortalResponse,
  PortalTransport,
} from '../contracts';
import { AppError } from '@root/shared/errors/AppError';
import {
  studentHeader,
  rejectedLoginPage,
  unknownMatriculaLoginPage,
  blockedHomePage,
  loginPage,
  homePage,
} from '../__fixtures__/loginPages';

const credentials = { matricula: 'student-a', password: 'synthetic-password' };
const expired =
  '<div class="topo">ALUNO ONLINE</div><div class="conteudo">Página não encontrada!</div>';
const shortPage = '<p>Sem notas</p>';
const gradesPage =
  '<table class="reportTable"><tr><th>Disciplina</th><th>Turma</th><th>P1</th><th>P2</th><th>PF</th><th>Resultado</th></tr></table>';
const response = (body: string, status = 200): PortalResponse => ({
  body,
  status,
});
const key = (operation: string, generation: number) =>
  `synthetic_${operation}_request_generation_${generation}`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup() {
  let logins = 0;
  let loginResult: string | undefined;
  let loginSequence: Array<string | undefined> = [];
  let handler: (request: PortalRequest) => Promise<PortalResponse> = async () =>
    response(gradesPage);
  const operations: PortalRequest[] = [];
  const transport: PortalTransport = {
    request: jest.fn(async (request: PortalRequest) => {
      if (request.path === '/') return response('<p>Portal</p>');
      if (!request.params)
        return response(
          `<input name="requisicao" value="login"><input name="_token" value="token-${
            logins + 1
          }">`,
        );
      if (request.params.senha) {
        logins += 1;
        const currentLoginResult = loginSequence.length
          ? loginSequence.shift()
          : loginResult;
        return response(
          currentLoginResult ??
            `${studentHeader}<div id="menu_linha_item">
          <a onclick="go('${key('grades', logins)}')">Notas do Período</a>
          <a onclick="go('${key(
            'curriculum',
            logins,
          )}')">Disciplinas do Currículo</a>
        </div>`,
        );
      }
      operations.push(request);
      return handler(request);
    }),
    cancelAndDrain: jest.fn(async () => undefined),
  };
  const cookies = { clear: jest.fn(async () => undefined) };
  const readCredentials = jest.fn(
    async () => credentials as typeof credentials | null,
  );
  const adapter = createAlunoOnlineAdapter({
    transport,
    cookies,
    readCredentials,
  });
  return {
    ...adapter,
    transport,
    cookies,
    operations,
    readCredentials,
    loginCount: () => logins,
    setLoginResult(html?: string) {
      loginResult = html;
    },
    setLoginSequence(...pages: Array<string | undefined>) {
      loginSequence = pages;
    },
    handle(fn: typeof handler) {
      handler = fn;
    },
  };
}

it('authenticates without exposing cookies, tokens or credentials in public identity', async () => {
  const app = setup();
  await expect(app.authentication.signIn(credentials)).resolves.toEqual({
    matricula: 'student-a',
    name: 'Estudante de Teste',
    period: '2026.2',
  });
  expect(app.cookies.clear).toHaveBeenCalledTimes(1);
  expect(app.diagnostics.snapshot()).toEqual({
    identityGeneration: 1,
    sessionGeneration: 1,
    operations: ['notas', 'DisciplinasCursar'],
  });
});

describe.each(['signIn', 'refresh'] as const)('%s bootstrap recovery', mode => {
  async function prepare() {
    const app = setup();
    if (mode === 'refresh') await app.authentication.signIn(credentials);
    const previousLogins = app.loginCount();
    const authenticate = () =>
      mode === 'signIn'
        ? app.authentication.signIn(credentials)
        : app.authentication.refresh();
    return { app, authenticate, previousLogins };
  }

  it('retries one expired authentication with a new coherent bootstrap', async () => {
    const { app, authenticate, previousLogins } = await prepare();
    app.setLoginSequence(loginPage, undefined);
    const pending = authenticate();
    // Only refresh() shares an attempt that is already in flight.
    // oxlint-disable-next-line jest/no-conditional-expect
    if (mode === 'refresh') expect(app.authentication.refresh()).toBe(pending);
    await expect(pending).resolves.toMatchObject({
      matricula: credentials.matricula,
    });
    expect(app.loginCount()).toBe(previousLogins + 2);
    expect(app.cookies.clear).toHaveBeenCalledTimes(previousLogins + 2);
    await app.records.getGrades();
    expect(app.operations[0].params).toMatchObject({
      requisicao: key('grades', previousLogins + 2),
      _token: `token-${previousLogins + 2}`,
    });
  });

  it('stops after the second expired authentication', async () => {
    const { app, authenticate, previousLogins } = await prepare();
    app.setLoginResult(expired);
    await expect(authenticate()).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
    expect(app.loginCount()).toBe(previousLogins + 2);
    expect(app.diagnostics.snapshot().sessionGeneration).toBeNull();
  });

  it.each([
    [rejectedLoginPage, 'LOGIN_FAILED'],
    [unknownMatriculaLoginPage, 'ACCOUNT_UNAVAILABLE'],
    [studentHeader, 'PORTAL_LAYOUT_CHANGED'],
    [blockedHomePage, 'POSSIBLY_BLOCKED'],
  ])('does not retry authentication response %s', async (page, code) => {
    const { app, authenticate, previousLogins } = await prepare();
    app.setLoginResult(page);
    await expect(authenticate()).rejects.toMatchObject({ code });
    expect(app.loginCount()).toBe(previousLogins + 1);
  });

  it('does not retry a transport failure during authentication', async () => {
    const { app, authenticate } = await prepare();
    const request = jest.mocked(app.transport.request);
    const original = request.getMockImplementation()!;
    request.mockClear();
    request.mockImplementation(input =>
      input.params?.senha
        ? Promise.reject(new Error('synthetic transport failure'))
        : original(input),
    );
    await expect(authenticate()).rejects.toMatchObject({ code: 'NETWORK' });
    expect(
      request.mock.calls.filter(([input]) => input.params?.senha),
    ).toHaveLength(1);
  });

  it('does not start recovery after logout during the cookie cleanup', async () => {
    const { app, authenticate, previousLogins } = await prepare();
    app.setLoginSequence(expired, undefined);
    const reached = deferred<void>();
    const release = deferred<void>();
    app.cookies.clear
      .mockImplementationOnce(async () => undefined)
      .mockImplementationOnce(async () => {
        reached.resolve();
        await release.promise;
      });
    const pending = authenticate().catch(error => error);
    await reached.promise;
    const logout = app.authentication.signOut();
    release.resolve();
    expect(await pending).toMatchObject({ code: 'CANCELLED' });
    await logout;
    expect(app.loginCount()).toBe(previousLogins + 1);
    expect(app.diagnostics.snapshot().sessionGeneration).toBeNull();
  });
});

it('recovers the HTTP 200 expired-session page using one coherent new ID/token pair', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  app.handle(async () =>
    response(app.operations.length === 1 ? expired : shortPage),
  );
  await expect(app.diagnostics.fetch('grades')).resolves.toBe(shortPage);
  expect(
    app.operations.map(request => [
      request.params?.requisicao,
      request.params?._token,
    ]),
  ).toEqual([
    [key('grades', 1), 'token-1'],
    [key('grades', 2), 'token-2'],
  ]);
  expect(app.loginCount()).toBe(2);
});

it.each([401, 403, 419, 500])('recovers HTTP %s once', async status => {
  const app = setup();
  await app.authentication.signIn(credentials);
  app.handle(async () =>
    app.operations.length === 1 ? response('', status) : response(gradesPage),
  );
  await expect(app.records.getGrades()).resolves.toEqual([]);
  expect(app.loginCount()).toBe(2);
  expect(app.operations).toHaveLength(2);
});

it('does not treat short valid responses as an expired session', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  app.handle(async () => response(shortPage));
  await expect(app.diagnostics.fetch('grades')).resolves.toBe(shortPage);
  expect(app.loginCount()).toBe(1);
});

it('recovers a missing history request ID from the refreshed menu', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  // The saved session has no history operation. A fresh portal menu supplies it.
  app.setLoginResult(`${studentHeader}<div id="menu_linha_item">
    <a onclick="go('${key('history', 2)}')">Requisitos realizados</a>
  </div>`);
  app.handle(async () => response(shortPage));

  await expect(app.diagnostics.fetch('history')).resolves.toBe(shortPage);
  expect(app.loginCount()).toBe(2);
  expect(app.operations).toHaveLength(1);
  expect(app.operations[0].params).toMatchObject({
    requisicao: key('history', 2),
    _token: 'token-2',
  });
});

it('does not fabricate an empty history when its request ID remains unavailable', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);

  await expect(app.records.getHistory()).rejects.toMatchObject({
    code: 'SESSION_EXPIRED',
  });
  expect(app.loginCount()).toBe(2);
  expect(app.operations).toHaveLength(0);
});

it('rejects a second expiry without entering a login loop', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  app.handle(async () => response(expired));
  await expect(app.records.getGrades()).rejects.toMatchObject({
    code: 'SESSION_EXPIRED',
  });
  expect(app.loginCount()).toBe(2);
  expect(app.operations).toHaveLength(2);
});

it('propagates rejected credentials to every concurrent caller without replay', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  app.setLoginResult(rejectedLoginPage);
  app.handle(async () => response(expired));
  const results = await Promise.allSettled([
    app.records.getGrades(),
    app.records.getGrades(),
  ]);
  results.forEach(result =>
    expect(result).toMatchObject({
      status: 'rejected',
      reason: { code: 'LOGIN_FAILED' },
    }),
  );
  expect(app.loginCount()).toBe(2);
  expect(app.operations).toHaveLength(2);
  expect(app.diagnostics.snapshot().sessionGeneration).toBeNull();
});

it('shares exactly one refresh among simultaneous renewals and keeps identity generation', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  const first = app.authentication.refresh();
  const second = app.authentication.refresh();
  expect(first).toBe(second);
  await Promise.all([first, second]);
  expect(app.loginCount()).toBe(2);
  expect(app.cookies.clear).toHaveBeenCalledTimes(2);
  expect(app.diagnostics.snapshot()).toMatchObject({
    identityGeneration: 1,
    sessionGeneration: 2,
  });
});

it('drains concurrent expired responses before refreshing once', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  const late = deferred<PortalResponse>();
  const started = deferred<void>();
  app.handle(async () => {
    if (app.operations.length === 1) return response(expired);
    if (app.operations.length === 2) {
      started.resolve();
      return late.promise;
    }
    return response(shortPage);
  });
  const first = app.diagnostics.fetch('grades');
  const second = app.diagnostics.fetch('grades');
  await started.promise;
  expect(app.loginCount()).toBe(1);
  late.resolve(response(expired));
  await Promise.all([first, second]);
  expect(app.loginCount()).toBe(2);
  expect(app.operations).toHaveLength(4);
});

it('resolves derived subject IDs again after refresh preserving subject selection', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  app.handle(async request => {
    const requisition = request.params?.requisicao;
    if (requisition === key('curriculum', app.loginCount()))
      return response(
        `<input name="requisicao" value="${key('subject', app.loginCount())}">`,
      );
    return response(app.loginCount() === 1 ? expired : shortPage);
  });
  await app.diagnostics.fetch('subjectDetails', { subjectId: 'ABC01-12345' });
  expect(app.operations.map(request => request.params?.requisicao)).toEqual([
    key('curriculum', 1),
    key('subject', 1),
    key('curriculum', 2),
    key('subject', 2),
  ]);
  expect(app.operations[3].params).toMatchObject({
    'disciplinas[0]': '12345',
    _token: 'token-2',
  });
});

it('never publishes a derived ID from a response belonging to an old session', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  const late = deferred<PortalResponse>();
  const started = deferred<void>();
  app.handle(async request => {
    if (request.params?.requisicao === key('curriculum', 1)) {
      started.resolve();
      return late.promise;
    }
    if (request.params?.requisicao === key('curriculum', 2))
      return response(`<input name="requisicao" value="${key('subject', 2)}">`);
    return response(shortPage);
  });
  const subject = app.diagnostics.fetch('subjectDetails', {
    subjectId: '12345',
  });
  await started.promise;
  const refreshed = app.authentication.refresh();
  expect(app.loginCount()).toBe(1);
  late.resolve(
    response(`<input name="requisicao" value="${key('subject', 1)}">`),
  );
  await refreshed;
  await subject;
  expect(app.operations.map(request => request.params?.requisicao)).toEqual([
    key('curriculum', 1),
    key('curriculum', 2),
    key('subject', 2),
  ]);
});

it('does not repeat credentials for malformed pages or network failures', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  app.handle(async () => {
    throw new Error('Network Error');
  });
  await expect(app.records.getGrades()).rejects.toMatchObject({
    code: 'NETWORK',
  });
  app.handle(async () => response('<div>Changed layout</div>'));
  await expect(app.records.getGrades()).rejects.toMatchObject({
    code: 'PORTAL_LAYOUT_CHANGED',
  });
  expect(app.loginCount()).toBe(1);
});

it.each([429, 502, 503])(
  'translates HTTP %s without refreshing',
  async status => {
    const app = setup();
    await app.authentication.signIn(credentials);
    app.handle(async () => response('unavailable', status));
    await expect(app.records.getGrades()).rejects.toMatchObject({
      code: status === 429 ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE',
    });
    expect(app.loginCount()).toBe(1);
  },
);

it('rejects refresh without saved credentials and can retry after credentials return', async () => {
  const app = setup();
  app.readCredentials.mockResolvedValueOnce(null);
  await expect(app.authentication.refresh()).rejects.toMatchObject({
    code: 'NOT_LOGGED_IN',
  });
  await expect(app.authentication.refresh()).resolves.toMatchObject({
    matricula: credentials.matricula,
  });
});

it.each([
  ['blocked', blockedHomePage, 'POSSIBLY_BLOCKED'],
  ['missing menu', studentHeader, 'PORTAL_LAYOUT_CHANGED'],
  ['rejected', rejectedLoginPage, 'LOGIN_FAILED'],
  [
    'unknown, disabled or under maintenance registration',
    unknownMatriculaLoginPage,
    'ACCOUNT_UNAVAILABLE',
  ],
  [
    'maintenance warning',
    '<br><table><tr><td><font>Sistema em manutenção. Tente mais tarde.</font></td></tr></table>',
    'ACCOUNT_UNAVAILABLE',
  ],
  ['login form without credential rejection', loginPage, 'SESSION_EXPIRED'],
  ['portal session error', expired, 'SESSION_EXPIRED'],
  [
    'token rejection',
    `${loginPage}<br><table><tr><td><font>Token inválido. Tente novamente.</font></td></tr></table>`,
    'SESSION_EXPIRED',
  ],
  [
    'unrecognized portal warning',
    '<br><table><tr><td><font>Acesso temporariamente indisponível.</font></td></tr></table>',
    'PORTAL_LAYOUT_CHANGED',
  ],
])('rejects %s authentication', async (_name, html, code) => {
  const app = setup();
  app.setLoginResult(html);
  await expect(app.authentication.signIn(credentials)).rejects.toMatchObject({
    code,
  });
  expect(app.diagnostics.snapshot().sessionGeneration).toBeNull();
});

it('accepts authenticated identity and menu even when the portal includes a notice', async () => {
  const app = setup();
  app.setLoginResult(
    `${homePage}<br><table><tr><td><font>Confira o calendário acadêmico.</font></td></tr></table>`,
  );
  await expect(app.authentication.signIn(credentials)).resolves.toMatchObject({
    matricula: credentials.matricula,
    name: 'Estudante de Teste',
  });
});

it('discards an operation completed after logout', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  const late = deferred<PortalResponse>();
  const started = deferred<void>();
  app.handle(async () => {
    started.resolve();
    return late.promise;
  });
  const query = app.records.getGrades();
  const result = query.catch(error => error);
  await started.promise;
  await app.authentication.signOut();
  late.resolve(response(gradesPage));
  expect(await result).toMatchObject({ code: 'CANCELLED' });
  expect(app.diagnostics.snapshot().sessionGeneration).toBeNull();
});

it('does not restart a refresh whose credential read finishes after logout', async () => {
  const app = setup();
  const saved = deferred<typeof credentials | null>();
  const started = deferred<void>();
  app.readCredentials.mockImplementationOnce(() => {
    started.resolve();
    return saved.promise;
  });
  const refresh = app.authentication.refresh();
  const result = refresh.catch(error => error);
  await started.promise;
  await app.authentication.signOut();
  saved.resolve(credentials);
  expect(await result).toMatchObject({ code: 'CANCELLED' });
  expect(app.loginCount()).toBe(0);
});

it('waits for the native transport to finish late cookie writes before clearing and signing in account B', async () => {
  const app = setup();
  await app.authentication.signIn(credentials);
  const drained = deferred<void>();
  const drainStarted = deferred<void>();
  const events: string[] = [];
  app.transport.cancelAndDrain = jest.fn(async () => {
    events.push('drain');
    drainStarted.resolve();
    await drained.promise;
    events.push('late-cookie-finished');
  });
  app.cookies.clear.mockImplementation(async () => {
    events.push('clear');
  });
  const logout = app.authentication.signOut();
  await drainStarted.promise;
  const login = app.authentication.signIn({
    ...credentials,
    matricula: 'student-b',
  });
  expect(app.cookies.clear).toHaveBeenCalledTimes(1);
  expect(app.loginCount()).toBe(1);
  drained.resolve();
  await logout;
  await expect(login).resolves.toMatchObject({ matricula: 'student-b' });
  expect(events).toEqual([
    'drain',
    'late-cookie-finished',
    'clear',
    'drain',
    'late-cookie-finished',
    'clear',
  ]);
});

it('cancels without logging in when the caller signal has already aborted', async () => {
  const app = setup();
  const controller = new AbortController();
  controller.abort();
  await expect(
    app.records.getGrades({ signal: controller.signal }),
  ).rejects.toBeInstanceOf(AppError);
  expect(app.transport.request).not.toHaveBeenCalled();
});
