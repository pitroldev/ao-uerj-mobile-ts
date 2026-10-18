import type { EnrollmentResultEntry } from '@root/modules/academics/domain/models';
import type {
  EnrollmentChange,
  ExpiringDocument,
  GradeChange,
  GradeKey,
  RidChange,
} from './changes';

/** Canais do Android (o aluno pode ajustar som e importância de cada um). */
type NotificationChannel =
  'class-reminders' | 'grades' | 'enrollment' | 'documents';

/** Tela aberta ao tocar no aviso. */
export type NotificationTarget = 'home' | 'documents';

export type NotificationContent = {
  /** Um aviso com o mesmo id substitui o anterior (por disciplina, por via). */
  id: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  /** Versão da tela de bloqueio quando o aparelho oculta conteúdo sensível. */
  publicTitle: string;
  publicBody: string;
  target: NotificationTarget;
};

const GRADE_NAMES: Record<GradeKey, string> = {
  p1: 'P1',
  p2: 'P2',
  pf: 'PF',
  result: 'média',
};

const PUBLIC_BODY = 'Toque para ver no AO UERJ.';

/** "8,5" como no app; a segunda casa só quando existe ("7,75" não vira "7,8"). */
function formatGrade(value: number): string {
  const digits = Math.round(value * 100) % 10 === 0 ? 1 : 2;
  return value.toFixed(digits).replace('.', ',');
}

