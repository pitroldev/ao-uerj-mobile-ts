import type {
  ClassGrade,
  EnrollmentResultEntry,
  Grade,
  PartialRID,
} from '@root/modules/academics/domain/models';
import type { StudentDocument } from '@root/modules/documents/domain/models';

/**
 * O que mudou numa leitura do portal em relação à referência: o último valor
 * conhecido de cada nota, de cada pedido no RID e de cada disciplina no
 * resultado da inscrição. A referência soma o que o app mostrou (o cache das
 * consultas, então uma nota vista no app não volta como aviso) e o que a
 * verificação leu; uma leitura vazia ou em branco não apaga nada dela. Sem
 * leitura anterior não há mudança: a primeira vira referência.
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

/** Último valor de cada nota, por disciplina e turma (`id#turma`). */
type KnownGrades = Record<string, Partial<Record<GradeKey, number>>>;
/** Última posição e situação de cada pedido no RID Parcial. */
type KnownRid = Record<string, Pick<PartialRID, 'position' | 'status'>>;
/** Último aceite e motivo de cada disciplina no resultado da inscrição. */
type KnownEnrollment = Record<
  string,
  Pick<EnrollmentResultEntry, 'accepted' | 'reason'>
>;

/** Referência dos avisos do portal num período (a de outro período não vale). */
export type KnownReadings = {
  period: string;
  grades: KnownGrades;
  rid: KnownRid;
  enrollment: KnownEnrollment;
};

/** Soma uma leitura de notas à referência: nota em branco não apaga a conhecida. */
export function knowGrades(
  known: KnownGrades,
  reading: readonly ClassGrade[],
): KnownGrades {
  const next = { ...known };
  reading.forEach(item => {
    const key = classKey(item.id, item.class);
    const values = { ...next[key] };
    GRADE_KEYS.forEach(grade => {
      const value = item.grades[grade];
      if (isGrade(value)) values[grade] = value;
    });
    if (Object.keys(values).length) next[key] = values;
  });
  return next;
}

/** Soma uma leitura do RID à referência: o pedido que some continua conhecido. */
export function knowRid(
  known: KnownRid,
  reading: readonly PartialRID[],
): KnownRid {
  const next = { ...known };
  reading.forEach(item => {
    next[classKey(item.id, item.classNumber)] = {
      position: item.position,
      status: item.status,
    };
  });
  return next;
}

/** Soma uma leitura do resultado da inscrição à referência. */
export function knowEnrollment(
  known: KnownEnrollment,
  reading: readonly EnrollmentResultEntry[],
): KnownEnrollment {
  const next = { ...known };
  reading.forEach(item => {
    next[classKey(item.id, item.classNumber)] = {
      accepted: item.accepted,
      reason: item.reason,
    };
  });
  return next;
}

const record = (raw: unknown): Record<string, unknown> =>
  raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

/** As entradas salvas que `read` aceita; as outras ficam de fora. */
function entries<T>(
  raw: unknown,
  read: (value: Record<string, unknown>) => T | null,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record(raw)).flatMap(([key, value]) => {
      const entry = read(record(value));
      return entry === null ? [] : [[key, entry] as const];
    }),
  );
}

/** Lê a referência salva sem confiar no formato; sem período, não há. */
export function normalizeKnownReadings(raw: unknown): KnownReadings | null {
  const value = record(raw);
  if (typeof value.period !== 'string') return null;
  return {
    period: value.period,
    grades: entries(value.grades, grades => {
      const kept = GRADE_KEYS.flatMap(key => {
        const grade = grades[key];
        return isGrade(grade) ? [[key, grade] as const] : [];
      });
      return kept.length ? Object.fromEntries(kept) : null;
    }),
    rid: entries(value.rid, ({ position, status }) =>
      typeof position === 'number' &&
      Number.isFinite(position) &&
      typeof status === 'string'
        ? { position, status }
        : null,
    ),
    enrollment: entries(value.enrollment, ({ accepted, reason }) =>
      typeof accepted === 'boolean' && typeof reason === 'string'
        ? { accepted, reason }
        : null,
    ),
  };
}

/** Notas que apareceram ou mudaram de valor (uma nota apagada não avisa). */
export function gradeChanges(
  known: KnownGrades,
  current: readonly ClassGrade[],
): GradeChange[] {
  return current.flatMap(item => {
    const old = known[classKey(item.id, item.class)];
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
  /** `null` quando o pedido não estava na referência. */
  previousPosition: number | null;
  status: string;
  statusChanged: boolean;
};

const sameText = (left: string, right: string) =>
  left.replace(/\s+/g, ' ').trim().toLowerCase() ===
  right.replace(/\s+/g, ' ').trim().toLowerCase();

/** Posição ou situação nova no RID Parcial, por disciplina e turma. */
export function ridChanges(
  known: KnownRid,
  current: readonly PartialRID[],
): RidChange[] {
  return current.flatMap(item => {
    const old = known[classKey(item.id, item.classNumber)];
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
> & {
  subjectId: string;
  subjectName: string;
  /** `null` quando a disciplina não estava na referência. */
  previous: Pick<EnrollmentResultEntry, 'accepted' | 'reason'> | null;
};

/** Disciplina nova no resultado da inscrição, ou com aceite ou motivo novo. */
export function enrollmentChanges(
  known: KnownEnrollment,
  current: readonly EnrollmentResultEntry[],
): EnrollmentChange[] {
  return current.flatMap(item => {
    const old = known[classKey(item.id, item.classNumber)];
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
        previous: old ? { accepted: old.accepted, reason: old.reason } : null,
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
