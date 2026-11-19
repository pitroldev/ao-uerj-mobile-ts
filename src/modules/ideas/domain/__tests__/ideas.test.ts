import {
  contactIn,
  draftProblems,
  isDraftReady,
  newIdea,
  newlyDone,
  similarText,
  withIdea,
  type IdeaDraft,
  type MyIdea,
} from '../ideas';

const DRAFT: IdeaDraft = {
  title: 'Avisar quando abrir vaga no RID',
  area: 'rid',
  problem: 'Pedi Cálculo II e fiquei na fila. Abro o portal toda hora.',
  idea: '',
  portal: 'no',
};

const APP = { version: '2.20.0', platform: 'android' as const };

function idea(partial: Partial<MyIdea> = {}): MyIdea {
  return {
    id: 'a',
    kind: 'sent',
    title: 'Modo escuro no widget',
    area: 'home',
    createdAt: 0,
    status: 'open',
    issue: { number: 21, url: 'https://github.com/o/r/issues/21' },
    requests: 3,
    ...partial,
  };
}

describe('contactIn', () => {
  it('says which contact a public text carries, with the Companhia agora filter', () => {
    expect(contactIn('Me chama no @dudauerj')).toBe('at');
    expect(contactIn('manda pra duda@uerj.br')).toBe('email');
    expect(contactIn('veja em https://exemplo.com')).toBe('link');
    expect(contactIn('meu número 21 99999-8888')).toBe('phone');
    expect(contactIn('me chama no zap')).toBe('app');
    // um horário ou um período não é telefone
    expect(contactIn('Aula às 14:20 no 2026.2')).toBeNull();
    expect(contactIn('')).toBeNull();
  });
});

describe('draftProblems', () => {
  it('accepts a draft within the server sizes, after tidying the text', () => {
    expect(draftProblems(DRAFT)).toEqual({});
    expect(isDraftReady(DRAFT)).toBe(true);
    // os espaços e o "[Sugestão]" não contam
    expect(
      draftProblems({ ...DRAFT, title: '  [Sugestão]   RID  ' }).title,
    ).toBe('short');
  });

  it('flags short, long and missing fields, and the contact before the size', () => {
    expect(
      draftProblems({
        ...DRAFT,
        title: 'Oi',
        area: null,
        problem: 'curto',
        idea: 'x'.repeat(1001),
      }),
    ).toEqual({
      title: 'short',
      area: 'short',
      problem: 'short',
      idea: 'long',
    });
    expect(draftProblems({ ...DRAFT, problem: '@duda' }).problem).toBe('at');
    expect(draftProblems({ ...DRAFT, title: 'x'.repeat(81) }).title).toBe(
      'long',
    );
  });
});

describe('newIdea', () => {
  it('builds the request with the tidy text, the app and the similar ones seen', () => {
    expect(
      newIdea(
        {
          ...DRAFT,
          title: '[Sugestão]  Avisar   vaga no RID ',
          problem: 'Linha um.\r\n\r\n\r\n\r\nLinha   dois. ',
          idea: '  ',
        },
        [31, 31, 24, 0, 7, 8, 9, 10],
        APP,
      ),
    ).toEqual({
      title: 'Avisar vaga no RID',
      area: 'rid',
      problem: 'Linha um.\n\nLinha dois.',
      portal: 'no',
      appVersion: '2.20.0',
      platform: 'android',
      seenSimilar: [31, 24, 7, 8, 9],
    });
    expect(newIdea({ ...DRAFT, idea: 'Um sino no RID' }, [], APP)?.idea).toBe(
      'Um sino no RID',
    );
  });

  it('refuses a draft that is not ready', () => {
    expect(newIdea({ ...DRAFT, area: null }, [], APP)).toBeNull();
    expect(newIdea({ ...DRAFT, problem: 'zap' }, [], APP)).toBeNull();
  });
});

it('searches by the title and the problem, up to what the server reads', () => {
  expect(similarText(DRAFT)).toBe(
    'Avisar quando abrir vaga no RID Pedi Cálculo II e fiquei na fila. Abro o portal toda hora.',
  );
  expect(
    similarText({ ...DRAFT, title: 'x'.repeat(80), problem: 'y'.repeat(1000) }),
  ).toHaveLength(1081);
});

it('finds the done ones the student has not seen yet', () => {
  const list = [
    idea({ id: 'a', status: 'done' }),
    idea({ id: 'b', status: 'done', kind: 'joined', area: null }),
    idea({ id: 'c', status: 'planned' }),
  ];
  expect(newlyDone(list, ['a']).map(item => item.id)).toEqual(['b']);
});

describe('withIdea', () => {
  it('puts a sent idea first and counts it in the day', () => {
    const list = { ideas: [idea()], remainingToday: 2 };
    const sent = idea({ id: 'new', status: 'received', issue: null });
    expect(withIdea(list, sent)).toEqual({
      ideas: [sent, idea()],
      remainingToday: 1,
    });
    expect(
      withIdea({ ideas: [], remainingToday: 0 }, sent).remainingToday,
    ).toBe(0);
  });

  it('replaces the joined request of the same issue without counting it', () => {
    const joined = idea({
      id: 'issue-31',
      kind: 'joined',
      area: null,
      issue: { number: 31, url: 'https://github.com/o/r/issues/31' },
      requests: 4,
    });
    const list = { ideas: [joined, idea()], remainingToday: 3 };
    const again = { ...joined, requests: 5 };
    expect(withIdea(list, again)).toEqual({
      ideas: [again, idea()],
      remainingToday: 3,
    });
  });
});
