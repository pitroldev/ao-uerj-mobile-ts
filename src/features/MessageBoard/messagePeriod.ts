/**
 * Período das mensagens do mural. O portal informa o período do aluno; quando
 * não informa (ou informa algo fora do formato 2025.1), o app sugere um pelo
 * calendário e o aluno confirma no seletor.
 */
const PERIOD = /^\d{4}\.[12]$/;

/** Período do portal, se estiver no formato 2025.1. */
export function portalPeriod(
  account: { period?: string | null } | null | undefined,
): string | null {
  const period = account?.period ?? '';
  return PERIOD.test(period) ? period : null;
}

/** Sugestão pelo calendário: 1º semestre até junho, 2º a partir de julho. */
export function suggestedPeriod(now: Date): string {
  return `${now.getFullYear()}.${now.getMonth() < 6 ? '1' : '2'}`;
}

/** Período inicial da conversa: o do portal ou a sugestão. */
export function defaultMessagePeriod(
  account: { period?: string | null } | null | undefined,
  now: Date,
): string {
  return portalPeriod(account) ?? suggestedPeriod(now);
}

/** O período escolhido e os seis últimos semestres, do mais recente ao mais antigo. */
export function messagePeriodOptions(selected: string, now: Date): string[] {
  return [
    ...new Set([
      selected,
      ...Array.from({ length: 6 }, (_, index) => {
        const year = now.getFullYear() - Math.floor(index / 2);
        return `${year}.${index % 2 === 0 ? '2' : '1'}`;
      }),
    ]),
  ]
    .sort()
    .reverse();
}
