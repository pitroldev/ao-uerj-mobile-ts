import React from 'react';

import {getAliasPeriodColor} from '@utils/health/time';
import {TIME_DICTIONARY} from '@utils/constants/time';

import {Turno, WeekDay} from '@root/types/dateStuff';

import {Horario} from '@features/SubjectClassesSchedule/types';

import Text from '@atoms/Text';

import {Container} from './ScheduleBox.styles';

const ScheduleBox = (props: Horario) => {
  const day = Object.keys(props)[0] as WeekDay;
  const turnos = props[day] ?? ([[]] as Turno[][]);
  const turno = turnos[0] ?? ([] as Turno[]);
  const startAlias = turno[0] ?? '??';
  const endAlias = turno[turno.length - 1] ?? '??';

  const startTime = TIME_DICTIONARY[startAlias][0];
  const endTime = TIME_DICTIONARY[endAlias][1];

  const period = getAliasPeriodColor(startAlias);
  return (
    <Container key={day} color={period}>
      <Text size="XS" weight="bold" alignSelf="center">
        {day}
      </Text>
      <Text size="XS" italic weight="400" alignSelf="center">
        {startAlias + ' - ' + endAlias}
      </Text>
      <Text size="XS" weight="500" alignSelf="center">
        {startTime + ' - ' + endTime}
      </Text>
    </Container>
  );
};

export default ScheduleBox;
