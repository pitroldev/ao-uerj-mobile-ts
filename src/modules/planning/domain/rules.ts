import {
  Horario,
  Prereq,
  SubjectsTaken,
  SubjectInfo,
  CurriculumSubject,
  SubjectClassesSchedule,
} from '@root/modules/academics/domain/models';
import { normalizeSubjectId } from '@root/modules/academics/domain/rules/subjectId';
import { completedSubjectIds } from '@root/modules/academics/domain/rules/completion';
import { TIME_DICTIONARY } from '@utils/constants/time';
import { daysWithoutLunch, type LunchBreak } from './lunch';
import { Schedule, SubjectClasses } from './models';
import { AppError } from '@root/shared/errors/AppError';

export const MAX_CLASSES_AMOUNT = 30;
const days = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
];
export function academicWeekdayToPlanningDay(day: number): number {
  return day - 1;
}

export function scheduleIntervals(schedules: readonly Horario[]): Schedule[] {
  return schedules.flatMap(schedule =>
    Object.entries(schedule).flatMap(([day, slots]) =>
      (slots ?? []).flatMap(group => {
        if (!group.length) return [];
        const first = TIME_DICTIONARY[group[0]];
        const last = TIME_DICTIONARY[group[group.length - 1]];
        const toMinutes = (time: string) => {
          const [hour, minute] = time.split(':').map(Number);
          return hour * 60 + minute;
        };
        const weekDay = days.indexOf(day);
        if (!first || !last || weekDay < 0)
          throw new AppError('INVALID_INPUT', 'Horário de turma inválido.');
        return [
          {
            week_day: weekDay,
            start_time_in_minutes: toMinutes(first[0]),
            end_time_in_minutes: toMinutes(last[1]),
          },
        ];
      }),
    ),
  );
}

export function hasScheduleConflict(
  target: readonly Schedule[],
  current: readonly Schedule[],
): boolean {
  return current.some(left =>
    target.some(
      right =>
        left.week_day === right.week_day &&
        left.start_time_in_minutes < right.end_time_in_minutes &&
        right.start_time_in_minutes < left.end_time_in_minutes,
    ),
  );
}

function completedSubjects(history: readonly SubjectsTaken[]) {
  return [
    ...new Map(
      history
        .filter(
          subject =>
            subject.status === 'APPROVED' || subject.status === 'EXEMPT',
        )
        .map(subject => [normalizeSubjectId(subject.id), subject]),
    ).values(),
  ];
}

/** Each row is an OR group; all non-credit rows must be satisfied (AND). */
export function prerequisitesSatisfied(
  groups: readonly Prereq[][],
  history: readonly SubjectsTaken[],
  curriculum: readonly CurriculumSubject[] = [],
): boolean {
  const completed = completedSubjectIds(history, curriculum);
  return groups
    .filter(
      group => group.length && !group[0].id.toUpperCase().includes('TRAVA'),
    )
    .every(group =>
      group.some(prerequisite =>
        completed.has(normalizeSubjectId(prerequisite.id)),
      ),
    );
}

/**
 * Os pré-requisitos que faltam, um texto por exigência; onde o portal aceita
 * alternativas, "A ou B".
 */
export function missingPrerequisites(
  groups: readonly Prereq[][],
  history: readonly SubjectsTaken[],
  curriculum: readonly CurriculumSubject[] = [],
): string[] {
  const completed = completedSubjectIds(history, curriculum);
  return groups
    .filter(
      group =>
        group.length &&
        !group[0].id.toUpperCase().includes('TRAVA') &&
        !group.some(item => completed.has(normalizeSubjectId(item.id))),
    )
    .map(group => group.map(item => item.name || item.id).join(' ou '));
}

/**
 * Por que o aluno ainda não pode cursar a disciplina, do jeito que ele fala:
 * "Falta cursar antes: Cálculo I" ou "Exige 140 créditos cursados".
 */
