import { EMPTY_CHECK_STATE, type CheckState } from '../../domain/checkState';
import { checkStatusText, momentLabel } from '../checkStatus';

const NOW = new Date(2026, 9, 17, 15, 0).getTime();
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();

it.each([
  [at(17, 14, 5), 'hoje às 14:05'],
  [at(16, 9, 10), 'ontem às 9:10'],
  [at(18, 2), 'amanhã às 2:00'],
  [at(12, 7, 30), 'em 12/10 às 7:30'],
])('labels %p as %s', (moment, label) => {
  expect(momentLabel(moment, NOW)).toBe(label);
});

const state = (overrides: Partial<CheckState>): CheckState => ({
  ...EMPTY_CHECK_STATE,
  ...overrides,
});

it.each([
  [state({}), 'A primeira verificação acontece nas próximas horas.'],
  [
    state({ lastRunAt: at(17, 14, 5), lastOutcome: 'ok' }),
    'Última verificação hoje às 14:05.',
  ],
  [
    state({ lastRunAt: at(17, 11), lastOutcome: 'offline' }),
    'Última tentativa hoje às 11:00, sem conexão.',
  ],
  [
    state({ lastRunAt: at(16, 18), lastOutcome: 'unavailable' }),
    'Última tentativa ontem às 18:00: o Aluno Online estava indisponível.',
  ],
  [
    state({ lastRunAt: at(17, 11), lastOutcome: 'failed' }),
    'Última verificação hoje às 11:00, com falha em parte das consultas.',
  ],
  [
    state({ lastRunAt: at(17, 11), lastOutcome: 'signed-out' }),
    'Última tentativa hoje às 11:00: não foi possível entrar na sua conta.',
  ],
  [
    state({
      lastRunAt: at(17, 11),
      lastOutcome: 'blocked',
      pausedUntil: at(17, 23),
    }),
    'Verificação pausada até hoje às 23:00: o Aluno Online limitou as consultas.',
  ],
  [
    state({
      lastRunAt: at(17, 14),
      lastOutcome: 'blocked',
      pausedUntil: at(18, 2),
    }),
    'Verificação pausada até amanhã às 2:00: o Aluno Online limitou as consultas.',
  ],
  [
    state({
      lastRunAt: at(17, 14),
      lastOutcome: 'blocked',
      pausedUntil: at(19, 2),
    }),
    'Verificação pausada até 19/10 às 2:00: o Aluno Online limitou as consultas.',
  ],
  [
    state({
      lastRunAt: at(16, 9),
      lastOutcome: 'blocked',
      pausedUntil: at(16, 21),
    }),
    'Última tentativa ontem às 9:00: o Aluno Online limitou as consultas.',
  ],
  [
    state({
      lastRunAt: at(17, 11),
      lastOutcome: 'signed-out',
      pausedUntil: at(17, 23),
    }),
    'Verificação pausada até hoje às 23:00: não foi possível entrar na sua conta.',
  ],
])('describes %j', (check, text) => {
  expect(checkStatusText(check, NOW)).toBe(text);
});
