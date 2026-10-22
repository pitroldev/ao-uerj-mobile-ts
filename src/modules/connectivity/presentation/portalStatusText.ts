import {
  isSharedStatusFresh,
  type SharedPortalStatus,
} from '../domain/sharedStatus';

/** "14:05"; em outro dia, "21/10 às 14:05". */
export function clockText(time: number, now: number): string {
  const date = new Date(time);
  const clock = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  const today = new Date(now);
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return clock;
  const day = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${day} às ${clock}`;
}

type DownState = {
  since: number | null;
  retryAt: number | null;
  shared: SharedPortalStatus | null;
};

/**
 * A queda numa frase: de todos (o nosso servidor também não alcança o
 * portal), só deste aparelho (o servidor alcança) ou sem saber.
 */
export function portalDownText(
  { since, retryAt, shared }: DownState,
  now: number,
): string {
  const fresh = isSharedStatusFresh(shared, now) ? shared : null;
  let headline: string;
  if (fresh?.state === 'down') {
    const start = fresh.since ?? since;
    headline = start
      ? `O Aluno Online está fora do ar para todos desde ${clockText(start, now)}.`
      : 'O Aluno Online está fora do ar para todos.';
  } else if (fresh?.state === 'up') {
    headline =
      'O Aluno Online não está respondendo para você, mas está no ar para outros alunos. Pode ser a sua rede.';
  } else {
    headline = since
      ? `O Aluno Online não está respondendo desde ${clockText(since, now)}.`
      : 'O Aluno Online não está respondendo.';
  }
  const next =
    retryAt !== null && retryAt > now
      ? ` Nova tentativa às ${clockText(retryAt, now)}.`
      : '';
  return `${headline}${next}`;
}
