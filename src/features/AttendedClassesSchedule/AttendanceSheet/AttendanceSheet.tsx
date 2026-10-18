import React, { useMemo } from 'react';
import { View } from 'react-native';

import {
  BottomSheet,
  Card,
  Checkbox,
  FootNote,
  List,
  ListRow,
  Notice,
  ProgressBar,
  Section,
  SegmentedControl,
  snackbar,
  StatusLabel,
  Text,
  type IconName,
} from '@components/ui';
import type {
  AttendedClassesSchedule,
  AttendedSubjectInfo,
} from '@root/modules/academics/domain/models';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import { useSubjectLoads } from '@root/modules/academics/presentation/useSubjectLoads';
import {
  absenceKey,
  absenceLimit,
  absentSlots,
  attendanceSummary,
  fromIsoDate,
  meetingsWithAbsences,
  pastMeetings,
  slotCount,
  type ClassMeeting,
} from '@root/modules/attendance/domain/attendance';
import { useAttendance } from '@root/modules/attendance/presentation/useAttendance';

import { attendanceTone, remainingText, usedText } from '../attendanceText';
import {
  dateLabel,
  hasClassTime,
  isCanceled,
  plural,
  weekdayOf,
} from '../scheduleFormat';
import {
  Fact,
  Facts,
  Foot,
  Question,
  Spaced,
  SummaryHead,
  SummaryStatus,
} from './AttendanceSheet.styles';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Disciplina das faltas. */
  subject: AttendedSubjectInfo | null;
  /** A grade do período: as aulas da disciplina saem daqui. */
  data: AttendedClassesSchedule[];
  /** Aula tocada na agenda (já terminada), com a pergunta no topo. */
  focus: { date: string; start: number } | null;
  now: Date;
};

type Presence = 'present' | 'absent';

const PRESENCE: { value: Presence; label: string; icon: IconName }[] = [
  { value: 'present', label: 'Fui', icon: 'event_available' },
  { value: 'absent', label: 'Faltei', icon: 'event_busy' },
];

const STATUS_ICON: Record<string, IconName | undefined> = {
  good: 'check_circle',
  warn: 'info',
  bad: 'warning',
};

function clock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

function meetingMeta(meeting: ClassMeeting): string {
  return `${clock(meeting.start)}–${clock(meeting.end)} · ${plural(
    meeting.slots,
    'tempo',
    'tempos',
  )}`;
}

/**
 * Faltas de uma disciplina: quantas foram marcadas, quanto ainda cabe pela
 * frequência mínima de 75% e as aulas das últimas quatro semanas para marcar.
 * Tudo fica só no aparelho; o histórico, de onde vem a carga horária, só é
 * lido com a folha aberta.
 */
export function AttendanceSheet({
  visible,
  onClose,
  subject,
  data,
  focus,
  now,
}: Props) {
  return (
    <BottomSheet
      visible={visible && subject !== null}
      onClose={onClose}
      title={subject?.name ?? 'Faltas'}
    >
      {subject ? (
        <AttendanceContent
          subject={subject}
          data={data}
          focus={focus}
          now={now}
        />
      ) : null}
    </BottomSheet>
  );
}

