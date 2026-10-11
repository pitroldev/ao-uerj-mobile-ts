import { AppError } from '@root/shared/errors/AppError';
import { Community } from '@root/modules/community/application/Community';
import { SubmitErrorReport } from '@root/modules/support/application/SubmitErrorReport';
import { createPrivateApiAdapters, PrivateApiHttpClient } from '../index';

const account = {
  scope: 'account-a',
  name: 'Estudante Fictício',
  matricula: '209912345678',
};
const message = {
  _id: 'message-1',
  fullName: account.name,
  disciplina: 'IME02-01388',
  turma: 1,
  periodo: '2026.2',
  message: 'Olá, turma',
  createdAt: '2026-10-11T12:00:00Z',
};
const thread = { subjectId: 'IME02-01388', classNumber: '1', period: '2026.2' };

function setup() {
  const http: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  let currentAccount: typeof account | null = account;
  const adapters = createPrivateApiAdapters(http);
  const community = new Community({
    ...adapters,
    currentAccount: () => currentAccount,
  });
  const support = new SubmitErrorReport(
    adapters.errorReporter,
    { appVersion: '1.3.5', parserVersion: '2' },
    () => currentAccount,
  );
  return {
    http,
    community,
    support,
    signOut: () => {
      currentAccount = null;
    },
  };
}

