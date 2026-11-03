import { CompanionError, type CompanionCall } from '../../domain/companion';
import {
  companionErrorMessage,
  companionWatchMessage,
  watchingText,
  watchRequestText,
} from '../companionText';

const at = (h: number, m: number) => new Date(2026, 10, 23, h, m).getTime();

const call = (extra: Partial<CompanionCall>): CompanionCall => ({
  id: 'a',
  kind: 'lunch',
  at: at(12, 45),
  spot: 'ru',
  destination: null,
  note: '',
  host: 'Lucas',
  going: 2,
  capacity: 6,
  listedUntil: at(13, 15),
  expiresAt: at(13, 15),
  ...extra,
});

describe('quem está de olho', () => {
  it('conta só os outros, e cala quando só há você', () => {
    expect(watchingText(0)).toBeNull();
    expect(watchingText(1)).toBeNull();
    expect(watchingText(2)).toBe('1 aluno de olho agora');
    expect(watchingText(13)).toBe('12 alunos de olho agora');
  });
});

describe('o "Me avise se tiver mesa"', () => {
  it('diz até quando vigia', () => {
    expect(watchRequestText('lunch', at(13, 40))).toBe(
      'Se alguém abrir uma mesa até as 13:40, o app avisa.',
    );
    expect(watchRequestText('home', at(22, 50))).toBe(
      'Se alguém abrir um grupo para voltar até as 22:50, o app avisa.',
    );
  });

  it('avisa a primeira mesa, sem detalhe na tela de bloqueio', () => {
    expect(companionWatchMessage(call({}), 1)).toEqual({
      id: 'companion:watch',
      channel: 'companion',
      title: 'Abriram uma mesa no seu intervalo',
      body: 'Mesa no RU, 12:45 · Lucas abriu · 2 vão.',
      publicTitle: 'Companhia agora',
      publicBody: 'Tem companhia no seu horário livre.',
      target: 'companion',
    });
    expect(
      companionWatchMessage(
        call({
          kind: 'home',
          spot: 'concha',
          destination: 'metro',
          at: at(22, 15),
          going: 3,
        }),
        2,
      ).title,
    ).toBe('Abriram 2 grupos para voltar');
  });
});

it('explica as recusas de tirar alguém', () => {
  expect(companionErrorMessage(new CompanionError('removed'), 'lunch')).toBe(
    'Quem abriu tirou você desta mesa.',
  );
  expect(companionErrorMessage(new CompanionError('removed'), 'home')).toBe(
    'Quem abriu tirou você deste grupo.',
  );
  // sem o tipo, a frase fica sem "mesa" ou "grupo"
  expect(companionErrorMessage(new CompanionError('removed'))).toBe(
    'Quem abriu tirou você daqui.',
  );
  expect(companionErrorMessage(new CompanionError('not_host'))).toBe(
    'Só quem abriu pode tirar alguém.',
  );
  expect(companionErrorMessage(new CompanionError('member_gone'))).toBe(
    'Essa pessoa já tinha saído.',
  );
  expect(companionErrorMessage(new CompanionError('full'), 'home')).toBe(
    'Esse grupo lotou. Veja outro ou abra o seu.',
  );
});
