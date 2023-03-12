import React from 'react';
import Carousel from 'react-native-reanimated-carousel';
import {window} from '@utils/constants/info';

import {TIME_VALUES, WEEKDAY_DICTIONARY} from '@utils/constants/time';

import {
  GeneratedClassWithSubject,
  RenderedSchedule,
} from '@features/ScheduleSimulator/types';
import Text from '@atoms/Text';

import {
  TimeInfoColumn,
  WeekDayContainer,
  Row,
  SubjectInfoColumn,
  ClassBox,
  CarouselContainer,
} from './ScheduleVisualizer.styles';

import {convertToRenderedSchedule} from '../core';

type Props = {
  data: GeneratedClassWithSubject[];
};

const getBoxColor = (start: number) => {
  if (start < 740) {
    return 'MORNING';
  }
  if (start < 1070) {
    return 'AFTERNOON';
  }
  return 'NIGHT';
};

const ScheduleVisualizer = ({data}: Props) => {
  if (!data || data.length === 0) {
    return null;
  }

  const parsedData = convertToRenderedSchedule(data);
  const weekDayNames = Object.keys(parsedData).sort((a, b) => {
    const aWeek = Object.values(WEEKDAY_DICTIONARY).find(w => w.name === a)!;

    const bWeek = Object.values(WEEKDAY_DICTIONARY).find(w => w.name === b)!;

    return aWeek.number - bWeek.number;
  });

  const renderSchedule = (
    schedule: RenderedSchedule[keyof RenderedSchedule][0],
    index: number,
  ) => {
    const {start_time_in_minutes, end_time_in_minutes} = schedule;

    const {periodAlias: startPeriod, startTimeAlias} = TIME_VALUES.find(
      t => start_time_in_minutes === t.start_time_in_minutes,
    ) ?? {periodAlias: '??'};

    const {periodAlias: endPeriod, endTimeAlias} = TIME_VALUES.find(
      t => t.end_time_in_minutes === end_time_in_minutes,
    ) ?? {periodAlias: '??'};

    const subjectName = schedule.subject.name;
    const boxColor = getBoxColor(start_time_in_minutes);
    return (
      <ClassBox color={boxColor} key={index.toString()}>
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
              {subjectName}
            </Text>
          </SubjectInfoColumn>
        </Row>
      </ClassBox>
    );
  };

  const renderWeek = (weekDay: keyof RenderedSchedule) => {
    const schedule = parsedData[weekDay];

    return (
      <WeekDayContainer>
        <Text
          size="LG"
          textAlign="center"
          alignSelf="center"
          weight="300"
          marginBottom="8px">
          {weekDay}
        </Text>
        {schedule.map(renderSchedule)}
      </WeekDayContainer>
    );
  };

  const maxQttyOfItemsInAWeekDay = Math.max(4);
  const maxPossibleHeight =
    60 * maxQttyOfItemsInAWeekDay + 12 * maxQttyOfItemsInAWeekDay + 80;

  return (
    <CarouselContainer>
      <Carousel
        loop
        defaultIndex={0}
        width={window.width * 0.95}
        height={maxPossibleHeight}
        data={weekDayNames}
        scrollAnimationDuration={500}
        renderItem={({item}) => renderWeek(item)}
      />
    </CarouselContainer>
  );
};

export default React.memo(ScheduleVisualizer, (prev, next) => {
  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return true;
  }
  return false;
});
