import React from 'react';
import {TouchableOpacity} from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import {window} from '@utils/constants/info';

import {TIME_VALUES} from '@utils/constants/time';
import {AttendedClassesSchedule} from '@features/AttendedClassesSchedule/types';

import Text from '@atoms/Text';

import {
  TimeInfoColumn,
  WeekDayContainer,
  Row,
  SubjectInfoColumn,
  ClassBox,
  CarouselContainer,
} from './ClassScheduleBoard.styles';

type Props = {
  data: AttendedClassesSchedule[];
  onSubjectPress: (item?: AttendedClassesSchedule) => void;
};

const ClassScheduleBoard = ({data, onSubjectPress}: Props) => {
  if (!data || data.length === 0) {
    return null;
  }

  const weekDays = [] as {number: number; name: string}[];
  data.forEach(
    c =>
      !weekDays.some(w => w.number === c.dayNumber) &&
      weekDays.push({number: c.dayNumber, name: c.dayAlias}),
  );

  const getBoxColor = (start: number) => {
    if (start < 740) {
      return 'MORNING';
    }
    if (start < 1070) {
      return 'AFTERNOON';
    }
    return 'NIGHT';
  };

  const renderClasses = (item: AttendedClassesSchedule) => {
    const {start_time_in_minutes, end_time_in_minutes} = item;

    const {periodAlias: startPeriod, startTimeAlias} = TIME_VALUES.find(
      t => start_time_in_minutes === t.start_time_in_minutes,
    ) ?? {periodAlias: '??'};

    const {periodAlias: endPeriod, endTimeAlias} = TIME_VALUES.find(
      t => t.end_time_in_minutes === end_time_in_minutes,
    ) ?? {periodAlias: '??'};

    const boxColor = getBoxColor(start_time_in_minutes);
    return (
      <TouchableOpacity
        key={`${item.class.name}:${item.class.id}`}
        onPress={() => onSubjectPress(item)}>
        <ClassBox color={boxColor}>
          <Row>
            <TimeInfoColumn>
              <Text
                weight="500"
                size="XS"
                italic
                textAlign="center"
                alignSelf="center">
                {startPeriod} - {endPeriod}
              </Text>
              <Text
                weight="500"
                size="XS"
                italic
                textAlign="center"
                alignSelf="center">
                {startTimeAlias} - {endTimeAlias}
              </Text>
            </TimeInfoColumn>
            <SubjectInfoColumn>
              <Text size="XS" textAlign="center" alignSelf="center">
                {item.class.name}
              </Text>
            </SubjectInfoColumn>
          </Row>
        </ClassBox>
      </TouchableOpacity>
    );
  };

  const renderBoard = (weekDay: string) => {
    const classesInThisDay = data.filter(c => c.dayAlias === weekDay);

    return (
      <WeekDayContainer key={weekDay}>
        <Text
          size="XL"
          textAlign="center"
          alignSelf="center"
          weight="300"
          marginBottom="12px">
          {weekDay}
        </Text>
        {classesInThisDay.map(renderClasses)}
      </WeekDayContainer>
    );
  };

  const currentDay =  new Date().getDay();

  const [closestWeekday] = weekDays
    .map(({number}) => ({diff: Math.abs(number - currentDay), number}))
    .sort((a, b) =>  a.diff - b.diff)

  const defaultIndex = weekDays.findIndex(w => w.number === closestWeekday.number) ?? 0

  const qttyItemsPerWeekDay = weekDays.map(
    w => data.filter(c => c.dayAlias === w.name).length,
  );
  const maxQttyOfItemsInAWeekDay = Math.max(...qttyItemsPerWeekDay);
  const maxPossibleHeight =
    60 * maxQttyOfItemsInAWeekDay + 12 * maxQttyOfItemsInAWeekDay + 80;

  return (
    <CarouselContainer>
      <Carousel
        loop
        defaultIndex={defaultIndex}
        width={window.width}
        height={maxPossibleHeight}
        data={weekDays.map(w => w.name)}
        scrollAnimationDuration={500}
        renderItem={({item}) => renderBoard(item)}
      />
    </CarouselContainer>
  );
};

export default React.memo(ClassScheduleBoard, (prev, next) => {
  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return true;
  }
  return false;
});
