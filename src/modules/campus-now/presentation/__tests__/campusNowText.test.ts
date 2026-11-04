import { AppError } from '@root/shared/errors/AppError';
import { CampusNowError, type CampusNotice } from '../../domain/campusNow';
import {
  askNotification,
  campusNowErrorMessage,
  communityShareText,
  confirmedNotification,
  levelNotification,
  thanksNotification,
  levelName,
  levelText,
  mapTarget,
  nearText,
  noticeTitle,
  outcomeText,
  placeText,
  problemText,
  problemTitle,
  sinceText,
  stateText,
} from '../campusNowText';

const NOW = new Date(2026, 10, 23, 14, 10).getTime();
const MINUTE = 60_000;

function notice(partial: Partial<CampusNotice> = {}): CampusNotice {
  return {
    id: 'n1',
    kind: 'elevators',
    status: 'long_queue',
    place: { type: 'elevators' },
    createdAt: NOW - 29 * MINUTE,
    expiresAt: NOW + 31 * MINUTE,
    state: 'active',
    confirmations: 8,
    ends: 0,
    confirmed: true,
    level: null,
    mine: false,
    answer: null,
    thanked: false,
    flagged: false,
    views: null,
    thanks: null,
    ...partial,
  };
}

it('names the notice and the place the way students talk', () => {
  expect(noticeTitle(notice())).toBe('Elevadores: fila de 10 min ou mais');
  expect(noticeTitle({ kind: 'ru', status: 'long_queue' })).toBe(
    'Fila grande no bandejão',
  );
  expect(noticeTitle({ kind: 'restroom', status: 'no_water' })).toBe(
    'Banheiro sem água',
  );
  expect(placeText({ type: 'elevators' })).toBe('Hall dos elevadores, bloco C');
  expect(placeText({ type: 'floor', block: 'F', floor: 'T' })).toBe(
    'Bloco F, térreo',
  );
  expect(placeText({ type: 'floor', block: 'F', floor: 'SE' })).toBe(
    'Bloco F, semienterrado',
  );
  expect(placeText({ type: 'floor', block: 'D', floor: '9' })).toBe(
    'Bloco D, 9º andar',
  );
  expect(
    placeText({ type: 'room', block: 'B', floor: '6', room: '6019' }),
  ).toBe('Sala 6019, bloco B');
  expect(placeText({ type: 'gate', gate: 'portao-sfx' })).toBe(
    'Portão 5, R. São Francisco Xavier, 524',
  );
});

it('says how the notice is doing, and the student sees their own numbers', () => {
  expect(stateText(notice(), NOW)).toBe('8 confirmaram · há 29 min');
  expect(stateText(notice({ confirmations: 1, ends: 2 }), NOW)).toBe(
    '1 confirmou · há 29 min · 2 de 3 disseram que acabou',
  );
  expect(stateText(notice({ confirmed: false, confirmations: 0 }), NOW)).toBe(
    'novo · esperando confirmação · há 29 min',
  );
  expect(stateText(notice({ confirmations: 0, level: 4 }), NOW)).toBe(
    'vale pelo nível de quem avisou · há 29 min',
  );
  expect(stateText(notice({ mine: true, views: 37, thanks: 1 }), NOW)).toBe(
    'seu aviso · 37 viram · 1 valeu',
  );
  expect(
    outcomeText(
      notice({ mine: true, state: 'ended', views: 1, thanks: 0 }),
      NOW,
    ),
  ).toBe('acabou · 1 viu · 0 valeus');
  expect(
    outcomeText(notice({ mine: true, state: 'removed', views: 2 }), NOW),
  ).toBe('saiu do ar: colegas disseram que não era verdade · 2 viram');
});

it('says since when, without a clock for the recent ones', () => {
  expect(sinceText(NOW - 20_000, NOW)).toBe('agora há pouco');
  expect(sinceText(NOW - 12 * MINUTE, NOW)).toBe('há 12 min');
  expect(sinceText(NOW - 80 * MINUTE, NOW)).toBe('há 1h20');
  expect(sinceText(NOW - 120 * MINUTE, NOW)).toBe('há 2h');
  expect(sinceText(new Date(2026, 10, 23, 9, 10).getTime(), NOW)).toBe(
    'desde 9:10',
  );
});

it('explains why the notice is on the way, from the schedule', () => {
  const spot = {
    start: 860,
    end: 960,
    room: '6019',
    block: 'B' as const,
    floor: '6',
    live: false,
  };
  expect(nearText({ spot, reason: 'elevators' })).toBe(
    'Você tem aula no 6º andar do bloco B às 14:20.',
  );
  expect(nearText({ spot, reason: 'floor' })).toBe(
    'É o andar da sua aula das 14:20, na Sala 6019 B.',
  );
  expect(nearText({ spot: { ...spot, live: true }, reason: 'room' })).toBe(
    'É a sala da sua aula, que vai até 16:00.',
  );
});

