import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from 'styled-components/native';

import {
  HEALTH_LABEL,
  healthTone,
  Icon,
  List,
  ListRow,
  Section,
  StatusLabel,
  Text,
} from '@components/ui';
import { PartialRID } from '@root/modules/academics/domain/models';
import { numberToColor } from '@utils/numberToColor';

import { Alert, AlertText, UpdatedAt, Value, Values } from './RIDBoard.styles';

type Props = {
  data: {
    subjects: PartialRID[];
    updatedAt: string;
  };
};

/**
 * RID parcial no período de inscrição: por disciplina, vagas solicitadas e
 * oferecidas, a posição na fila (com a saúde em ponto + rótulo) e a
 * situação, destacada quando não há posição.
 */
export const RIDBoard = React.memo(function RIDBoard({ data }: Props) {
  const theme = useTheme();
  const navigation = useNavigation();

  const { subjects, updatedAt } = data;

  if (subjects.length === 0) {
    return null;
  }

  function handleOnPress(item: PartialRID) {
    navigation.navigate('Pesquisa de Disciplinas', {
      subjectId: item.id,
      sourceRoute: 'Início',
    });
  }

  function renderItem(item: PartialRID) {
    const { id, classNumber, name, available, requested, position, status } =
      item;

    const hasWarning = position === 0;
    const vacancies = healthTone(numberToColor(requested, available, true));
    const positionTone = hasWarning
      ? 'neutral'
      : healthTone(numberToColor(position, available, true));
    const positionLabel = hasWarning
      ? 'Sem posição'
      : HEALTH_LABEL[positionTone];

    return (
      <ListRow
        key={id}
        title={name}
        code={id}
        subtitle={`Turma ${classNumber}`}
        chevron
        onPress={() => handleOnPress(item)}
        accessibilityLabel={`${name}, ${id}, Turma ${classNumber}. Solicitadas/Oferecidas: ${requested} de ${available}, ${HEALTH_LABEL[vacancies]}. Sua posição: ${position}, ${positionLabel}. Situação: ${status}`}
      >
        <Values>
          <Value>
            <Text variant="caption" weight="regular" tone="muted">
              Solicitadas/Oferecidas
            </Text>
            <Text variant="headline" tabular>
              {requested}/{available}
            </Text>
            <StatusLabel tone={vacancies} label={HEALTH_LABEL[vacancies]} />
          </Value>
          <Value>
            <Text variant="caption" weight="regular" tone="muted">
              Sua posição
            </Text>
            <Text variant="headline" tabular>
              {position}
            </Text>
            <StatusLabel tone={positionTone} label={positionLabel} />
          </Value>
        </Values>
        {hasWarning ? (
          <Alert>
            <Icon
              name="error"
              size={theme.sizes.icon.md}
              color={theme.status.bad.ink}
            />
            <AlertText variant="meta" weight="semibold" tone="bad">
              {status}
            </AlertText>
          </Alert>
        ) : (
          <Text variant="meta" tone="muted">
            Situação: {status}
          </Text>
        )}
      </ListRow>
    );
  }

  return (
    <Section
      title="RID Parcial"
      note="Período de inscrição"
      noteIcon="how_to_reg"
    >
      <UpdatedAt variant="meta" tone="muted">
        Última atualização em {updatedAt.trim()}
      </UpdatedAt>
      <List>{subjects.map(renderItem)}</List>
    </Section>
  );
});