export function refusalText(
  curriculum: CurriculumSubject,
  details: SubjectInfo,
  history: readonly SubjectsTaken[],
  completedCurriculum: readonly CurriculumSubject[] = [],
): string {
  const missing = missingPrerequisites(
    details.prerequisite ?? [],
    history,
    completedCurriculum,
  );
  if (missing.length) return `Falta cursar antes: ${missing.join('; ')}`;
  return curriculum.minimum_credits
    ? `Exige ${curriculum.minimum_credits} créditos cursados`
    : 'Você ainda não pode cursar esta disciplina';
}

export function subjectEligibility(
  curriculum: CurriculumSubject,
  details: SubjectInfo,
  history: readonly SubjectsTaken[],
  completedCurriculum: readonly CurriculumSubject[] = [],
) {
  const hasPrerequisites = prerequisitesSatisfied(
    details.prerequisite ?? [],
    history,
    completedCurriculum,
  );
  const credits = completedSubjects(history).reduce(
    (sum, subject) =>
      sum +
      (Number.isFinite(subject.credits)
        ? Math.max(0, subject.credits ?? 0)
        : 0),
    0,
  );
  const hasCredits = credits >= (curriculum.minimum_credits ?? 0);
  return {
    eligible: hasPrerequisites && hasCredits,
    reason: !hasPrerequisites
      ? 'Você não possui os pré-requisitos necessários.'
      : !hasCredits
        ? 'Você não possui créditos suficientes.'
        : null,
  };
}

/** Os horários ocupados em que a turma tem aula; vazio, ela cabe na agenda. */
export function busyClashes(
  group: Pick<SubjectClassesSchedule, 'schedule'>,
  busy: readonly Schedule[],
): Schedule[] {
  const intervals = scheduleIntervals(group.schedule ?? []);
  return busy.filter(slot => hasScheduleConflict([slot], intervals));
}

/**
 * Por que uma turma não pode entrar em grade nenhuma com a rotina do aluno:
 * tem aula num horário ocupado ou, sozinha, já não deixa o almoço.
 */
export type ClassBlock =
  { kind: 'BUSY'; clashes: Schedule[] } | { kind: 'LUNCH'; days: number[] };

export function classBlock(
  group: Pick<SubjectClassesSchedule, 'schedule'>,
  busy: readonly Schedule[],
  lunch?: LunchBreak | null,
): ClassBlock | null {
  const clashes = busyClashes(group, busy);
  if (clashes.length) return { kind: 'BUSY', clashes };
  if (!lunch) return null;
  const without = daysWithoutLunch(
    scheduleIntervals(group.schedule ?? []),
    lunch,
  );
  return without.length ? { kind: 'LUNCH', days: without } : null;
}

/** As turmas que cabem na rotina (horários ocupados e almoço). */
export function availableClasses(
  subjects: readonly SubjectInfo[],
  busy: readonly Schedule[],
  lunch?: LunchBreak | null,
): SubjectClasses[] {
  return subjects.flatMap(subject =>
    (subject.classes ?? [])
      .filter(group => !classBlock(group, busy, lunch))
      .map(group => ({ ...group, subject_id: subject.id! })),
  );
}

/** Quantas turmas a disciplina tem e quantas cabem na rotina do aluno. */
export type SubjectFit = {
  id: string;
  name: string;
  classes: number;
  free: number;
};

export function routineFit(
  subjects: readonly SubjectInfo[],
  busy: readonly Schedule[],
  lunch?: LunchBreak | null,
): SubjectFit[] {
  return subjects.map(subject => {
    const classes = subject.classes ?? [];
    return {
      id: subject.id ?? '',
      name: subject.name ?? subject.id ?? '',
      classes: classes.length,
      free: classes.filter(group => !classBlock(group, busy, lunch)).length,
    };
  });
}

/**
 * Por que a grade não alcança o mínimo de disciplinas:
 * - `SUBJECTS`: poucas das disciplinas escolhidas têm turma;
 * - `ROUTINE`: as turmas que faltam batem com os horários ocupados (ou não
 *   deixam o almoço);
 * - `SELECTION`: o aluno tirou turmas de disciplinas demais.
 */
export type ShortfallReason = 'SUBJECTS' | 'ROUTINE' | 'SELECTION';

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** ", e você pediu no mínimo 6": só quando o aluno pediu mais de uma. */
const asked = (minimum: number) =>
  minimum > 1 ? `, e você pediu no mínimo ${minimum}` : '';

