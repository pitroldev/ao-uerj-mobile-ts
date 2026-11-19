import type { IdeasServerPort } from '@root/modules/ideas/application/ports';
import type {
  IdeaDraft,
  MyIdea,
  NewIdea,
} from '@root/modules/ideas/domain/ideas';
import { createIdeas } from '../createIdeas';

const DRAFT: IdeaDraft = {
  title: 'Avisar quando abrir vaga no RID',
  area: 'rid',
  problem: 'Fico abrindo o portal toda hora pra ver se abriu vaga.',
  idea: '',
  portal: 'unknown',
};

const SENT: MyIdea = {
  id: 'i',
  kind: 'sent',
  title: DRAFT.title,
  area: 'rid',
  createdAt: 0,
  status: 'received',
  issue: null,
  requests: 1,
};

function setup(supported: boolean, os: 'ios' | 'android') {
  const server: jest.Mocked<IdeasServerPort> = {
    mine: jest.fn(),
    similar: jest.fn(),
    submit: jest.fn(async (_idea: NewIdea) => SENT),
    vote: jest.fn(),
  };
  const ideas = createIdeas({
    server,
    session: { supported },
    preferences: { read: async () => null, write: async () => undefined },
    account: () => ({ scope: 'conta' }),
    appVersion: '2.20.0',
    os,
  });
  return { ideas, server };
}

it('turns on only where the app signs in as a student', () => {
  expect(setup(false, 'android').ideas.supported).toBe(false);
  expect(setup(true, 'android').ideas.supported).toBe(true);
});

it('sends the version and the system of the phone', async () => {
  const { ideas, server } = setup(true, 'ios');
  await ideas.submit(DRAFT);
  expect(server.submit).toHaveBeenCalledWith(
    expect.objectContaining({ appVersion: '2.20.0', platform: 'ios' }),
  );
});