it('opens the map on the block, the restaurant, the gate or the room', () => {
  expect(mapTarget({ type: 'elevators' })).toEqual({ place: 'bloco-c' });
  expect(mapTarget({ type: 'floor', block: 'D', floor: '9' })).toEqual({
    place: 'bloco-d',
  });
  expect(mapTarget({ type: 'gate', gate: 'portao-metro' })).toEqual({
    place: 'portao-metro',
  });
  expect(
    mapTarget({ type: 'room', block: 'B', floor: '6', room: '6019' }),
  ).toEqual({ location: '6019 B' });
});

it('names the levels without gender', () => {
  expect(levelText(2)).toBe('Nível 2 · Na área');
  expect(levelName(5)).toBe('Lenda do Pavilhão');
  expect(levelName(9)).toBe('Lenda do Pavilhão');
});

it('summarizes the month for the student union, in plain text', () => {
  const problem = {
    kind: 'internet' as const,
    status: 'wifi_down' as const,
    block: 'A' as const,
    gate: null,
    days: 6,
    notices: 14,
    minutesToEnd: 170,
    peakHours: [9, 14],
  };
  expect(problemTitle(problem)).toBe('Wi-Fi fora · bloco A');
  expect(problemText(problem)).toBe(
    '2h50 em média até acabar · mais comum às 9h e às 14h',
  );
  const text = communityShareText(
    {
      week: {
        from: '2026-11-23',
        notices: 1,
        answers: 1,
        views: 1,
        minutesToEnd: null,
      },
      month: {
        month: '2026-11',
        weekdays: 17,
        notices: 240,
        problems: [problem],
      },
    },
    { current: true },
  );
  expect(text).toContain('Agora no campus · Novembro, até hoje');
  expect(text).toContain('17 dias úteis · 240 avisos confirmados pelos alunos');
  expect(text).toContain(
    '• Wi-Fi fora · bloco A: em 6 de 17 dias, mais comum às 9h e às 14h',
  );
});

it('builds the "still there?" phone notice with the reason', () => {
  const spot = {
    start: 860,
    end: 960,
    room: '6019',
    block: 'B' as const,
    floor: '6',
    live: false,
  };
  expect(askNotification(notice(), { spot, reason: 'elevators' })).toEqual({
    id: 'campus-ask-n1',
    channel: 'campus',
    target: 'campus',
    title: 'Os elevadores ainda estão com fila grande?',
    body: 'Você tem aula no 6º andar do bloco B às 14:20. 9 colegas avisaram: hall do C. Toque para responder.',
    publicTitle: 'Agora no campus',
    publicBody: 'Há um aviso para você no Agora no campus.',
  });
});

it('builds the phone notices about the student notices and the level', () => {
  const own = notice({
    kind: 'ru',
    status: 'short_queue',
    place: { type: 'ru' },
    createdAt: new Date(2026, 10, 23, 13, 30).getTime(),
  });
  expect(confirmedNotification(own)).toMatchObject({
    id: 'campus-confirmed-n1',
    title: 'Seu aviso foi confirmado',
    body: 'Fila pequena no bandejão: Bandejão (Restaurante Universitário). Agora vale para todo mundo.',
  });
  expect(thanksNotification(own, 12, 37)).toMatchObject({
    id: 'campus-thanks-n1',
    title: '12 colegas agradeceram seu aviso',
    body: 'Fila pequena no bandejão, às 13:30. 37 pessoas viram antes de ir.',
  });
  expect(thanksNotification(own, 1, 1).title).toBe(
    '1 colega agradeceu seu aviso',
  );
  expect(levelNotification(3)).toMatchObject({
    id: 'campus-level-3',
    title: 'Nível 3: Olho no campus',
    body: 'Seus avisos agora valem direto, sem esperar confirmação. Valeu por cuidar do campus.',
  });
});

it('explains each refusal', () => {
  expect(campusNowErrorMessage(new CampusNowError('limit'))).toContain(
    '10 avisos',
  );
  expect(campusNowErrorMessage(new CampusNowError('gone'))).toBe(
    'Esse aviso já acabou ou saiu do ar.',
  );
  expect(
    campusNowErrorMessage(new AppError('STUDENT_PROOF_UNAVAILABLE')),
  ).toContain('confirmar que você é aluno');
  expect(campusNowErrorMessage(new AppError('NETWORK'))).toBe(
    'Verifique sua conexão e tente novamente.',
  );
});
