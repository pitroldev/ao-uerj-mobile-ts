import type { Grade, SubjectsTaken } from '../models';
import {
  calculateCumulativeAverage,
  isGradedAttempt,
  sortAcademicPeriods,
} from './progress';
import { normalizeSubjectId } from './subjectId';

/**
 * Aprovação por nota no regime de créditos: art. 95 da Deliberação nº
 * 33/CSEPE/1995, transcrito em "Critérios de Avaliação (Crédito)" no Aluno
 * Online. A média semestral é a média das provas; com 7,0 ou mais o aluno fica
 * dispensado da PF (§ 3º); com 4,0 ou mais tem direito a ela (§ 2º); abaixo
 * disso, reprova, com ou sem PF (§ 7º). A nota final é a média aritmética
 * entre a semestral e a PF e aprova com 5,0 (caput). O regime seriado
 * (Deliberação nº 44/1979) tem outra conta e fica de fora.
 */
const CREDIT_SYSTEM = {
  passingGrade: 5,
  finalExamMinimum: 4,
  exemption: 7,
} as const;

/** Folga de ponto flutuante: 5,0 continua aprovando depois de (MS + PF) / 2. */
const EPSILON = 1e-9;

/**
 * Diferença tolerada entre a nota do quadro e a do histórico para tratá-las
 * como a mesma tentativa (o histórico pode mostrar uma casa só).
 */
const SAME_GRADE = 0.05 + EPSILON;

export type FinalExamOutlook =
  | { kind: 'no-grades' }
  /**
   * Só uma das provas lançada: a nota que a outra precisa ter para dispensar
   * a PF (`null` quando nem 10 basta) e para dar direito a ela.
   */
  | {
      kind: 'second-pending';
      pending: 'p1' | 'p2';
      forExemption: number | null;
      forFinalExam: number;
    }
  /** PF lançada sem uma das provas: não há média semestral para a conta. */
  | { kind: 'incomplete' }
  | { kind: 'exempt'; average: number }
  | { kind: 'final-exam'; average: number; needed: number }
  | { kind: 'no-final-exam'; average: number }
  | { kind: 'final-exam-done'; average: number; exam: number; final: number }
  /** Média já lançada pelo portal. */
  | { kind: 'published'; final: number };

