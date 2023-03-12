import React from 'react';
import {useFormContext, useWatch} from 'react-hook-form';

import {useStepsContext} from '@hooks/useSteps';

import {TIME_VALUES, WEEKDAY_DICTIONARY} from '@utils/constants/time';

import {ScheduleCreationParams} from '@features/ScheduleSimulator/types';

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
} from './BusyHoursStep.styles';

const UERJ_WEEK_DAYS = [1, 2, 3, 4, 5, 6] as Array<
  keyof typeof WEEKDAY_DICTIONARY
>;

const BusyHoursStep = () => {
  const {nextStep, prevStep} = useStepsContext();

  const {handleSubmit, setValue, control} =
    useFormContext<ScheduleCreationParams>();

  const busy_schedules = useWatch({control, name: 'busy_schedules'}) ?? [];

  const handleNextPress = handleSubmit(nextStep);

  const handleScheduleItemPress = (
    weekDay: keyof typeof WEEKDAY_DICTIONARY,
    time: typeof TIME_VALUES[number],
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

  const handleLongPress = (time: typeof TIME_VALUES[number]) => {
    const {start_time_in_minutes, end_time_in_minutes} = time;

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

  const renderScheduleRow = (time: typeof TIME_VALUES[number]) => {
    const {
      start_time_in_minutes,
      end_time_in_minutes,
      startTimeAlias,
      endTimeAlias,
      periodAlias,
    } = time;

    return (
      <Row key={periodAlias}>
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
              key={`${weekDay}${periodAlias}`}
              color={color}
              onPress={() => handleScheduleItemPress(weekDay, time)}
              onLongPress={() => handleLongPress(time)}
              delayLongPress={1500}>
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

  const VALID_SCHEDULES = TIME_VALUES.filter(
    time => time.start_time_in_minutes > 0,
  );

  return (
    <Container>
      <ContentContainer>
        <Text weight="bold" size="LG" alignSelf="center" marginBottom="10px">
          Quando você está ocupado?
        </Text>
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
            <Text size="SM" weight="500" alignSelf="center" key={weekDay}>
              {WEEKDAY_DICTIONARY[weekDay].shortName}
            </Text>
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
