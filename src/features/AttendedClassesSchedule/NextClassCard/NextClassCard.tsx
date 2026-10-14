import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { parseLocation } from '@root/modules/campus-map/domain/parseLocation';
import { useTheme } from 'styled-components/native';

import {
  Card,
  Button,
  Icon,
  Section,
  SHIFT_LABEL,
  StatusLabel,
  Text,
} from '@components/ui';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';

import {
  duration,
  findNextClass,
  shiftOf,
  slotRange,
  splitLocation,
  WEEKDAY_NAMES,
  weekdayOf,
  type NextClass,
} from '../scheduleFormat';
import {
  Chevron,
  Main,
  MetaRow,
  Row,
  TimeColumn,
  Until,
} from './NextClassCard.styles';

type Props = {
  data: AttendedClassesSchedule[];
  now: Date;
  /** Toque no card: abre "Disciplinas em Curso" com a disciplina em foco. */
  onPress: (item: AttendedClassesSchedule) => void;
};

/** "Agora", "Hoje · em 22 min" ou o dia da semana (informação neutra). */
function When({ next }: { next: NextClass }) {
  if (next.ongoing) {
    return <Text weight="semibold">Agora</Text>;
  }
  if (next.dayOffset === 0 && next.inMinutes != null) {
    return (
      <Text tone="muted" numberOfLines={1}>
        {'Hoje · '}
        <Text weight="semibold">em {duration(next.inMinutes)}</Text>
      </Text>
    );
  }
  return (
    <Text weight="semibold" numberOfLines={1}>
      {WEEKDAY_NAMES[weekdayOf(next.item)]}
    </Text>
  );
}

/**
 * "Próxima aula" (o único card acima da dobra): horário em destaque, fio
 * vertical, disciplina, turno com ponto, tempos, sala e local.
 */
export const NextClassCard = React.memo(function NextClassCard({
  data,
  now,
  onPress,
}: Props) {
  const theme = useTheme();
  const navigation = useNavigation();
  const next = findNextClass(data ?? [], now);
  if (!next) return null;

  const { item } = next;
  const shift = shiftOf(item.start_time_in_minutes);
  const { room, place } = splitLocation(item.class?.uerjLocation);
  const label = `${item.class.name}, ${item.startTimeAlias} às ${item.endTimeAlias}, ${room}. Ver disciplinas em curso`;

  return (
    <Section title="Próxima aula" note={<When next={next} />}>
      <Card
        padding={0}
        onPress={() => onPress(item)}
        accessibilityLabel={label}
      >
        <Row>
          <TimeColumn>
            <Text variant="titleL" tabular maxFontSizeMultiplier={1.6}>
              {item.startTimeAlias}
            </Text>
            <Until variant="meta" tone="muted">
              até {item.endTimeAlias}
            </Until>
          </TimeColumn>
          <Main>
            <Text variant="headline">{item.class.name}</Text>
            <MetaRow>
              <StatusLabel tone={shift} label={SHIFT_LABEL[shift]} />
              <Text variant="meta" tone="muted">
                {slotRange(item)} · {room}
              </Text>
            </MetaRow>
            {place ? (
              <Text variant="meta" tone="muted">
                {place}
              </Text>
            ) : null}
          </Main>
          <Chevron>
            <Icon
              name="chevron_right"
              size={theme.sizes.icon.lg}
              color={theme.colors.inkMuted}
            />
          </Chevron>
        </Row>
      </Card>
      {parseLocation(item.class.uerjLocation).kind === 'room' ? (
        <Button
          label="Ver no mapa"
          icon="location_on"
          variant="text"
          onPress={() =>
            navigation.navigate('Mapa', { location: item.class.uerjLocation })
          }
        />
      ) : null}
    </Section>
  );
});