describe('private API boundary', () => {
  it('maps messages and sends the explicitly selected academic period', async () => {
    const { http, community } = setup();
    http.post.mockResolvedValueOnce({ data: [message] });
    await expect(community.messages(thread)).resolves.toEqual([
      {
        id: 'message-1',
        authorName: account.name,
        subjectId: 'IME02-01388',
        classNumber: '1',
        period: '2026.2',
        text: 'Olá, turma',
        createdAt: message.createdAt,
      },
    ]);
    expect(http.post).toHaveBeenCalledWith(
      '/messages/get',
      {
        disciplina: 'IME02-01388',
        turma: '1',
        periodo: '2026.2',
      },
      undefined,
    );
    await expect(
      community.messages({ ...thread, period: 'current' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('builds the final message payload without accepting caller-supplied author identity', async () => {
    const { http, community } = setup();
    http.post.mockResolvedValue({ data: message });
    await community.postMessage(thread, '  Olá, turma  ');
    expect(http.post).toHaveBeenCalledWith(
      '/messages/post',
      {
        fullName: account.name,
        disciplina: thread.subjectId,
        turma: '1',
        periodo: '2026.2',
        message: 'Olá, turma',
      },
      undefined,
    );
    await expect(community.postMessage(thread, '   ')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('normalizes the thread and enforces the backend limit of 2000 characters after trimming', async () => {
    const { http, community } = setup();
    http.post.mockResolvedValue({ data: message });
    await community.postMessage(
      { subjectId: ' IME02-01388 ', classNumber: ' 1 ', period: ' 2026.2 ' },
      `  ${'a'.repeat(2000)}  `,
    );
    expect(http.post).toHaveBeenCalledWith(
      '/messages/post',
      {
        fullName: account.name,
        disciplina: thread.subjectId,
        turma: thread.classNumber,
        periodo: thread.period,
        message: 'a'.repeat(2000),
      },
      undefined,
    );
    await expect(
      community.postMessage(thread, 'a'.repeat(2001)),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it.each([
    { subjectId: ' ' },
    { subjectId: 'a'.repeat(101) },
    { classNumber: '' },
    { classNumber: 'a'.repeat(31) },
    { period: '2026.3' },
  ])(
    'rejects incomplete or invalid read threads without contacting the server: %o',
    async invalid => {
      const { http, community } = setup();
      await expect(
        community.messages({ ...thread, ...invalid }),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      expect(http.post).not.toHaveBeenCalled();
    },
  );

  it('normalizes required thread fields before reading', async () => {
    const { http, community } = setup();
    http.post.mockResolvedValue({ data: [] });
    await expect(
      community.messages({
        subjectId: ' IME02-01388 ',
        classNumber: ' 1 ',
        period: ' 2026.2 ',
      }),
    ).resolves.toEqual([]);
    expect(http.post).toHaveBeenCalledWith(
      '/messages/get',
      {
        disciplina: thread.subjectId,
        turma: thread.classNumber,
        periodo: thread.period,
      },
      undefined,
    );
  });

  it('rejects malformed provider responses instead of treating them as empty data', async () => {
    const { http, community } = setup();
    http.post.mockResolvedValueOnce({ data: {} });
    await expect(community.messages(thread)).rejects.toBeInstanceOf(AppError);
    http.post.mockResolvedValueOnce({
      data: [{ ...message, createdAt: 'invalid' }],
    });
    await expect(community.messages(thread)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    http.get.mockResolvedValueOnce({ data: {} });
    await expect(community.teachers()).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    http.get.mockResolvedValueOnce({ data: { docentes: [] } });
    await expect(community.teacher('Sem registro')).resolves.toBeNull();
  });

  it('encodes teacher names as a path segment and maps only the documented fields', async () => {
    const { http, community } = setup();
    http.get.mockResolvedValue({
      data: {
        docentes: [
          {
            _id: 'teacher-1',
            docente: 'Ana / Souza',
            createdAt: message.createdAt,
            disciplinas: {
              'IME02-01388': {
                disciplina: 'Cálculo',
                turmas: [{ turma: '01', local: null, horarios: [] }],
              },
            },
          },
        ],
      },
    });
    await expect(community.teacher('Ana / Souza')).resolves.toEqual({
      id: 'teacher-1',
      name: 'Ana / Souza',
      updatedAt: message.createdAt,
      subjects: [
        {
          id: 'IME02-01388',
          name: 'Cálculo',
          classes: [{ number: '01', location: '' }],
        },
      ],
    });
    expect(http.get).toHaveBeenCalledWith(
      '/docentes/Ana%20%2F%20Souza',
      undefined,
    );
  });

  it('discards a late private response after logout and blocks signed-out calls', async () => {
    const { http, community, signOut } = setup();
    let resolve!: (result: { data: unknown }) => void;
    http.post.mockReturnValue(
      new Promise(done => {
        resolve = done;
      }),
    );
    const pending = community.messages(thread);
    signOut();
    resolve({ data: [message] });
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(community.messages(thread)).rejects.toMatchObject({
      code: 'NOT_LOGGED_IN',
    });
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('forwards cancellation and never exposes raw HTTP errors', async () => {
    const { http, community } = setup();
    const controller = new AbortController();
    http.post.mockRejectedValueOnce({
      isAxiosError: true,
      message: 'url?password=secret',
    });
    await expect(
      community.messages(thread, { signal: controller.signal }),
    ).rejects.toEqual(new AppError('NETWORK'));
    expect(http.post.mock.calls[0][2]?.signal).toBe(controller.signal);
    http.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429 },
    });
    await expect(community.messages(thread)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('maps the backend invalid_request contract without leaking its raw message', async () => {
    const { http, community } = setup();
    http.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: 'invalid_request', message: 'private request details' },
      },
    });
    await expect(community.messages(thread)).rejects.toEqual(
      new AppError('INVALID_INPUT'),
    );
    http.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: '<unexpected>' },
    });
    await expect(community.messages(thread)).rejects.toEqual(
      new AppError('SERVICE_UNAVAILABLE'),
    );
  });

  it('sanitizes the actual support payload and never sends collected portal HTML', async () => {
    const { http, support } = setup();
    http.post.mockResolvedValue({ data: {} });
    const draft = {
      page: 'Quadro de Notas',
      subjectCode: 'ime02-01388',
      description: `Nome: ${account.name}\nMatrícula: ${account.matricula}\nE-mail teste@example.test\n_token=csrf-secret\nsenha=password-secret\nAuthorization: Bearer bearer-secret\nCookie: PHPSESSID=cookie-secret\n<input type="hidden" value="hidden-secret"><script>script-secret</script>As notas não carregam.`,
      html: ['<html>raw-html-secret</html>'],
    };
    await support.execute(draft);
    const [url, payload] = http.post.mock.calls[0];
    expect(url).toBe('/reportError');
    const wire = JSON.stringify(payload);
    for (const secret of [
      account.name,
      account.matricula,
      'teste@example.test',
      'csrf-secret',
      'password-secret',
      'bearer-secret',
      'cookie-secret',
      'hidden-secret',
      'script-secret',
      'raw-html-secret',
    ]) {
      expect(wire).not.toContain(secret);
    }
    expect(payload).toMatchObject({
      page: 'Quadro de Notas',
      description: expect.stringContaining('As notas não carregam.'),
    });
    const report = payload as { html: string[] };
    expect(JSON.parse(report.html[0])).toEqual({
      schemaVersion: 1,
      operation: 'Quadro de Notas',
      category: 'USER_REPORT',
      appVersion: '1.3.5',
      parserVersion: '2',
      subjectCode: 'IME02-01388',
    });
  });

  it('rejects invalid support input without sending', async () => {
    const { http, support } = setup();
    await expect(
      support.execute({ page: '', description: 'erro' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      support.execute({
        page: 'Notas',
        description: 'erro',
        subjectCode: '<token>',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      support.execute({ page: '<br>', description: 'erro' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      support.execute({
        page: 'Notas',
        description: '<script>removed</script>',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(http.post).not.toHaveBeenCalled();
  });
});