function AttendanceContent({
  subject,
  data,
  focus,
  now,
}: {
  subject: AttendedSubjectInfo;
  data: AttendedClassesSchedule[];
  focus: Props['focus'];
  now: Date;
}) {
  const { absences, keys, mark } = useAttendance();
  const { loads, loading, failed, retry } = useSubjectLoads();
  const key = subjectKey(subject.id);

  const weekly = useMemo(
    () =>
      (data ?? [])
        .filter(
          item =>
            (item.class?.id ?? item.subject_id) === subject.id &&
            !isCanceled(item) &&
            hasClassTime(item),
        )
        .map(item => ({
          subjectId: key,
          weekday: weekdayOf(item),
          start: item.start_time_in_minutes,
          end: item.end_time_in_minutes,
        })),
    [data, key, subject.id],
  );
  const meetings = useMemo(
    () => meetingsWithAbsences(pastMeetings(weekly, now), absences, key),
    [weekly, now, absences, key],
  );

  const workload = loads.get(key)?.workload ?? null;
  const summary = attendanceSummary(
    absentSlots(absences, key),
    absenceLimit(workload),
  );
  const tone = attendanceTone(summary);
  const slotsPerClass = Math.max(
    0,
    ...weekly.map(item => slotCount(item.start, item.end)),
  );
  const focused = focus
    ? (meetings.find(
        item => item.date === focus.date && item.start === focus.start,
      ) ?? null)
    : null;
  const others = focused ? meetings.filter(item => item !== focused) : meetings;

  const toggle = async (meeting: ClassMeeting, absent: boolean) => {
    if (!(await mark(meeting, absent))) {
      snackbar.error('Não foi possível salvar a falta.', 'Tente de novo.');
    }
  };

  let workloadText = 'Sem dado';
  if (workload !== null) workloadText = `${workload} h`;
  else if (loading) workloadText = 'Buscando…';
  const status = remainingText(summary, slotsPerClass, loading);

  return (
    <>
      <View
        accessible
        accessibilityLabel={`Faltas no período: ${usedText(summary)}. ${status}. Carga horária: ${workloadText}. Presença mínima: 75%.`}
      >
        <Card>
          <SummaryHead>
            <Text variant="meta" tone="muted">
              Faltas no período
            </Text>
            <Text variant="headline" tabular>
              {usedText(summary)}
            </Text>
          </SummaryHead>
          {summary.limit !== null ? (
            <ProgressBar
              value={summary.limit ? summary.used / summary.limit : 1}
              tone={tone === 'neutral' ? 'accent' : tone}
              accessibilityLabel={`Faltas: ${usedText(summary)}`}
            />
          ) : null}
          <SummaryStatus>
            <StatusLabel
              tone={tone}
              icon={STATUS_ICON[tone]}
              label={status}
              lines={2}
            />
          </SummaryStatus>
          <Facts>
            <Fact>
              <Text variant="caption" tone="muted">
                Carga horária
              </Text>
              <Text weight="semibold" tabular>
                {workloadText}
              </Text>
            </Fact>
            <Fact>
              <Text variant="caption" tone="muted">
                Presença mínima
              </Text>
              <Text weight="semibold" tabular>
                75%
              </Text>
            </Fact>
          </Facts>
        </Card>
      </View>
      {workload === null && failed && !loading ? (
        <Spaced>
          <Notice
            tone="neutral"
            icon="info"
            text="Não foi possível ler a carga horária no histórico, no currículo nem nas universais."
            onRetry={retry}
          />
        </Spaced>
      ) : null}
      {focused ? (
        <Section title="Você foi a esta aula?">
          <Question>
            <Text tone="muted">
              {dateLabel(fromIsoDate(focused.date))} · {meetingMeta(focused)}
            </Text>
            <SegmentedControl
              options={PRESENCE}
              value={keys.has(absenceKey(focused)) ? 'absent' : 'present'}
              onChange={value => {
                void toggle(focused, value === 'absent');
              }}
              accessibilityLabel="Presença nesta aula"
            />
          </Question>
        </Section>
      ) : null}
      <Section
        title={focused ? 'Outras aulas' : 'Aulas recentes'}
        description="Marque as aulas das últimas 4 semanas em que você faltou."
      >
        {others.length ? (
          <List>
            {others.map(meeting => {
              const absent = keys.has(absenceKey(meeting));
              return (
                <ListRow
                  key={absenceKey(meeting)}
                  title={dateLabel(fromIsoDate(meeting.date))}
                  titleWeight="regular"
                  meta={meetingMeta(meeting)}
                  leading={<Checkbox checked={absent} />}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: absent }}
                  accessibilityHint="Marca ou desmarca a falta"
                  onPress={() => {
                    void toggle(meeting, !absent);
                  }}
                />
              );
            })}
          </List>
        ) : (
          <Text tone="muted">
            Nenhuma aula desta disciplina terminou nas últimas 4 semanas.
          </Text>
        )}
      </Section>
      <Foot>
        <FootNote
          icon="lock"
          text="As faltas ficam só neste aparelho e são apagadas quando a conta sai do app. O portal não mostra a frequência do período em curso; ela só aparece no histórico."
        />
        <FootNote
          icon="info"
          text="A frequência mínima é de 75% das horas-aula (Deliberação nº 33/1995, art. 95): o limite é de 25% da carga horária, e cada tempo de aula conta uma hora-aula."
        />
      </Foot>
    </>
  );
}