/** "a P2", "a P2 e a média", "a P1, a P2 e a média". */
function joinPt(items: string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Todas as notas saíram agora, todas mudaram, ou um pouco de cada. */
function gradeKind(change: GradeChange): 'published' | 'updated' | 'mixed' {
  if (change.grades.every(grade => grade.previous === null)) return 'published';
  if (change.grades.every(grade => grade.previous !== null)) return 'updated';
  return 'mixed';
}

function gradeSummary(change: GradeChange): string {
  const names = change.grades.map(grade => `da ${GRADE_NAMES[grade.key]}`);
  const kind = gradeKind(change);
  const many = change.grades.length > 1;
  if (kind === 'published')
    return many
      ? `Saíram as notas ${joinPt(names)}.`
      : `Saiu a nota ${names[0]}.`;
  if (kind === 'updated')
    return many
      ? `As notas ${joinPt(names)} foram alteradas.`
      : `A nota ${names[0]} foi alterada.`;
  return `Notas novas ou alteradas: ${joinPt(
    change.grades.map(grade => GRADE_NAMES[grade.key]),
  )}.`;
}

function gradeValues(change: GradeChange): string {
  return change.grades
    .map(grade => {
      const name = GRADE_NAMES[grade.key];
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      const before =
        grade.previous === null
          ? ''
          : ` (antes ${formatGrade(grade.previous)})`;
      return `${label}: ${formatGrade(grade.value)}${before}`;
    })
    .join(' · ');
}

/** Nota nova ou alterada: sem `showValues`, o texto diz só a disciplina e a avaliação. */
export function gradeMessage(
  change: GradeChange,
  showValues: boolean,
): NotificationContent {
  const many = change.grades.length > 1;
  const kind = gradeKind(change);
  const title = {
    published: many ? 'Novas notas' : 'Nova nota',
    updated: many ? 'Notas alteradas' : 'Nota alterada',
    mixed: 'Notas novas e alteradas',
  }[kind];
  return {
    id: `grades:${change.subjectId}:${change.classNumber}`,
    channel: 'grades',
    title: `${title} em ${change.subjectName}`,
    body: showValues ? gradeValues(change) : gradeSummary(change),
    publicTitle:
      kind === 'published'
        ? 'Nova nota no Aluno Online'
        : 'Nota alterada no Aluno Online',
    publicBody: PUBLIC_BODY,
    target: 'home',
  };
}

function ridSummary(change: RidChange): string {
  const vacancies = `${change.available} ${
    change.available === 1 ? 'vaga' : 'vagas'
  }`;
  // a posição vai em número, como no app ("Sua posição: 12")
  if (change.position <= 0)
    return change.status ? `Sem posição: ${change.status}.` : 'Sem posição.';
  if (change.previousPosition === null)
    return `Sua posição: ${change.position}, com ${vacancies}.`;
  const status =
    change.statusChanged && change.status ? `Situação: ${change.status}.` : '';
  if (change.previousPosition !== change.position) {
    const from =
      change.previousPosition > 0
        ? `passou de ${change.previousPosition} para ${change.position}`
        : `agora é ${change.position}`;
    return [`Sua posição ${from}, com ${vacancies}.`, status]
      .filter(Boolean)
      .join(' ');
  }
  return status || 'Situação atualizada.';
}

export function ridMessage(change: RidChange): NotificationContent {
  return {
    id: `rid:${change.subjectId}:${change.classNumber}`,
    channel: 'enrollment',
    title: `RID: ${change.subjectName}`,
    body: ridSummary(change),
    publicTitle: 'RID atualizado',
    publicBody: PUBLIC_BODY,
    target: 'home',
  };
}

/** "Falta Requisito (CO/PRE)" → "falta requisito (CO/PRE)" (siglas ficam). */
function lowerReason(reason: string): string {
  return reason
    .split(' ')
    .map(word =>
      /[A-ZÀ-Ý]/.test(word) && word === word.toUpperCase()
        ? word
        : word.toLowerCase(),
    )
    .join(' ');
}

/**
 * Resultado da inscrição num aviso só, sempre inteiro: o aviso novo substitui
 * o anterior e o app não tem tela para o resultado, então o texto traz todas
 * as disciplinas (aceitas e não aceitas, com o motivo), não só as que mudaram.
 */
export function enrollmentMessage(
  result: readonly EnrollmentResultEntry[],
  changes: readonly EnrollmentChange[],
): NotificationContent {
  const subject = (entry: EnrollmentResultEntry) =>
    `${entry.name} (turma ${entry.classNumber})`;
  let body: string;
  if (result.length === 1) {
    const [entry] = result;
    body = entry.accepted
      ? `${subject(entry)}: inscrição aceita.`
      : `${subject(entry)}: inscrição não aceita${
          entry.reason ? `, ${lowerReason(entry.reason)}` : ''
        }.`;
  } else {
    const accepted = result.filter(entry => entry.accepted);
    const refused = result.filter(entry => !entry.accepted);
    body = [
      accepted.length
        ? `Aceitas: ${joinPt(accepted.map(entry => entry.name))}.`
        : '',
      refused.length
        ? refused.some(entry => entry.reason)
          ? `Não aceitas: ${refused
              .map(entry =>
                entry.reason
                  ? `${entry.name} — ${lowerReason(entry.reason)}`
                  : entry.name,
              )
              .join('; ')}.`
          : `Não aceitas: ${joinPt(refused.map(entry => entry.name))}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
  // parte do resultado já era conhecida: o aviso diz que ele mudou
  const updated = changes.length < result.length;
  return {
    id: 'enrollment:result',
    channel: 'enrollment',
    title: updated
      ? 'Resultado da inscrição atualizado'
      : 'Resultado da inscrição',
    body,
    publicTitle: 'Resultado da inscrição',
    // não há tela com o resultado: o texto completo fica no próprio aviso
    publicBody: 'Desbloqueie o aparelho para ver o resultado.',
    target: 'home',
  };
}

export function documentMessage({
  document,
  daysLeft,
}: ExpiringDocument): NotificationContent {
  const when =
    daysLeft === 0
      ? 'vence hoje'
      : daysLeft === 1
        ? 'vence amanhã'
        : `vence em ${daysLeft} dias`;
  return {
    id: `documents:${document.id}`,
    channel: 'documents',
    title: `Documento ${when}`,
    body: `${document.title}: válido até ${document.validUntil}.`,
    publicTitle: `Documento ${when}`,
    publicBody: PUBLIC_BODY,
    target: 'documents',
  };
}
