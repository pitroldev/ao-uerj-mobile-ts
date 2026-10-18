import type { UiTone } from '@components/ui/tones';
import type { AttendanceSummary } from '@root/modules/attendance/domain/attendance';

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Tom da barra e do rótulo: `none`/`unknown` neutros, o resto pela folga. */
export function attendanceTone(
  summary: AttendanceSummary,
): Extract<UiTone, 'good' | 'warn' | 'bad' | 'neutral'> {
  switch (summary.level) {
    case 'good':
    case 'warn':
    case 'bad':
      return summary.level;
    default:
      return 'neutral';
  }
}

/** "8 de 15 tempos" (ou só "3 tempos", sem limite conhecido). */
export function usedText(summary: AttendanceSummary): string {
  return summary.limit === null
    ? count(summary.used, 'tempo', 'tempos')
    : `${summary.used} de ${count(summary.limit, 'tempo', 'tempos')}`;
}

/**
 * O que ainda cabe: "Ainda pode faltar 7 tempos (3 aulas)". `slotsPerClass`
 * é a maior aula da disciplina, para contar aulas inteiras por baixo;
 * `loading`, se a carga horária ainda está sendo buscada.
 */
export function remainingText(
  summary: AttendanceSummary,
  slotsPerClass: number,
  loading = false,
): string {
  const { remaining, used } = summary;
  if (used === 0) return 'Nenhuma falta marcada';
  if (remaining === null) {
    return loading
      ? 'Buscando a carga horária…'
      : 'Sem a carga horária, não há como saber o limite';
  }
  if (remaining < 0) {
    return `Passou do limite em ${count(-remaining, 'tempo', 'tempos')}`;
  }
  if (remaining === 0) return 'No limite: a próxima falta reprova';
  const classes = slotsPerClass > 0 ? Math.floor(remaining / slotsPerClass) : 0;
  return `Ainda pode faltar ${count(remaining, 'tempo', 'tempos')}${
    classes ? ` (${count(classes, 'aula', 'aulas')})` : ''
  }`;
}
