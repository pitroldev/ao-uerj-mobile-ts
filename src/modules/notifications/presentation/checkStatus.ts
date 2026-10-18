import type { CheckState } from '../domain/checkState';

/** "hoje", "ontem", "amanhã" ou "12/10", e a hora ("14:05"). */
function dayAndClock(at: number, now: number) {
  const date = new Date(at);
  const clock = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  const day = (value: number) => {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(at)) / (24 * 60 * 60 * 1000));
  const near =
    days === 0 ? 'hoje' : days === 1 ? 'ontem' : days === -1 ? 'amanhã' : null;
  if (near) return { day: near, clock, near: true };
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return { day: `${dd}/${mm}`, clock, near: false };
}

/** "hoje às 14:05", "ontem às 9:10", "amanhã às 2:00", "em 12/10 às 7:30". */
export function momentLabel(at: number, now: number): string {
  const { day, clock, near } = dayAndClock(at, now);
  return `${near ? '' : 'em '}${day} às ${clock}`;
}

/** Fim de um prazo: "hoje às 23:00", "amanhã às 2:00", "19/10 às 2:00". */
function untilLabel(at: number, now: number): string {
  const { day, clock } = dayAndClock(at, now);
  return `${day} às ${clock}`;
}

/** Linha de estado da verificação no portal, na tela de Notificações. */
export function checkStatusText(check: CheckState, now: number): string {
  if (check.pausedUntil !== null && now < check.pausedUntil)
    return `Verificação pausada até ${untilLabel(check.pausedUntil, now)}: ${
      check.lastOutcome === 'signed-out'
        ? 'não foi possível entrar na sua conta.'
        : 'o Aluno Online limitou as consultas.'
    }`;
  if (check.lastRunAt === null)
    return 'A primeira verificação acontece nas próximas horas.';
  const when = momentLabel(check.lastRunAt, now);
  switch (check.lastOutcome) {
    case 'offline':
      return `Última tentativa ${when}, sem conexão.`;
    case 'unavailable':
      return `Última tentativa ${when}: o Aluno Online estava indisponível.`;
    case 'signed-out':
      return `Última tentativa ${when}: não foi possível entrar na sua conta.`;
    case 'failed':
      return `Última verificação ${when}, com falha em parte das consultas.`;
    case 'blocked':
      return `Última tentativa ${when}: o Aluno Online limitou as consultas.`;
    default:
      return `Última verificação ${when}.`;
  }
}
