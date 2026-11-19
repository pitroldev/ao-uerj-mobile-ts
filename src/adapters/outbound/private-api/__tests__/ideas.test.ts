import { AxiosError, CanceledError, type AxiosResponse } from 'axios';
import { IdeaError, type NewIdea } from '@root/modules/ideas/domain/ideas';
import { AppError } from '@root/shared/errors/AppError';
import { createIdeasServer } from '../ideas';
import type { PrivateApiHttpClient } from '../index';

const rejected = (status: number, error?: string, message = '') =>
  new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    data: error ? { error, message } : {},
    headers: {},
    config: {},
  } as AxiosResponse);

const URL = 'https://github.com/pitroldev/ao-uerj-mobile-ts/issues/28';

const SENT = {
  id: '0000000000000000000000a1',
  kind: 'sent',
  title: 'Pontos de ônibus no Mapa',
  area: 'map',
  createdAt: '2026-11-19T15:41:00.000Z',
  status: 'open',
  issue: { number: 28, url: URL },
  requests: 3,
};

const REQUEST: NewIdea = {
  title: 'Avisar quando abrir vaga no RID',
  area: 'rid',
  problem: 'Fico abrindo o portal toda hora.',
  portal: 'no',
  appVersion: '2.20.0',
  platform: 'android',
  seenSimilar: [],
};

function setup() {
  const client: jest.Mocked<PrivateApiHttpClient> = {
    get: jest.fn(),
    post: jest.fn(),
  };
  return { client, server: createIdeasServer(client) };
}

it('reads the ideas of the student and how many are left today', async () => {
  const { client, server } = setup();
  client.get.mockResolvedValueOnce({
    data: {
      ideas: [
        SENT,
        {
          id: 'issue-31',
          kind: 'joined',
          title: 'Aviso de vaga nas turmas pedidas',
          area: null,
          createdAt: '2026-11-18T10:00:00.000Z',
          status: 'planned',
          issue: { number: 31, url: URL.replace('28', '31') },
          requests: 4,
        },
        { ...SENT, id: 'r', status: 'received', issue: null, requests: 1 },
      ],
      remainingToday: 2,
    },
  });
  const signal = new AbortController().signal;
  const mine = await server.mine({ signal });
  expect(client.get).toHaveBeenCalledWith('/v2/ideas', { signal });
  expect(mine.remainingToday).toBe(2);
  expect(mine.ideas[0]).toEqual({
    ...SENT,
    createdAt: Date.parse(SENT.createdAt),
  });
  expect(mine.ideas[1]).toMatchObject({ kind: 'joined', area: null });
  expect(mine.ideas[2]).toMatchObject({ status: 'received', issue: null });
});

it('refuses an answer it cannot read, a link out of GitHub included', async () => {
  const { client, server } = setup();
  for (const broken of [
    { ...SENT, status: 'merged' },
    { ...SENT, area: 'library' },
    { ...SENT, kind: 'mine' },
    { ...SENT, createdAt: 'ontem' },
    { ...SENT, requests: -1 },
    { ...SENT, issue: { number: 0, url: URL } },
    { ...SENT, issue: { number: 28, url: 'https://golpe.example/28' } },
  ]) {
    client.get.mockResolvedValueOnce({
      data: { ideas: [broken], remainingToday: 3 },
    });
    await expect(server.mine()).rejects.toEqual(
      new AppError('SERVICE_UNAVAILABLE'),
    );
  }
});

it('asks for the similar ones with the text', async () => {
  const { client, server } = setup();
  client.post.mockResolvedValueOnce({
    data: {
      similar: [
        {
          number: 31,
          title: 'Aviso de vaga nas turmas pedidas',
          url: URL.replace('28', '31'),
          status: 'planned',
          requests: 4,
        },
      ],
    },
  });
  await expect(server.similar('vaga no RID')).resolves.toEqual([
    {
      number: 31,
      title: 'Aviso de vaga nas turmas pedidas',
      url: URL.replace('28', '31'),
      status: 'planned',
      requests: 4,
    },
  ]);
  expect(client.post).toHaveBeenCalledWith(
    '/v2/ideas/similar',
    { text: 'vaga no RID' },
    undefined,
  );
  // uma parecida ainda esperando a moderação não existe no GitHub
  client.post.mockResolvedValueOnce({
    data: {
      similar: [
        { number: 1, title: 'x', url: URL, status: 'received', requests: 1 },
      ],
    },
  });
  await expect(server.similar('x')).rejects.toEqual(
    new AppError('SERVICE_UNAVAILABLE'),
  );
});

