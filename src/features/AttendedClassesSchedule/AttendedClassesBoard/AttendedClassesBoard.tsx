import React from 'react';
import { useNavigation } from '@react-navigation/native';

import { BottomSheet, List, ListRow, StatusLabel } from '@components/ui';
import { AttendedClassesSchedule } from '@root/modules/academics/domain/models';

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
};

/**
 * Folha "Disciplinas em Curso": as disciplinas da grade (ativas primeiro e,
 * no fim, as canceladas com o rótulo), com turma, horários, sala e sala
 * virtual. Tocar numa disciplina abre a Pesquisa de Disciplinas.
 */
export const AttendedClassesBoard = React.memo(function AttendedClassesBoard({
  visible,
  onClose,
  data,
  focusId,
}: Props) {
  const navigation = useNavigation();
  const safeData = data ?? [];

  const subjects = safeData.reduce((acc, c) => {
    if (c.class && !acc.some(s => s.id === c.class.id)) {
      acc.push(c.class);
    }
    return acc;
  }, [] as Subject[]);
  const active = subjects.filter(s => s.status !== 'CANCELED');
  const canceled = subjects.filter(s => s.status === 'CANCELED');

  function handleOnPress(item: Subject) {
    onClose();
    navigation.navigate('Pesquisa de Disciplinas', {
      subjectId: item.id,
      sourceRoute: 'Início',
    });
  }

  function renderItem(item: Subject) {
    const { id, name } = item;
    const meetings = safeData.filter(c => c.class?.id === id && !isCanceled(c));
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
    return (
      <ListRow
        key={id}
        title={name}
        code={id}
        subtitle={`Turma ${item.class}`}
        meta={meta}
        facts={
          isItemCanceled ? (
            <StatusLabel tone="neutral" icon="block" label="Cancelada" />
          ) : undefined
        }
        highlighted={focusId === id}
        chevron
        onPress={() => handleOnPress(item)}
        accessibilityHint="Abre a Pesquisa de Disciplinas"
      />
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Disciplinas em Curso"
      meta={plural(active.length, 'ativa', 'ativas')}
    >
      <List>{[...active, ...canceled].map(renderItem)}</List>
    </BottomSheet>
  );
});
