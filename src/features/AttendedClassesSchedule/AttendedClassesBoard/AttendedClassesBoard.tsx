import React from 'react';
import { View } from 'react-native';
import styled, { useTheme } from 'styled-components/native';
import { useNavigation } from '@react-navigation/native';

import {
  BottomSheet,
  Button,
  ListRow,
  ProgressBar,
  StatusLabel,
  Text,
} from '@components/ui';
import { parseLocation } from '@root/modules/campus-map/domain/parseLocation';
import { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import { useSubjectLoads } from '@root/modules/academics/presentation/useSubjectLoads';
import {
  absenceLimit,
  absentSlots,
  attendanceSummary,
  slotCount,
} from '@root/modules/attendance/domain/attendance';
import { useAttendance } from '@root/modules/attendance/presentation/useAttendance';

import { attendanceTone, remainingText, usedText } from '../attendanceText';
import {
  isCanceled,
  locationLabel,
  meetingSummary,
  plural,
} from '../scheduleFormat';

type Subject = AttendedClassesSchedule['class'];

type Props = {
  visible: boolean;
  onClose: () => void;
  data: AttendedClassesSchedule[];
  /** Disciplina tocada na agenda: aparece destacada na lista. */
  focusId?: string | null;
  /**
   * "Faltas" numa disciplina: esta folha fecha, e quem a mostra abre a das
   * faltas em `onClosed` (no iOS, um modal não abre enquanto outro sai).
   */
  onAttendancePress?: (subject: Subject) => void;
  /** A folha terminou de descer. */
  onClosed?: () => void;
};

/** Barra de faltas e contagem, na largura do texto da linha. */
const AbsenceLine = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md}px;
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

const AbsenceBar = styled.View`
  flex: 1;
`;

/** "Ver no mapa" e "Faltas" lado a lado, alinhados ao texto da linha. */
const Actions = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: -${({ theme }) => theme.spacing.sm}px;
  padding: 0px ${({ theme }) => theme.layout.gutter - 12}px;
`;

/**
 * Folha "Disciplinas em Curso": as disciplinas da grade (ativas primeiro e,
 * no fim, as canceladas com o rótulo), com turma, horários, sala, sala
 * virtual e as faltas marcadas no aparelho. Tocar numa disciplina abre a
 * Pesquisa de Disciplinas.
 */
export const AttendedClassesBoard = React.memo(function AttendedClassesBoard({
  visible,
  onClose,
  data,
  focusId,
  onAttendancePress,
  onClosed,
}: Props) {
  const safeData = data ?? [];
  const subjects = safeData.reduce((acc, c) => {
    if (c.class && !acc.some(s => s.id === c.class.id)) {
      acc.push(c.class);
    }
    return acc;
  }, [] as Subject[]);
  const active = subjects.filter(s => s.status !== 'CANCELED');

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title="Disciplinas em Curso"
      meta={plural(active.length, 'ativa', 'ativas')}
    >
      <ClassesList
        data={safeData}
        subjects={subjects}
        focusId={focusId}
        onClose={onClose}
        onAttendancePress={onAttendancePress}
      />
    </BottomSheet>
  );
});

/** O conteúdo da folha: só monta aberta (lê as faltas e o histórico). */
function ClassesList({
  data,
  subjects,
  focusId,
  onClose,
  onAttendancePress,
}: {
  data: AttendedClassesSchedule[];
  subjects: Subject[];
  focusId?: string | null;
  onClose: () => void;
  onAttendancePress?: (subject: Subject) => void;
}) {
  const navigation = useNavigation();
  const theme = useTheme();
  const { absences } = useAttendance();
  const { loads, loading } = useSubjectLoads();
  const active = subjects.filter(s => s.status !== 'CANCELED');
  const canceled = subjects.filter(s => s.status === 'CANCELED');

  function handleOnPress(item: Subject) {
    onClose();
    navigation.navigate('Pesquisa de Disciplinas', {
      subjectId: item.id,
      sourceRoute: 'Início',
    });
  }

  function renderAbsences(item: Subject, meetings: AttendedClassesSchedule[]) {
    const key = subjectKey(item.id);
    const summary = attendanceSummary(
      absentSlots(absences, key),
      absenceLimit(loads.get(key)?.workload),
    );
    const tone = attendanceTone(summary);
    const slotsPerClass = Math.max(
      0,
      ...meetings.map(c =>
        slotCount(c.start_time_in_minutes, c.end_time_in_minutes),
      ),
    );
    return {
      facts: (
        <StatusLabel
          tone={tone}
          label={remainingText(summary, slotsPerClass, loading)}
          lines={2}
        />
      ),
      bar: (
        <AbsenceLine>
          {summary.limit !== null ? (
            <AbsenceBar>
              <ProgressBar
                value={summary.limit ? summary.used / summary.limit : 1}
                tone={tone === 'neutral' ? 'accent' : tone}
                accessibilityLabel={`Faltas em ${item.name}: ${usedText(summary)}`}
              />
            </AbsenceBar>
          ) : null}
          <Text variant="meta" tone="muted" tabular>
            {`${usedText(summary)} de falta`}
          </Text>
        </AbsenceLine>
      ),
    };
  }

  function renderItem(item: Subject) {
    const { id, name } = item;
    const meetings = data.filter(c => c.class?.id === id && !isCanceled(c));
    const isItemCanceled = item.status === 'CANCELED';
    const meta = isItemCanceled
      ? undefined
      : [
          ...meetingSummary(meetings),
          locationLabel(item.uerjLocation),
          ...(item.avaLocation
            ? [`Sala virtual (AVA): ${item.avaLocation}`]
            : []),
        ];
    const absenceInfo = isItemCanceled ? null : renderAbsences(item, meetings);
    const hasMap =
      !isItemCanceled && parseLocation(item.uerjLocation).kind === 'room';
    return (
      <React.Fragment key={id}>
        <ListRow
          title={name}
          code={id}
          subtitle={`Turma ${item.class}`}
          meta={meta}
          facts={
            isItemCanceled ? (
              <StatusLabel tone="neutral" icon="block" label="Cancelada" />
            ) : (
              absenceInfo?.facts
            )
          }
          highlighted={focusId === id}
          chevron
          onPress={() => handleOnPress(item)}
          accessibilityHint="Abre a Pesquisa de Disciplinas"
        >
          {absenceInfo?.bar}
        </ListRow>
        {hasMap || (!isItemCanceled && onAttendancePress) ? (
          <Actions>
            {!isItemCanceled && onAttendancePress ? (
              <Button
                label="Faltas"
                accessibilityLabel={`Marcar faltas em ${name}`}
                icon="event_busy"
                variant="text"
                onPress={() => {
                  onAttendancePress(item);
                  onClose();
                }}
              />
            ) : null}
            {hasMap ? (
              <Button
                label="Ver no mapa"
                accessibilityLabel={`Ver sala de ${name} no mapa`}
                icon="location_on"
                variant="text"
                onPress={() => {
                  onClose();
                  navigation.navigate('Mapa', { location: item.uerjLocation });
                }}
              />
            ) : null}
          </Actions>
        ) : null}
      </React.Fragment>
    );
  }

  return (
    <View style={{ marginHorizontal: -theme.layout.gutter }}>
      {[...active, ...canceled].map(renderItem)}
    </View>
  );
}