/**
 * "Só 1 de 7 disciplinas tem turma fora dos horários que você marcou como
 * ocupados."
 */
function routineShortText(
  free: number,
  total: number,
  minimum = 1,
  withLunch = false,
): string {
  const subject =
    free > 0
      ? `Só ${free} de ${total} disciplinas ${free === 1 ? 'tem' : 'têm'}`
      : total === 1
        ? 'A disciplina não tem'
        : `Nenhuma das ${total} disciplinas tem`;
  const routine = withLunch
    ? 'fora dos horários que você marcou como ocupados e do almoço'
    : 'fora dos horários que você marcou como ocupados';
  return `${subject} turma ${routine}${asked(minimum)}.`;
}

function shortfallText(
  reason: ShortfallReason,
  available: number,
  total: number,
  minimum: number,
  withLunch: boolean,
): string {
  switch (reason) {
    case 'SUBJECTS':
      return `${
        available === 0
          ? 'Nenhuma das disciplinas escolhidas pode'
          : `Só ${count(available, 'das disciplinas escolhidas pode', 'das disciplinas escolhidas podem')}`
      } entrar na grade${asked(minimum)}. Escolha outras disciplinas.`;
    case 'ROUTINE':
      return `${routineShortText(available, total, minimum, withLunch)} Libere algum horário.`;
    case 'SELECTION':
      return available === 0
        ? 'Você tirou todas as turmas. Marque alguma para gerar a grade.'
        : `As turmas marcadas são de só ${count(available, 'disciplina', 'disciplinas')}${asked(minimum)}. Marque turmas de mais disciplinas.`;
  }
}

/** A grade não alcança o mínimo; a mensagem diz o porquê e o que mudar. */
export class SubjectShortfall extends AppError {
  constructor(
    readonly reason: ShortfallReason,
    /** Quantas disciplinas ainda dão (com turma, na rotina ou marcadas). */
    readonly available: number,
    /** Quantas disciplinas foram consideradas. */
    readonly total: number,
    readonly minimum: number,
    withLunch = false,
  ) {
    super(
      'INVALID_INPUT',
      shortfallText(reason, available, total, minimum, withLunch),
    );
    this.name = 'SubjectShortfall';
  }
}

/** Turmas demais para o gerador combinar de uma vez. */
export class TooManyClasses extends AppError {
  constructor(
    readonly selected: number,
    readonly limit: number = MAX_CLASSES_AMOUNT,
  ) {
    super(
      'INVALID_INPUT',
      `São ${selected} turmas, e o gerador combina até ${limit} de cada vez. Tire ${count(selected - limit, 'turma', 'turmas')} ou alguma disciplina.`,
    );
    this.name = 'TooManyClasses';
  }
}

/**
 * A falta de disciplinas para o mínimo, contando só as turmas marcadas que
 * cabem na rotina; `null` quando dá para gerar.
 */
export function subjectShortfall({
  minimum,
  subjects,
  selectedClasses,
  busy,
  lunch,
}: {
  minimum: number;
  subjects: readonly SubjectInfo[];
  selectedClasses: readonly SubjectClasses[];
  busy: readonly Schedule[];
  lunch?: LunchBreak | null;
}): SubjectShortfall | null {
  const covered = new Set(
    selectedClasses
      .filter(group => !classBlock(group, busy, lunch))
      .map(group => group.subject_id),
  ).size;
  if (covered >= minimum) return null;
  const withLunch = Boolean(lunch);
  const fit = routineFit(subjects, busy, lunch).filter(
    subject => subject.classes > 0,
  );
  if (fit.length < minimum)
    return new SubjectShortfall('SUBJECTS', fit.length, fit.length, minimum);
  const free = fit.filter(subject => subject.free > 0).length;
  if (free < minimum)
    return new SubjectShortfall(
      'ROUTINE',
      free,
      fit.length,
      minimum,
      withLunch,
    );
  return new SubjectShortfall('SELECTION', covered, fit.length, minimum);
}
