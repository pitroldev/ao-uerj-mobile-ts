/**
 * A grade gerada como imagem para compartilhar: o mesmo pôster da grade do
 * período (`drawWeekImage`), com o título "Grade planejada", os créditos e,
 * quando o portal informa, a sala de cada turma.
 */
import type { SubjectInfo } from '@root/modules/academics/domain/models';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import {
  classKey,
  type GeneratedClassWithSubject,
  type Schedule,
} from '@root/modules/planning/domain/models';

import {
  drawWeekImage,
  roomOf,
  type WeekImageClass,
} from '../AttendedClassesSchedule/weekImage/weekImage';

/** O intervalo entre dois tempos da mesma aula (M2 → M3 tem 10 minutos). */
const SAME_CLASS_GAP = 10;

/** "7:00". */
const clock = (minutes: number) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/** Os encontros do mesmo dia, um tempo atrás do outro, viram uma aula só. */
function joinMeetings(schedules: readonly Schedule[]): Schedule[] {
  const sorted = [...schedules].sort(
    (a, b) =>
      a.week_day - b.week_day ||
      a.start_time_in_minutes - b.start_time_in_minutes,
  );
  const joined: Schedule[] = [];
  for (const meeting of sorted) {
    const last = joined[joined.length - 1];
    if (
      last &&
      last.week_day === meeting.week_day &&
      meeting.start_time_in_minutes - last.end_time_in_minutes <= SAME_CLASS_GAP
    ) {
      last.end_time_in_minutes = Math.max(
        last.end_time_in_minutes,
        meeting.end_time_in_minutes,
      );
    } else joined.push({ ...meeting });
  }
  return joined;
}

/** A sala de cada turma (`classKey`), pelo que o portal disse das disciplinas. */
export function roomsOf(subjects: readonly SubjectInfo[]): Map<string, string> {
  const rooms = new Map<string, string>();
  for (const subject of subjects) {
    for (const group of subject.classes ?? []) {
      const room = roomOf(group.location);
      if (subject.id && room)
        rooms.set(
          classKey({ subject_id: subject.id, classNumber: group.classNumber }),
          room,
        );
    }
  }
  return rooms;
}

export type PlanImageOptions = {
  /** Sala de cada turma, pela `classKey`. */
  rooms?: ReadonlyMap<string, string>;
  credits?: number;
  /** O rodapé diz onde baixar (só onde o app está numa loja). */
  store?: boolean;
};

/** SVG da grade gerada (1080 de largura). */
export function buildPlanImage(
  grade: readonly GeneratedClassWithSubject[],
  { rooms, credits, store }: PlanImageOptions = {},
): string {
  const teachers = new Map<string, readonly string[]>();
  const classes: WeekImageClass[] = grade.flatMap(item => {
    const key = subjectKey(item.subject_id);
    if (item.teachers.length) teachers.set(key, item.teachers);
    const room =
      rooms?.get(
        classKey({
          subject_id: item.subject_id,
          classNumber: Number(item.id),
        }),
      ) ?? null;
    return joinMeetings(item.schedules).map(meeting => ({
      key,
      code: item.subject.id,
      name: item.name,
      turma: String(item.id).trim(),
      // no gerador, 0 é segunda; na imagem, 1
      day: meeting.week_day + 1,
      start: meeting.start_time_in_minutes,
      end: meeting.end_time_in_minutes,
      hours: `${clock(meeting.start_time_in_minutes)}–${clock(meeting.end_time_in_minutes)}`,
      room,
    }));
  });
  return drawWeekImage(classes, {
    title: 'Grade planejada',
    credits,
    teachers,
    store,
  });
}
