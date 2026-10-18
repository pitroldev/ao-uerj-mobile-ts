import type { UiTone } from '@components/ui/tones';
import {
  isPassingGrade,
  type FinalExamOutlook,
} from '@root/modules/academics/domain/rules/finalExam';
import { formatGrade } from '@utils/formatGrade';

/** "4,2" (uma casa, para cima já vem da regra). */
export function formatTenth(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/**
 * Próximo valor da simulação, de 0,5 em 0,5 e encaixando nos redondos
 * (4,2 → 4,5 → 5,0; 4,2 → 4,0), entre 0 e 10.
 */
export function stepGrade(value: number, direction: 1 | -1): number {
  const halves = value * 2;
  const next =
    direction > 0
      ? Math.floor(halves + 1e-9) + 1
      : Math.ceil(halves - 1e-9) - 1;
  return Math.min(10, Math.max(0, next / 2));
}

export type OutlookText = {
  label: string;
  tone: Extract<UiTone, 'good' | 'warn' | 'bad' | 'info'>;
};

/**
 * Rótulo da disciplina no quadro de notas: o que falta para passar por nota
 * ou, com a média final (lançada ou calculada), se ela aprova. `null` quando
 * não há o que dizer além da saúde da última nota (sem notas, ou PF lançada
 * sem uma das provas).
 */
export function outlookText(outlook: FinalExamOutlook): OutlookText | null {
  switch (outlook.kind) {
    case 'second-pending': {
      const exam = outlook.pending.toUpperCase();
      return outlook.forExemption !== null
        ? {
            label: `${formatTenth(outlook.forExemption)} na ${exam} dispensa a PF`,
            tone: 'info',
          }
        : {
            label: `Precisa de ${formatTenth(outlook.forFinalExam)} na ${exam} para ter PF`,
            tone: 'bad',
          };
    }
    case 'exempt':
      return { label: 'Dispensado da PF', tone: 'good' };
    case 'final-exam':
      return {
        label: `Precisa de ${formatTenth(outlook.needed)} na PF`,
        tone: outlook.needed > 5 ? 'bad' : 'warn',
      };
    case 'no-final-exam':
      return { label: 'Sem direito à PF', tone: 'bad' };
    case 'final-exam-done':
    case 'published':
      return {
        label: `Média final ${formatGrade(outlook.final)}`,
        tone: isPassingGrade(outlook.final) ? 'good' : 'bad',
      };
    default:
      return null;
  }
}
