import React, { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  useAnimatedValue,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'styled-components/native';

import {
  Button,
  DayTimeline,
  Notice,
  Section,
  SHIFT_LABEL,
  StatusLabel,
  Tag,
  Text,
  snackbar,
  useReducedMotion,
  WeekDaySelector,
  type TimelineEvent,
  type WeekDayItem,
} from '@components/ui';
import { nextWeekdayIndex } from '@root/modules/academics/domain/rules/schedule';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  absenceKey,
  toIsoDate,
} from '@root/modules/attendance/domain/attendance';
import { useScheduleSharing } from '@root/modules/academics/presentation/useScheduleSharing';
import { toSvgDataUri } from '@root/modules/academics/presentation/scheduleSvg';
import {
  useSubjectTeachers,
  type SubjectTeachers,
} from '@root/modules/academics/presentation/useSubjectTeachers';

import {
  CLASS_DAYS,
  clockLabel,
  dateLabel,
  hasClassTime,
  isCanceled,
  minutesOfDay,
  plural,
  shiftOf,
  slotRange,
  splitLocation,
  timeRange,
  WEEKDAY_SHORT,
  weekDates,
  weekdayOf,
} from '../scheduleFormat';
import {
  classEvaluation,
  evaluationsOn,
  type Evaluation,
} from '@root/modules/evaluations/domain/evaluations';
import {
  evaluationName,
  evaluationTitle,
  TYPE_LABEL,
  whenText,
} from '@root/modules/evaluations/presentation/evaluationText';
import { buildWeekImage } from '../weekImage/weekImage';
import {
  DayAction,
  DayHead,
  DayLine,
  DayNotice,
  DayTitle,
  DayView,
} from './ClassScheduleBoard.styles';

type Props = {
  data: AttendedClassesSchedule[];
  /** Hora atual (linha de agora, "Hoje", aulas encerradas). */
  now: Date;
  /** Toque numa aula: abre "Disciplinas em Curso". */
  onSubjectPress: (item: AttendedClassesSchedule) => void;
  /** Aulas com falta marcada (`absenceKey`): o rótulo vira "Falta". */
  absences?: ReadonlySet<string>;
  /**
   * Toque numa aula que já terminou (de hoje ou de um dia anterior da semana
   * mostrada): abre as faltas da disciplina naquela aula.
   */
  onEndedClassPress?: (item: AttendedClassesSchedule, date: Date) => void;
  /** Período ("2026.1") no título da imagem compartilhada. */
  period?: string;
  /** Provas e trabalhos anotados: marca no dia, aviso no topo e na aula. */
  evaluations?: readonly Evaluation[];
  /** Toque numa avaliação do dia: abre a edição. */
  onEvaluationPress?: (evaluation: Evaluation) => void;
  /** "Avaliação" no dia mostrado (de hoje em diante): anota naquele dia. */
  onAddEvaluation?: (date: string) => void;
};

const NO_ABSENCES: ReadonlySet<string> = new Set();
const NO_EVALUATIONS: readonly Evaluation[] = [];
/** A observação no aviso do dia fica curta: a completa está na folha. */
const NOTE_PREVIEW = 120;

function preview(note: string): string {
  const text = note.trim().replace(/\s+/g, ' ');
  return text.length > NOTE_PREVIEW
    ? `${text.slice(0, NOTE_PREVIEW - 1).trimEnd()}…`
    : text;
}
const NO_TEACHERS: SubjectTeachers = new Map();

/** Dois quadros: o SVG novo já está desenhado quando a captura acontece. */
const nextPaint = () =>
  new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

/** Escala padrão da régua: 48dp por hora. */
const BASE_PX_PER_MINUTE = 0.8;

/**
 * Semana: seletor de dias (Seg–Sáb, hoje em acento, ponto nos dias com aula)
 * e o dia escolhido como régua de horas, com intervalos livres, linha de
 * agora e aulas encerradas (as de hoje que já acabaram e as dos dias
 * anteriores da semana), com "Falta" onde o aluno marcou. "Compartilhar
 * grade" gera a imagem da semana.
 */
