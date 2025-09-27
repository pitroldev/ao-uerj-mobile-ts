import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useFormContext, useWatch } from 'react-hook-form';

import { useStepsContext } from '@hooks/useSteps';

import { TIME_VALUES, WEEKDAY_DICTIONARY } from '@utils/constants/time';

import { ScheduleCreationParams } from '@features/ScheduleSimulator/types';

import Text from '@atoms/Text';
import Button from '@atoms/Button';

import {
  Header,
  Container,
  Row,
  ScheduleItem,
  ScrollContainer,
  Square,
  ButtonsRow,
  ContentContainer,
  ChipsContainer,
  ChipItem,
  ChipRow,
} from './BusyHoursStep.styles';

const UERJ_WEEK_DAYS = [1, 2, 3, 4, 5, 6] as Array<
  keyof typeof WEEKDAY_DICTIONARY
>;

const BusyHoursStep = () => {
  const { nextStep, prevStep } = useStepsContext();

  const { handleSubmit, setValue, control } =
    useFormContext<ScheduleCreationParams>();

  const busy_schedules = useWatch({ control, name: 'busy_schedules' }) ?? [];

  const handleNextPress = handleSubmit(nextStep);

  const handleScheduleItemPress = (
    weekDay: keyof typeof WEEKDAY_DICTIONARY,
    time: (typeof TIME_VALUES)[number],
  ) => {
    const isAlreadySelected = busy_schedules.some(
      busyHour =>
        busyHour.week_day === weekDay &&
        busyHour.start_time_in_minutes === time.start_time_in_minutes &&
        busyHour.end_time_in_minutes === time.end_time_in_minutes,
    );

    if (isAlreadySelected) {
      const newBusySchedules = busy_schedules.filter(
        busyHour =>
          busyHour.week_day !== weekDay ||
          busyHour.start_time_in_minutes !== time.start_time_in_minutes ||
          busyHour.end_time_in_minutes !== time.end_time_in_minutes,
      );

      setValue('busy_schedules', newBusySchedules);
      return;
    }

    const newBusySchedule = {
      week_day: weekDay,
      start_time_in_minutes: time.start_time_in_minutes,
      end_time_in_minutes: time.end_time_in_minutes,
    };

    setValue('busy_schedules', [...busy_schedules, newBusySchedule]);
  };

  const handleLongPress = (time: (typeof TIME_VALUES)[number]) => {
    const { start_time_in_minutes, end_time_in_minutes } = time;

    const filteredBusySchedules = busy_schedules.filter(
      busyHour =>
        busyHour.start_time_in_minutes !== start_time_in_minutes ||
        busyHour.end_time_in_minutes !== end_time_in_minutes,
    );

    const isAlreadySelected = busy_schedules.some(
      busyHour =>
        busyHour.start_time_in_minutes === start_time_in_minutes &&
        busyHour.end_time_in_minutes === end_time_in_minutes,
    );

    if (isAlreadySelected) {
      setValue('busy_schedules', filteredBusySchedules);
      return;
    }

    const busyRowTImes = UERJ_WEEK_DAYS.map(weekDay => ({
      week_day: weekDay,
      start_time_in_minutes,
      end_time_in_minutes,
    }));

    setValue('busy_schedules', [...filteredBusySchedules, ...busyRowTImes]);
  };

  const isSlotSelected = (
    weekDay: keyof typeof WEEKDAY_DICTIONARY,
    time: (typeof TIME_VALUES)[number],
  ) =>
    busy_schedules.some(
      b =>
        b.week_day === weekDay &&
        b.start_time_in_minutes === time.start_time_in_minutes &&
        b.end_time_in_minutes === time.end_time_in_minutes,
    );

  const toggleWeekdayFull = (
    weekDay: keyof typeof WEEKDAY_DICTIONARY,
    times: (typeof TIME_VALUES)[number][],
  ) => {
    const allSelected = times.every(t => isSlotSelected(weekDay, t));
    if (allSelected) {
      const filtered = busy_schedules.filter(b => b.week_day !== weekDay);
      setValue('busy_schedules', filtered);
      return;
    }
    const toAdd = times
      .filter(t => !isSlotSelected(weekDay, t))
      .map(t => ({
        week_day: weekDay,
        start_time_in_minutes: t.start_time_in_minutes,
        end_time_in_minutes: t.end_time_in_minutes,
      }));
    setValue('busy_schedules', [...busy_schedules, ...toAdd]);
  };

  const VALID_SCHEDULES = TIME_VALUES.filter(
    time => time.start_time_in_minutes > 0,
  );

  const PERIOD_GROUPS = {
    M: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('M')),
    T: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('T')),
    N: VALID_SCHEDULES.filter(t => t.periodAlias.startsWith('N')),
  } as const;

  const isGroupFullySelected = (group: keyof typeof PERIOD_GROUPS) =>
    UERJ_WEEK_DAYS.every(weekDay =>
      PERIOD_GROUPS[group].every(t => isSlotSelected(weekDay, t)),
    );

  const toggleGroupAcrossWeek = (group: keyof typeof PERIOD_GROUPS) => {
    const times = PERIOD_GROUPS[group];
    const allSelected = UERJ_WEEK_DAYS.every(weekDay =>
      times.every(t => isSlotSelected(weekDay, t)),
    );
    if (allSelected) {
      const filtered = busy_schedules.filter(b => {
        const matches = times.some(
          t =>
            b.start_time_in_minutes === t.start_time_in_minutes &&
            b.end_time_in_minutes === t.end_time_in_minutes,
        );
        return !matches;
      });
      setValue('busy_schedules', filtered);
      return;
    }
    const toAdd = UERJ_WEEK_DAYS.flatMap(weekDay =>
      times
        .filter(t => !isSlotSelected(weekDay, t))
        .map(t => ({
          week_day: weekDay,
          start_time_in_minutes: t.start_time_in_minutes,
          end_time_in_minutes: t.end_time_in_minutes,
        })),
    );
    setValue('busy_schedules', [...busy_schedules, ...toAdd]);
  };

  const clearAll = () => setValue('busy_schedules', []);

  const renderScheduleRow = (time: (typeof TIME_VALUES)[number]) => {
    const {
      start_time_in_minutes,
      end_time_in_minutes,
      startTimeAlias,
      endTimeAlias,
      periodAlias,
    } = time;

    return (
      <Row key={`row-${periodAlias}`}>
        {UERJ_WEEK_DAYS.map(weekDay => {
          const isAlreadySelected = busy_schedules.some(
            busyHour =>
              busyHour.week_day === weekDay &&
              busyHour.start_time_in_minutes === start_time_in_minutes &&
              busyHour.end_time_in_minutes === end_time_in_minutes,
          );
          const color = isAlreadySelected ? 'BUSY' : 'FREE';

          return (
            <ScheduleItem
              key={`cell-${weekDay}-${periodAlias}`}
              color={color}
              onPress={() => handleScheduleItemPress(weekDay, time)}
              onLongPress={() => handleLongPress(time)}
              delayLongPress={500}
            >
              <Text size="SM" weight="500" alignSelf="center">
                {startTimeAlias}
              </Text>
              <Text size="SM" weight="500" alignSelf="center">
                {endTimeAlias}
              </Text>
            </ScheduleItem>
          );
        })}
      </Row>
    );
  };

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="10px">
          Quando você está ocupado?
        </Text>
        <Text
          size="XS"
          alignSelf="center"
          marginBottom="6px"
          color="BACKGROUND_700"
        >
          Dica: toque para marcar, toque e segure para o período do dia. Você
          também pode usar os atalhos abaixo.
        </Text>

        <ChipsContainer>
          <ChipRow>
            <ChipItem>
              <Button
                size="small"
                width="auto"
                variant={
                  isGroupFullySelected('M') ? 'SECONDARY' : 'BACKGROUND_500'
                }
                onPress={() => toggleGroupAcrossWeek('M')}
              >
                Manhã ocupada
              </Button>
            </ChipItem>
            <ChipItem>
              <Button
                size="small"
                width="auto"
                variant={
                  isGroupFullySelected('T') ? 'SECONDARY' : 'BACKGROUND_500'
                }
                onPress={() => toggleGroupAcrossWeek('T')}
              >
                Tarde ocupada
              </Button>
            </ChipItem>
            <ChipItem>
              <Button
                size="small"
                width="auto"
                variant={
                  isGroupFullySelected('N') ? 'SECONDARY' : 'BACKGROUND_500'
                }
                onPress={() => toggleGroupAcrossWeek('N')}
              >
                Noite ocupada
              </Button>
            </ChipItem>
          </ChipRow>
          <Button
            size="small"
            fullWidth
            variant="BACKGROUND_400"
            onPress={clearAll}
          >
            Limpar tudo
          </Button>
        </ChipsContainer>
        <Header>
          <Header>
            <Square color="BUSY" />
            <Text size="SM" weight="500" alignSelf="center">
              Ocupado
            </Text>
          </Header>

          <Header>
            <Square color="FREE" />
            <Text size="SM" weight="500" alignSelf="center">
              Livre
            </Text>
          </Header>
        </Header>

        <Header>
          {UERJ_WEEK_DAYS.map(weekDay => (
            <TouchableOpacity
              key={weekDay}
              onPress={() => toggleWeekdayFull(weekDay, VALID_SCHEDULES)}
            >
              <Text size="SM" weight="500" alignSelf="center">
                {WEEKDAY_DICTIONARY[weekDay].shortName}
              </Text>
            </TouchableOpacity>
          ))}
        </Header>

        <ScrollContainer>
          {VALID_SCHEDULES.map(renderScheduleRow)}
        </ScrollContainer>
      </ContentContainer>

      <ButtonsRow>
        <Button onPress={prevStep} size="small">
          Anterior
        </Button>
        <Button onPress={handleNextPress} size="small">
          Próximo
        </Button>
      </ButtonsRow>
    </Container>
  );
};

export default BusyHoursStep;