it('sends the idea without the empty optional fields', async () => {
  const { client, server } = setup();
  const received = { ...SENT, status: 'received', issue: null, requests: 1 };
  client.post.mockResolvedValue({ data: { idea: received } });
  await server.submit(REQUEST);
  expect(client.post).toHaveBeenLastCalledWith('/v2/ideas', {
    title: REQUEST.title,
    area: 'rid',
    problem: REQUEST.problem,
    portal: 'no',
    appVersion: '2.20.0',
    platform: 'android',
  });
  await expect(
    server.submit({ ...REQUEST, idea: 'Um sino', seenSimilar: [31, 24] }),
  ).resolves.toMatchObject({ status: 'received', issue: null });
  expect(client.post).toHaveBeenLastCalledWith(
    '/v2/ideas',
    expect.objectContaining({ idea: 'Um sino', seenSimilar: [31, 24] }),
  );
});

it('joins an issue and reads the request back', async () => {
  const { client, server } = setup();
  client.post.mockResolvedValueOnce({
    data: {
      idea: {
        ...SENT,
        id: 'issue-28',
        kind: 'joined',
        area: null,
        requests: 4,
      },
    },
  });
  await expect(server.vote(28)).resolves.toMatchObject({
    id: 'issue-28',
    kind: 'joined',
    requests: 4,
  });
  expect(client.post).toHaveBeenCalledWith('/v2/ideas/votes', { issue: 28 });
});

it('turns the refusals into what the sheet explains', async () => {
  const { client, server } = setup();
  const cases: [AxiosError, Error][] = [
    [
      rejected(
        422,
        'idea_contact',
        'The title cannot carry a phone number, an e-mail, an @ or a link: the suggestion is public',
      ),
      new IdeaError('contact', 'title'),
    ],
    [
      rejected(422, 'idea_contact', 'The idea cannot carry…'),
      new IdeaError('contact', 'idea'),
    ],
    [rejected(422, 'idea_contact', 'Nope'), new IdeaError('contact', null)],
    [rejected(429, 'idea_limit'), new IdeaError('limit')],
    [rejected(404, 'issue_not_found'), new IdeaError('gone')],
    [rejected(503, 'suggestions_unavailable'), new IdeaError('github')],
    [rejected(503, 'github_unavailable'), new IdeaError('github')],
    [rejected(429, 'rate_limited'), new AppError('RATE_LIMITED')],
    [rejected(400, 'invalid_request'), new AppError('INVALID_INPUT')],
    [rejected(500), new AppError('SERVICE_UNAVAILABLE')],
  ];
  for (const [error, expected] of cases) {
    client.post.mockRejectedValueOnce(error);
    const caught = await server
      .submit(REQUEST)
      .catch((thrown: unknown) => thrown);
    expect(caught).toEqual(expected);
    // o campo do contato (o `AppError` não tem)
    expect((caught as { field?: unknown }).field).toBe(
      (expected as { field?: unknown }).field,
    );
  }
});

it('keeps the session errors and tells the network apart', async () => {
  const { client, server } = setup();
  // o banimento e a falta da sessão já chegam prontos do cliente com a sessão
  client.get.mockRejectedValueOnce(new AppError('STUDENT_BANNED', 'Suspensa'));
  await expect(server.mine()).rejects.toEqual(
    new AppError('STUDENT_BANNED', 'Suspensa'),
  );
  client.get.mockRejectedValueOnce(new AxiosError('offline', 'ERR_NETWORK'));
  await expect(server.mine()).rejects.toEqual(new AppError('NETWORK'));
  client.get.mockRejectedValueOnce(new CanceledError());
  await expect(server.mine()).rejects.toEqual(new AppError('CANCELLED'));
});
