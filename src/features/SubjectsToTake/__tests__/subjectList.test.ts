import {
  joinMeta,
  matchesSubjectSearch,
  plural,
  showsCount,
  subjectListPhase,
} from '../subjectList';

const idle = { isLoading: false, isFetching: false, isPaused: false };

describe('subjectListPhase', () => {
  it('keeps saved data on screen whatever the query state', () => {
    expect(
      subjectListPhase(
        { ...idle, isFetching: true, error: new Error('x') },
        { hasData: true, blocked: true },
      ),
    ).toBe('ready');
  });

  it('derives the state shown in place of an empty list', () => {
    const none = { hasData: false, blocked: false };
    expect(
      subjectListPhase({ ...idle, isLoading: true, error: null }, none),
    ).toBe('loading');
    // nova tentativa depois de um erro
    expect(
      subjectListPhase({ ...idle, isFetching: true, error: new Error() }, none),
    ).toBe('loading');
    expect(
      subjectListPhase(
        { ...idle, error: new Error() },
        { hasData: false, blocked: true },
      ),
    ).toBe('blocked');
    expect(subjectListPhase({ ...idle, error: new Error() }, none)).toBe(
      'error',
    );
    expect(
      subjectListPhase({ ...idle, isPaused: true, error: null }, none),
    ).toBe('offline');
    expect(subjectListPhase({ ...idle, error: null }, none)).toBe('empty');
  });

  it('only counts results when the list settled', () => {
    expect(showsCount('ready')).toBe(true);
    expect(showsCount('empty')).toBe(true);
    expect(showsCount('loading')).toBe(false);
    expect(showsCount('error')).toBe(false);
    expect(showsCount('blocked')).toBe(false);
    expect(showsCount('offline')).toBe(false);
  });
});

describe('matchesSubjectSearch', () => {
  const subject = { name: 'Introdução à Programação', id: 'IME03-10044' };

  it('ignores accents and case and also matches the code', () => {
    expect(matchesSubjectSearch('', subject)).toBe(true);
    expect(matchesSubjectSearch('INTRODUCAO', subject)).toBe(true);
    expect(matchesSubjectSearch('10044', subject)).toBe(true);
    expect(matchesSubjectSearch('ime03-1', subject)).toBe(true);
    expect(matchesSubjectSearch('cálculo', subject)).toBe(false);
  });
});

describe('text helpers', () => {
  it('pluralises and joins only the present parts', () => {
    expect(plural(1, 'disciplina', 'disciplinas')).toBe('1 disciplina');
    expect(plural(0, 'disciplina', 'disciplinas')).toBe('0 disciplinas');
    expect(joinMeta(['6º período', null, '4 créditos', false, ''])).toBe(
      '6º período · 4 créditos',
    );
  });
});
