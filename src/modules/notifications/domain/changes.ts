import type {
  ClassGrade,
  EnrollmentResultEntry,
  Grade,
  PartialRID,
} from '@root/modules/academics/domain/models';
import type { StudentDocument } from '@root/modules/documents/domain/models';

/**
 * O que mudou entre duas leituras do portal. A leitura anterior é a mesma que
 * o app mostra (o cache das consultas), então uma nota vista no app não volta
 * como aviso. Sem leitura anterior não há mudança: a primeira vira referência.
 */

export type GradeKey = keyof Grade;
const GRADE_KEYS: readonly GradeKey[] = ['p1', 'p2', 'pf', 'result'];

export type GradeChange = {
  subjectId: string;
  subjectName: string;
  classNumber: string;
  grades: { key: GradeKey; value: number; previous: number | null }[];
};

const isGrade = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const classKey = (id: string, classNumber: number | string) =>
  `${id}#${String(classNumber).trim()}`;

/** Notas que apareceram ou mudaram de valor (uma nota apagada não avisa). */
export function gradeChanges(
  previous: readonly ClassGrade[],
  current: readonly ClassGrade[],
): GradeChange[] {
  const before = new Map(
    previous.map(item => [classKey(item.id, item.class), item.grades]),
  );
  return current.flatMap(item => {
    const old = before.get(classKey(item.id, item.class));
    const grades = GRADE_KEYS.flatMap(key => {
      const value = item.grades[key];
      const previousValue = old?.[key];
      if (!isGrade(value)) return [];
      if (isGrade(previousValue) && previousValue === value) return [];
      return [
        {
          key,
          value,
          previous: isGrade(previousValue) ? previousValue : null,
        },
      ];
    });
    return grades.length
      ? [
          {
            subjectId: item.id,
            subjectName: item.name,
            classNumber: String(item.class).trim(),
            grades,
          },
        ]
      : [];
  });
}

export type RidChange = {
  subjectId: string;
  subjectName: string;
  classNumber: string;
  available: number;
  position: number;
  /** `null` quando a disciplina não estava na leitura anterior. */
  previousPosition: number | null;
  status: string;
  statusChanged: boolean;
};

const sameText = (left: string, right: string) =>
  left.replace(/\s+/g, ' ').trim().toLowerCase() ===
  right.replace(/\s+/g, ' ').trim().toLowerCase();

/** Posição ou situação nova no RID provisório, por disciplina e turma. */
export function ridChanges(
  previous: readonly PartialRID[],
  current: readonly PartialRID[],
): RidChange[] {
  const before = new Map(
    previous.map(item => [classKey(item.id, item.classNumber), item]),
  );
  return current.flatMap(item => {
    const old = before.get(classKey(item.id, item.classNumber));
    const statusChanged = Boolean(old && !sameText(old.status, item.status));
    if (old && old.position === item.position && !statusChanged) return [];
    return [
      {
        subjectId: item.id,
        subjectName: item.name,
        classNumber: String(item.classNumber).trim(),
        available: item.available,
        position: item.position,
        previousPosition: old ? old.position : null,
        status: item.status.replace(/\s+/g, ' ').trim(),
        statusChanged,
      },
    ];
  });
}

export type EnrollmentChange = Pick<
  EnrollmentResultEntry,
  'accepted' | 'reason' | 'classNumber'
> & { subjectId: string; subjectName: string };

/** Disciplina nova no resultado da inscrição, ou com aceite ou motivo novo. */
export function enrollmentChanges(
  previous: readonly EnrollmentResultEntry[],
  current: readonly EnrollmentResultEntry[],
): EnrollmentChange[] {
  const before = new Map(
    previous.map(item => [classKey(item.id, item.classNumber), item]),
  );
  return current.flatMap(item => {
    const old = before.get(classKey(item.id, item.classNumber));
    if (
      old &&
      old.accepted === item.accepted &&
      sameText(old.reason, item.reason)
    )
      return [];
    return [
      {
        subjectId: item.id,
        subjectName: item.name,
        classNumber: item.classNumber,
        accepted: item.accepted,
        reason: item.reason,
      },
    ];
  });
}

const DAY = 24 * 60 * 60 * 1000;

/** Dias de calendário de hoje até a validade "dd/mm/aaaa" (0 = vence hoje). */
export function daysUntilValidity(
  validUntil: string | null,
  now: number,
): number | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(validUntil ?? '');
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const end = new Date(year, month - 1, day);
  if (end.getDate() !== day || end.getMonth() !== month - 1) return null;
  const today = new Date(now);
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.round((end.getTime() - start.getTime()) / DAY);
}

export type ExpiringDocument = { document: StudentDocument; daysLeft: number };

/** Documentos emitidos que vencem nos próximos dias (os vencidos ficam de fora). */
export function expiringDocuments(
  documents: readonly StudentDocument[],
  now: number,
  withinDays: number,
): ExpiringDocument[] {
  return documents.flatMap(document => {
    if (!document.hasExistingDocument) return [];
    const daysLeft = daysUntilValidity(document.validUntil, now);
    if (daysLeft === null || daysLeft < 0 || daysLeft > withinDays) return [];
    return [{ document, daysLeft }];
  });
}

/** Identifica a via (tipo, revisão e validade): uma via nova pode avisar de novo. */
export function documentNoticeKey(document: StudentDocument): string {
  return `${document.id}|${document.revision ?? ''}|${document.validUntil ?? ''}`;
}
