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

describe('o "Me avise se abrirem"', () => {
  it('diz até quando vigia', () => {
    expect(watchRequestText('lunch', at(13, 40))).toBe(
      'Você vai ser avisado se abrirem mesa até as 13:40.',
    );
    expect(watchRequestText('home', at(22, 50))).toBe(
      'Você vai ser avisado se chamarem uma volta até as 22:50.',
    );
  });

  it('avisa a primeira chamada, sem detalhe na tela de bloqueio', () => {
    expect(companionWatchMessage(call({}), 1)).toEqual({
      id: 'companion:watch',
      channel: 'companion',
      title: 'Abriram uma mesa na sua janela',
      body: 'Mesa no RU, 12:45 · Lucas chamou · 2 vão.',
      publicTitle: 'Companhia agora',
      publicBody: 'Uma chamada abriu na sua janela livre.',
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
    ).toBe('Chamaram 2 voltas para hoje');
  });
});

it('explica as recusas de tirar alguém', () => {
  expect(companionErrorMessage(new CompanionError('removed'))).toBe(
    'Quem chamou tirou você desta chamada.',
  );
  expect(companionErrorMessage(new CompanionError('not_host'))).toBe(
    'Só quem chamou tira alguém da chamada.',
  );
  expect(companionErrorMessage(new CompanionError('member_gone'))).toBe(
    'Essa pessoa já tinha saído da chamada.',
  );
});
