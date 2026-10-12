import { TIME_DICTIONARY } from '@utils/constants/time';
import { getVacancieHealth } from '@utils/health/vacancies';
import { HEALTH_LABEL, healthTone } from '@components/ui/tones';
import type {
  Horario,
  SubjectsTaken,
} from '@root/modules/academics/domain/models';
import type { WeekDay } from '@root/types/dateStuff';

/**
 * Formatação da tela de detalhe da disciplina (só apresentação): horários
 * agrupados, vagas com saúde e rótulo, requisitos já cumpridos e o link da
 * ementa.
 */

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Segunda", "Segunda e Quarta", "Segunda, Quarta e Sexta". */
export function joinPt(items: string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

const WEEK_ORDER: WeekDay[] = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
];

export type ScheduleGroup = {
  days: WeekDay[];
  /** "M3–M4" (ou "M3" quando é um tempo só). */
  slots: string;
  /** "8:50–10:30" (vazio se o tempo não for conhecido). */
  times: string;
  /** "Segunda e Quarta · M3–M4 · 8:50–10:30". */
  text: string;
  /** "Segunda e Quarta, M3 a M4, 8:50 às 10:30". */
  accessibilityLabel: string;
};

/**
 * Agrupa os horários da turma por intervalo de tempos, juntando os dias que
 * repetem o mesmo intervalo: "Segunda e Quarta · M3–M4 · 8:50–10:30".
 */
export function groupSchedule(schedule: Horario[] = []): ScheduleGroup[] {
  const groups: { key: string; days: WeekDay[]; start: string; end: string }[] =
    [];
  schedule.forEach(entry => {
    (Object.keys(entry) as WeekDay[]).forEach(day => {
      (entry[day] ?? []).forEach(block => {
        if (!block?.length) return;
        const start = block[0];
        const end = block[block.length - 1];
        const key = `${start}-${end}`;
        const group = groups.find(g => g.key === key);
        if (!group) groups.push({ key, days: [day], start, end });
        else if (!group.days.includes(day)) group.days.push(day);
      });
    });
  });

  return groups.map(({ days, start, end }) => {
    const sorted = [...days].sort(
      (a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b),
    );
    const from = TIME_DICTIONARY[start]?.[0];
    const to = TIME_DICTIONARY[end]?.[1];
    const single = start === end;
    const slots = single ? start : `${start}–${end}`;
    const times = from && to ? `${from}–${to}` : '';
    const dayText = joinPt(sorted);
    return {
      days: sorted,
      slots,
      times,
      text: [dayText, slots, times].filter(Boolean).join(' · '),
      accessibilityLabel: [
        dayText,
        single ? start : `${start} a ${end}`,
        from && to ? `${from} às ${to}` : '',
      ]
        .filter(Boolean)
        .join(', '),
    };
  });
}

export type VacancyTone = 'good' | 'warn' | 'bad' | 'neutral';

export type VacancyInfo = {
  /** "38/40" ou "–". */
  text: string;
  tone: VacancyTone;
  /** "Bom", "Atenção", "Crítico", "Lotada", "Sem vagas" ou "Sem dado". */
  label: string;
  /** Preenchimento da barra, de 0 a 1. */
  fill: number;
  /** "Solicitadas: 38 de 40, Crítico". */
  accessibilityLabel: string;
};

/**
 * Vagas de uma coluna (Solicitadas ou Ocupadas) com a saúde do app
 * (`getVacancieHealth`). Sem vaga sobrando vira "Lotada".
 */
export function vacancyInfo(
  name: string,
  taken?: number,
  available?: number,
): VacancyInfo {
  if (
    typeof taken !== 'number' ||
    typeof available !== 'number' ||
    !Number.isFinite(taken) ||
    !Number.isFinite(available)
  ) {
    return {
      text: '–',
      tone: 'neutral',
      label: HEALTH_LABEL.neutral,
      fill: 0,
      accessibilityLabel: `${name}: sem dado`,
    };
  }
  const text = `${taken}/${available}`;
  const describe = (label: string) =>
    `${name}: ${taken} de ${available}, ${label}`;
  if (available <= 0) {
    const label = 'Sem vagas';
    return {
      text,
      tone: 'bad',
      label,
      fill: 1,
      accessibilityLabel: describe(label),
    };
  }
  if (taken >= available) {
    const label = 'Lotada';
    return {
      text,
      tone: 'bad',
      label,
      fill: 1,
      accessibilityLabel: describe(label),
    };
  }
  const tone = healthTone(getVacancieHealth(taken, available).status);
  const label = HEALTH_LABEL[tone];
  return {
    text,
    tone,
    label,
    fill: Math.max(0, taken / available),
    accessibilityLabel: describe(label),
  };
}

/** Requisito de trava de créditos (não é uma disciplina; não abre detalhe). */
export function isCreditLock(id: string | number): boolean {
  return String(id).toUpperCase().includes('TRAVA');
}

/**
 * "Aprovado em 2025.2" (ou "Isento") quando o histórico salvo mostra o
 * requisito cumprido; `null` caso contrário.
 */
export function requirementMet(
  id: string,
  history?: SubjectsTaken[],
): string | null {
  const hit = history?.find(
    item =>
      item.id === id &&
      (item.status === 'APPROVED' || item.status === 'EXEMPT'),
  );
  if (!hit) return null;
  if (hit.status === 'EXEMPT') return 'Isento';
  return hit.period ? `Aprovado em ${hit.period}` : 'Aprovado';
}

/** Endereço da ementa no ementário da UERJ (só o número do código). */
export function syllabusUrl(code: string | number): string {
  return `https://www.ementario.uerj.br/ementa.php?cdg_disciplina=${String(code)
    .split('-')
    .pop()}`;
}

/** "4 créditos · 60 horas" (só o que for conhecido). */
export function creditsAndHours(
  credits?: number | null,
  workload?: number | null,
): string {
  return [
    credits != null ? plural(credits, 'crédito', 'créditos') : '',
    workload != null ? `${workload} horas` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