function isGrade(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Arredonda para cima na primeira casa: a nota que basta, nunca uma a menos. */
function ceilTenth(value: number): number {
  return Math.max(0, Math.ceil(value * 10 - EPSILON) / 10);
}

function semesterAverage(first: number, second: number): number {
  return (first + second) / 2;
}

export function finalGrade(average: number, exam: number): number {
  return (average + exam) / 2;
}

export function isPassingGrade(grade: number): boolean {
  return grade >= CREDIT_SYSTEM.passingGrade - EPSILON;
}

/** A menor PF (com uma casa) que leva a nota final a 5,0. */
export function neededFinalExam(average: number): number {
  return ceilTenth(2 * CREDIT_SYSTEM.passingGrade - average);
}

/** O que falta em cada disciplina, pelas notas do quadro do período. */
export function finalExamOutlook(grade: Grade): FinalExamOutlook {
  const { p1, p2, pf, result } = grade;
  if (isGrade(result)) return { kind: 'published', final: result };
  if (isGrade(p1) && isGrade(p2)) {
    const average = semesterAverage(p1, p2);
    // § 7º: abaixo de 4,0 reprova, mesmo que uma PF apareça lançada
    if (average < CREDIT_SYSTEM.finalExamMinimum - EPSILON) {
      return { kind: 'no-final-exam', average };
    }
    if (isGrade(pf)) {
      // § 4º: mesmo dispensado, quem faz a PF entra na média com ela
      return {
        kind: 'final-exam-done',
        average,
        exam: pf,
        final: finalGrade(average, pf),
      };
    }
    if (average >= CREDIT_SYSTEM.exemption - EPSILON) {
      return { kind: 'exempt', average };
    }
    return { kind: 'final-exam', average, needed: neededFinalExam(average) };
  }
  if (isGrade(pf)) return { kind: 'incomplete' };
  if (isGrade(p1) || isGrade(p2)) {
    const known = isGrade(p1) ? p1 : (p2 as number);
    const forExemption = ceilTenth(2 * CREDIT_SYSTEM.exemption - known);
    return {
      kind: 'second-pending',
      pending: isGrade(p1) ? 'p2' : 'p1',
      forExemption: forExemption <= 10 ? forExemption : null,
      forFinalExam: ceilTenth(2 * CREDIT_SYSTEM.finalExamMinimum - known),
    };
  }
  return { kind: 'no-grades' };
}

/**
 * A nota final que entra no CR: a publicada, a da PF lançada, a média
 * semestral (dispensado ou sem direito à PF) ou a da PF simulada.
 */
export function projectedFinal(
  outlook: FinalExamOutlook,
  simulatedExam?: number,
): number | null {
  switch (outlook.kind) {
    case 'published':
    case 'final-exam-done':
      return outlook.final;
    case 'exempt':
    case 'no-final-exam':
      return outlook.average;
    case 'final-exam':
      return simulatedExam === undefined
        ? null
        : finalGrade(outlook.average, simulatedExam);
    default:
      return null;
  }
}

function subjectKey(id: string): string | null {
  try {
    return normalizeSubjectId(id);
  } catch {
    return null;
  }
}

/** Nota final de uma disciplina do período, para o CR. */
export type PeriodFinal = {
  grade: number;
  /** Vem de uma PF simulada, e não das notas do portal. */
  simulated: boolean;
};

export type CumulativeProjection = {
  /** CR aproximado de agora; `null` sem nenhuma nota com créditos. */
  current: number | null;
  /** Com as notas do período; `null` se nada entra na conta. */
  projected: number | null;
  /** Disciplinas do período que entram na conta (código numérico). */
  counted: string[];
  /** Disciplinas sem créditos conhecidos, que ficam de fora. */
  missing: string[];
};

function cumulativeAverage(subjects: readonly SubjectsTaken[]): number | null {
  return subjects.some(isGradedAttempt)
    ? calculateCumulativeAverage(subjects)
    : null;
}

/**
 * CR aproximado de agora e o projetado com as notas finais do período
 * (`finals`, pelo código numérico da disciplina), pela mesma regra do app
 * (`calculateCumulativeAverage`): cada disciplina do período entra como uma
 * tentativa a mais, com os créditos de `credits`. Disciplina sem créditos
 * conhecidos fica em `missing`; com 0 crédito, fica de fora, como no CR.
 *
 * A tentativa deste período que o histórico já traz é trocada pela do quadro,
 * para não contar duas vezes: a linha em curso e, com o período encerrado, a
 * linha de `period` (o do cabeçalho do portal). Sem ele, vale a linha do
 * último período do histórico com a mesma nota que o portal lançou.
 */
export function projectCumulativeAverage(
  history: readonly SubjectsTaken[],
  finals: ReadonlyMap<string, PeriodFinal>,
  credits: ReadonlyMap<string, number | null | undefined>,
  period?: string,
): CumulativeProjection {
  const counted: string[] = [];
  const missing: string[] = [];
  const attempts: SubjectsTaken[] = [];
  const replaced = new Map<string, PeriodFinal>();
  for (const [key, final] of finals) {
    const value = credits.get(key);
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      missing.push(key);
      continue;
    }
    if (value === 0) continue;
    counted.push(key);
    replaced.set(key, final);
    attempts.push({
      id: key,
      name: key,
      period: 'simulação',
      credits: value,
      workload: null,
      type: 'MANDATORY',
      frequency: null,
      grade: final.grade,
      status: isPassingGrade(final.grade) ? 'APPROVED' : 'FAILED_BY_GRADE',
    });
  }
  const periods = sortAcademicPeriods(history.map(subject => subject.period));
  const latest = periods[periods.length - 1];
  const isThisAttempt = (subject: SubjectsTaken, final: PeriodFinal) => {
    if (subject.status === 'IN_PROGRESS') return true;
    if (period) return subject.period === period;
    return (
      !final.simulated &&
      subject.period === latest &&
      isGrade(subject.grade) &&
      Math.abs(subject.grade - final.grade) <= SAME_GRADE
    );
  };
  const kept = history.filter(subject => {
    const key = subjectKey(subject.id);
    const final = key === null ? undefined : replaced.get(key);
    return final === undefined || !isThisAttempt(subject, final);
  });
  return {
    current: cumulativeAverage(history),
    projected: cumulativeAverage([...kept, ...attempts]),
    counted,
    missing,
  };
}
