import { IdeaError, type NewIdea } from '@root/modules/ideas/domain/ideas';
import { createDemoClock } from '../clock';
import { DEMO_ISSUES_URL } from '../data/ideas';
import { createDemoIdeas } from '../ports/ideas';

const REQUEST: NewIdea = {
  title: 'Avisar quando abrir vaga no RID',
  area: 'rid',
  problem: 'Fico abrindo o portal toda hora pra ver se abriu vaga.',
  portal: 'no',
  appVersion: '2.20.0',
  platform: 'android',
  seenSimilar: [],
};

function setup() {
  const time = new Date(2026, 10, 19, 15, 40).getTime();
  return createDemoIdeas(createDemoClock(() => time, 0));
}

describe('createDemoIdeas', () => {
  it('lists made-up ideas in every state, newest first, with no link to a real issue', async () => {
    const { ideas, remainingToday } = await setup().mine();
    expect(remainingToday).toBe(3);
    expect(ideas.map(idea => [idea.kind, idea.status])).toEqual([
      ['sent', 'received'],
      ['joined', 'planned'],
      ['sent', 'open'],
      ['sent', 'done'],
    ]);
    expect(ideas[1]).toMatchObject({
      id: 'issue-31',
      title: 'Aviso de vaga nas turmas pedidas',
      area: null,
      requests: 4,
    });
    expect(ideas.map(idea => idea.issue?.url ?? null)).toEqual([
      null,
      DEMO_ISSUES_URL,
      DEMO_ISSUES_URL,
      DEMO_ISSUES_URL,
    ]);
    const times = ideas.map(idea => idea.createdAt);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('finds the open similar ones by the words in common', async () => {
    const demo = setup();
    const similar = await demo.similar(
      'Avisar quando abrir vaga nas turmas, sem ficar na fila',
    );
    // duas palavras em comum com a #31, uma com a #24
    expect(similar.map(item => item.number)).toEqual([31, 24]);
    // a feita não aparece: só as abertas
    expect(await demo.similar('Modo escuro no widget')).toEqual([]);
  });

  it('keeps a sent idea as received and stops at three a day', async () => {
    const demo = setup();
    const sent = await demo.submit(REQUEST);
    expect(sent).toMatchObject({
      kind: 'sent',
      status: 'received',
      issue: null,
      requests: 1,
    });
    expect((await demo.mine()).ideas[0].id).toBe(sent.id);
    await demo.submit(REQUEST);
    await demo.submit(REQUEST);
    expect((await demo.mine()).remainingToday).toBe(0);
    await expect(demo.submit(REQUEST)).rejects.toEqual(new IdeaError('limit'));
  });

  it('refuses a contact like the server', async () => {
    await expect(
      setup().submit({ ...REQUEST, problem: 'Me chama no zap pra falar' }),
    ).rejects.toEqual(new IdeaError('contact', 'problem'));
  });

  it('joins an open issue once and refuses a closed one', async () => {
    const demo = setup();
    const joined = await demo.vote(24);
    expect(joined).toMatchObject({
      id: 'issue-24',
      kind: 'joined',
      status: 'open',
      requests: 3,
    });
    expect((await demo.vote(24)).requests).toBe(3);
    expect((await demo.mine()).ideas[0].id).toBe('issue-24');
    await expect(demo.vote(21)).rejects.toEqual(new IdeaError('gone'));
    await expect(demo.vote(999)).rejects.toEqual(new IdeaError('gone'));
  });
});