export const ClassScheduleBoard = React.memo(function ClassScheduleBoard({
  data,
  now,
  onSubjectPress,
  absences = NO_ABSENCES,
  onEndedClassPress,
  period,
  evaluations = NO_EVALUATIONS,
  onEvaluationPress,
  onAddEvaluation,
}: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const safeData = useMemo(() => (data ?? []).filter(hasClassTime), [data]);
  const { share, exporting, SvgRenderer } = useScheduleSharing();
  const loadTeachers = useSubjectTeachers();
  const [teachers, setTeachers] = useState<SubjectTeachers>(NO_TEACHERS);
  const [preparing, setPreparing] = useState(false);
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const fade = useAnimatedValue(1);

  const svgString = useMemo(
    () => buildWeekImage(safeData, { period, teachers }),
    [period, safeData, teachers],
  );

  const today = now.getDay();
  const isClassDay = today !== 0;
  const classDays = [...new Set(safeData.map(weekdayOf))].sort((a, b) => a - b);
  const defaultDay = classDays.length
    ? classDays[nextWeekdayIndex(classDays, today)]
    : 1;
  const selected = pickedDay ?? defaultDay;

  const fadeStyle = useMemo(
    () => ({
      opacity: fade,
      transform: [
        {
          translateY: fade.interpolate({
            inputRange: [0, 1],
            outputRange: [4, 0],
          }),
        },
      ],
    }),
    [fade],
  );

  // Troca de dia pelo aluno: o conteúdo entra com um leve esmaecer. Só no
  // toque — a chegada dos dados (que muda o dia padrão) não anima. Roda em JS:
  // com o driver nativo no Fabric o valor final às vezes não chegava à view,
  // e a linha do tempo ficava invisível.
  const handleSelect = useCallback(
    (day: number) => {
      setPickedDay(day);
      if (reduced) return;
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: theme.motion.fast,
        easing: Easing.bezier(...theme.motion.easing),
        useNativeDriver: false,
      }).start();
    },
    [fade, reduced, theme.motion],
  );

  if (classDays.length === 0) {
    return null;
  }

  const dates = weekDates(now);
  const days: WeekDayItem[] = CLASS_DAYS.map(day => {
    const date = dates.get(day) as Date;
    const hasEvents = safeData.some(item => weekdayOf(item) === day);
    const isToday = isClassDay && day === today;
    const marked = evaluationsOn(evaluations, toIsoDate(date)).length;
    return {
      key: day,
      short: WEEKDAY_SHORT[day],
      date: date.getDate(),
      hasEvents,
      flagged: marked > 0,
      isToday,
      accessibilityLabel: `${dateLabel(date)}${isToday ? ', hoje' : ''}${
        hasEvents ? '' : ', sem aulas'
      }${marked ? `, ${plural(marked, 'avaliação', 'avaliações')}` : ''}`,
    };
  });

  const selectedDate = dates.get(selected) ?? now;
  const selectedIsToday = isClassDay && selected === today;
  const nowMinutes = minutesOfDay(now);
  const selectedDay = toIsoDate(selectedDate);
  // a semana mostrada é a atual (no domingo, a seguinte): dia anterior a hoje
  const selectedIsPast = selectedDay < toIsoDate(now);
  const dayItems = safeData
    .filter(item => weekdayOf(item) === selected)
    .sort((a, b) => a.start_time_in_minutes - b.start_time_in_minutes);
  const dayEvaluations = evaluationsOn(evaluations, selectedDay);
  // sem aula nem avaliação, a régua vazia já diz tudo
  const dayCount = [
    dayItems.length ? plural(dayItems.length, 'aula', 'aulas') : null,
    !dayItems.length && dayEvaluations.length ? 'Sem aulas' : null,
    dayEvaluations.length
      ? plural(dayEvaluations.length, 'avaliação', 'avaliações')
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Aulas de um tempo só (50 min) precisam de mais altura para as duas
  // linhas; a escala cresce também com o tamanho de fonte do sistema.
  const durations = safeData
    .map(item => item.end_time_in_minutes - item.start_time_in_minutes)
    .filter(d => d > 0);
  const shortest = durations.length ? Math.min(...durations) : 0;
  const needed = 22 + 38 * Math.min(fontScale || 1, 2);
  const pxPerMinute = shortest
    ? Math.max(BASE_PX_PER_MINUTE, needed / shortest)
    : BASE_PX_PER_MINUTE;

  const events: TimelineEvent[] = dayItems.map(item => {
    const start = item.start_time_in_minutes;
    const end = item.end_time_in_minutes;
    const canceled = isCanceled(item);
    const past =
      !canceled && (selectedIsPast || (selectedIsToday && end <= nowMinutes));
    const live =
      !canceled && selectedIsToday && start <= nowMinutes && end > nowMinutes;
    const absent =
      past &&
      absences.has(
        absenceKey({
          subjectId: subjectKey(item.class?.id ?? item.subject_id),
          date: selectedDay,
          start,
        }),
      );
    const shift = shiftOf(start);
    const { room } = splitLocation(item.class?.uerjLocation);
    const slots = slotRange(item);
    const exam = classEvaluation(
      evaluations,
      subjectKey(item.class?.id ?? item.subject_id),
      selectedDay,
      { start, end },
    );

    let status: React.ReactNode;
    let statusText: string;
    if (exam && !canceled && !past) {
      // a prova é o que importa nesta aula
      status = (
        <StatusLabel tone="accent" icon="event" label={TYPE_LABEL[exam.type]} />
      );
      statusText = `${evaluationName(exam)} nesta aula${live ? ', agora' : ''}`;
    } else if (canceled) {
      status = <StatusLabel tone="neutral" icon="block" label="Cancelada" />;
      statusText = 'cancelada';
    } else if (absent) {
      status = <StatusLabel tone="bad" icon="event_busy" label="Falta" />;
      statusText = 'falta marcada';
    } else if (past) {
      status = <StatusLabel tone="neutral" icon="check" label="Encerrada" />;
      statusText = 'encerrada';
    } else if (live) {
      status = <StatusLabel tone="accent" label="Agora" />;
      statusText = 'agora';
    } else {
      status = <StatusLabel tone={shift} label={SHIFT_LABEL[shift]} />;
      statusText = SHIFT_LABEL[shift];
    }

    return {
      key: `${item.class?.id ?? item.subject_id}:${start}`,
      start,
      end,
      title: item.class?.name ?? item.subject_id,
      meta: canceled
        ? `${timeRange(item)} · ${slots}`
        : `${timeRange(item)} · ${slots} · ${room}`,
      status,
      state: canceled || past ? 'past' : live ? 'live' : 'upcoming',
      onPress:
        past && onEndedClassPress
          ? () => onEndedClassPress(item, selectedDate)
          : () => onSubjectPress(item),
      accessibilityLabel: [
        item.class?.name ?? item.subject_id,
        `${item.startTimeAlias} às ${item.endTimeAlias}`,
        slots,
        canceled ? null : room,
        statusText,
      ]
        .filter(Boolean)
        .join(', '),
    };
  });

  // os professores vêm da Pesquisa de Disciplinas (do cache, quando já lidos);
  // a imagem é a mesma que o `SvgRenderer` desenha para a captura
  const handleExport = async () => {
    if (preparing) return;
    setPreparing(true);
    const found = await loadTeachers(safeData).catch(() => NO_TEACHERS);
    setTeachers(found);
    await nextPaint();
    setPreparing(false);
    try {
      await share(
        toSvgDataUri(buildWeekImage(safeData, { period, teachers: found })),
      );
    } catch {
      snackbar.error(
        'Não foi possível compartilhar a grade.',
        'Tente novamente.',
      );
    }
  };

  return (
    <Section
      title="Semana"
      action={
        <Button
          variant="text"
          size="sm"
          icon="share"
          label="Compartilhar grade"
          accessibilityLabel="Compartilhar grade da semana"
          loading={exporting || preparing}
          onPress={() => {
            void handleExport();
          }}
        />
      }
    >
      <WeekDaySelector
        days={days}
        selected={selected}
        onSelect={handleSelect}
      />
      <DayView>
        <Animated.View style={fadeStyle}>
          <DayHead>
            <DayTitle>
              <DayLine>
                <Text weight="semibold">{dateLabel(selectedDate)}</Text>
                {selectedIsToday ? <Tag tone="accent" label="Hoje" /> : null}
              </DayLine>
              {dayCount ? (
                <Text variant="meta" tone="muted">
                  {dayCount}
                </Text>
              ) : null}
            </DayTitle>
            {onAddEvaluation && !selectedIsPast ? (
              <DayAction>
                <Button
                  variant="text"
                  size="sm"
                  icon="add"
                  label="Avaliação"
                  accessibilityLabel={`Anotar avaliação em ${dateLabel(
                    selectedDate,
                  )}`}
                  onPress={() => onAddEvaluation(selectedDay)}
                />
              </DayAction>
            ) : null}
          </DayHead>
          {dayEvaluations.map(item => (
            <DayNotice key={item.id}>
              <Notice
                tone={item.done ? 'neutral' : 'info'}
                icon={item.done ? 'task_alt' : 'event'}
                text={[
                  `${evaluationTitle(item)}, ${whenText(item)}`,
                  item.done ? 'feita' : null,
                  item.note ? preview(item.note) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                action={
                  onEvaluationPress
                    ? {
                        label: 'Editar',
                        accessibilityLabel: `Editar ${evaluationTitle(item)}`,
                        onPress: () => onEvaluationPress(item),
                      }
                    : undefined
                }
              />
            </DayNotice>
          ))}
          <DayTimeline
            events={events}
            pxPerMinute={pxPerMinute}
            now={
              selectedIsToday
                ? { minutes: nowMinutes, label: clockLabel(now) }
                : undefined
            }
            emptyText={
              selected === 6 ? 'Sem aulas no sábado.' : 'Sem aulas neste dia.'
            }
          />
        </Animated.View>
      </DayView>
      <SvgRenderer svgString={svgString} />
    </Section>
  );
});
