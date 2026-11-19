import { AppError } from '@root/shared/errors/AppError';
import {
  IdeaError,
  type IdeaDraft,
  type MyIdea,
  type NewIdea,
} from '../../domain/ideas';
import { IDEAS_STATE_KEY, Ideas } from '../Ideas';
import type { IdeasServerPort, IdeasStorePort } from '../ports';

const DRAFT: IdeaDraft = {
  title: 'Avisar quando abrir vaga no RID',
  area: 'rid',
  problem: 'Fico abrindo o portal toda hora pra ver se abriu vaga.',
  idea: '',
  portal: 'no',
};

function idea(partial: Partial<MyIdea> = {}): MyIdea {
  return {
    id: 'i1',
    kind: 'sent',
    title: DRAFT.title,
    area: 'rid',
    createdAt: 1,
    status: 'received',
    issue: null,
    requests: 1,
    ...partial,
  };
}

function setup({ supported = true } = {}) {
  const saved = new Map<string, unknown>();
  const server: jest.Mocked<IdeasServerPort> = {
    mine: jest.fn(async () => ({ ideas: [], remainingToday: 3 })),
    similar: jest.fn(async (_text: string) => []),
    submit: jest.fn(async (_idea: NewIdea) => idea()),
    vote: jest.fn(async (issue: number) =>
      idea({
        id: `issue-${issue}`,
        kind: 'joined',
        area: null,
        status: 'planned',
        issue: { number: issue, url: `https://github.com/o/r/issues/${issue}` },
        requests: 5,
      }),
    ),
  };
  const store: IdeasStorePort = {
    read: async <T>(scope: string, key: string) =>
      (saved.get(`${scope}/${key}`) as T | undefined) ?? null,
    write: async (scope, key, value) => {
      saved.set(`${scope}/${key}`, value);
    },
  };
  let owner: { scope: string } | null = { scope: 'conta' };
  const ideas = new Ideas({
    server: supported ? server : null,
    store,
    account: () => owner,
    app: { version: '2.20.0', platform: 'ios' },
  });
  return {
    ideas,
    server,
    saved,
    signIn: (scope: string | null) => {
      owner = scope ? { scope } : null;
    },
  };
}

it('works only where the app signs in as a student', async () => {
  expect(setup().ideas.supported).toBe(true);
  const { ideas } = setup({ supported: false });
  expect(ideas.supported).toBe(false);
  await expect(ideas.mine()).rejects.toThrow('Sugestões indisponíveis');
});

it('sends the tidy idea with the version, the system and the similar ones seen', async () => {
  const { ideas, server, saved } = setup();
  const sent = await ideas.submit(
    { ...DRAFT, title: '  Avisar quando   abrir vaga no RID ' },
    [31],
  );
  expect(sent).toEqual(idea());
  expect(server.submit).toHaveBeenCalledWith({
    title: 'Avisar quando abrir vaga no RID',
    area: 'rid',
    problem: DRAFT.problem,
    portal: 'no',
    appVersion: '2.20.0',
    platform: 'ios',
    seenSimilar: [31],
  });
  // a partir daqui, o Sobre já pode perguntar pelas feitas
  expect(saved.get(`conta/${IDEAS_STATE_KEY}`)).toEqual({
    known: true,
    seenDone: [],
  });
  expect(ideas.getSnapshot()).toMatchObject({ scope: 'conta', known: true });
});

it('keeps a contact or an unfinished draft on the phone', async () => {
  const { ideas, server } = setup();
  await expect(
    ideas.submit({ ...DRAFT, idea: 'me chama no @duda' }),
  ).rejects.toEqual(new IdeaError('contact', 'idea'));
  await expect(ideas.submit({ ...DRAFT, area: null })).rejects.toEqual(
    new AppError('INVALID_INPUT'),
  );
  expect(server.submit).not.toHaveBeenCalled();
});

it('searches the similar ones by the title and the problem', async () => {
  const { ideas, server } = setup();
  await ideas.similar(DRAFT);
  expect(server.similar).toHaveBeenCalledWith(
    `${DRAFT.title} ${DRAFT.problem}`,
    undefined,
  );
});

it('joins a similar issue and remembers the student suggested', async () => {
  const { ideas, server } = setup();
  const joined = await ideas.vote(31);
  expect(server.vote).toHaveBeenCalledWith(31);
  expect(joined).toMatchObject({ kind: 'joined', requests: 5 });
  expect(ideas.getSnapshot().known).toBe(true);
});

it('learns from the list that the student suggested (after a reinstall)', async () => {
  const { ideas, server } = setup();
  await ideas.mine();
  await ideas.load();
  expect(ideas.getSnapshot().known).toBe(false);
  server.mine.mockResolvedValueOnce({ ideas: [idea()], remainingToday: 2 });
  await expect(ideas.mine()).resolves.toEqual({
    ideas: [idea()],
    remainingToday: 2,
  });
  expect(ideas.getSnapshot().known).toBe(true);
});

it('remembers the done ones seen, per account, and tells the listeners', async () => {
  const { ideas, saved, signIn } = setup();
  const listener = jest.fn();
  ideas.subscribe(listener);
  await ideas.markSeen(['a', 'b']);
  await ideas.markSeen(['b', 'c']);
  expect(ideas.getSnapshot().seenDone).toEqual(['a', 'b', 'c']);
  expect(listener).toHaveBeenCalledTimes(2);

  // outra conta começa do zero
  signIn('outra');
  await ideas.load();
  expect(ideas.getSnapshot()).toEqual({
    scope: 'outra',
    known: false,
    seenDone: [],
  });
  expect(saved.get(`conta/${IDEAS_STATE_KEY}`)).toEqual({
    known: false,
    seenDone: ['a', 'b', 'c'],
  });
  // sem conta, nada é gravado
  signIn(null);
  await ideas.markSeen(['d']);
  expect(saved.has(`null/${IDEAS_STATE_KEY}`)).toBe(false);
});

it('reads a broken saved state as empty', async () => {
  const { ideas, saved } = setup();
  saved.set(`conta/${IDEAS_STATE_KEY}`, {
    known: 'sim',
    seenDone: [1, '', 'x'],
  });
  await ideas.load();
  expect(ideas.getSnapshot()).toEqual({
    scope: 'conta',
    known: false,
    seenDone: ['x'],
  });
});
