import React from 'react';
import {SubjectClassesSchedule} from '@root/features/SubjectClassesSchedule/types';

import Text from '@atoms/Text';

import {
  InlineRow,
  ClassBox,
  VacancieBox,
  ScheduleBox,
} from './SubjectView.styles';
import {getVacancieHealth} from '@root/utils/health/vacancies';
import {getAliasPeriod} from '@root/utils/health/time';
import {TIME_DICTIONARY} from '@utils/constants/time';

export default function renderClassBox(c: SubjectClassesSchedule) {
  const hasMultipleTeachers = (c?.teachers as string[])?.length > 1;

  return (
    <ClassBox key={c.classNumber}>
      <InlineRow>
        <Text size="XS" weight="bold" marginRight="auto">
          Turma {c.classNumber}
        </Text>
        <Text size="XS" italic marginLeft="auto">
          {c.hasPreference && 'Preferencial'}
        </Text>
      </InlineRow>

      <InlineRow>
        <VacancieBox
          color={
            getVacancieHealth(
              c.vacancies?.uerj.requestedTaken as number,
              c.vacancies?.uerj.available as number,
            ).status
          }>
          <Text size="XS" weight="bold" alignSelf="center">
            Solicitadas
          </Text>
          <Text size="XS" weight="500" alignSelf="center">
            {c.vacancies?.uerj.requestedTaken +
              '/' +
              c.vacancies?.uerj.requestedAvailable}
          </Text>
        </VacancieBox>
        <VacancieBox
          color={
            getVacancieHealth(
              c.vacancies?.uerj.taken as number,
              c.vacancies?.uerj.available as number,
            ).status
          }>
          <Text size="XS" weight="bold" alignSelf="center">
            Ocupadas
          </Text>
          <Text size="XS" weight="500" alignSelf="center">
            {c.vacancies?.uerj.taken + '/' + c.vacancies?.uerj.available}
          </Text>
        </VacancieBox>
      </InlineRow>
      <Text size="XS" weight="bold">
        {hasMultipleTeachers ? 'Docentes' : 'Docente'}
      </Text>
      {c?.teachers?.map(t => (
        <Text size="XS" key={t}>{`• ${t}`}</Text>
      ))}
      <InlineRow>
        {c?.schedule.map(obj => {
          const day = Object.keys(obj)[0];
          const startAlias = obj[day][0][0] ?? '??';
          const endAlias = obj[day][0][obj[day][0].length - 1] ?? '??';

          const startTime = TIME_DICTIONARY[startAlias][0];
          const endTime = TIME_DICTIONARY[startAlias][1];

          const period = getAliasPeriod(startAlias);
          return (
            <ScheduleBox key={day} color={period}>
              <Text size="XS" weight="bold" alignSelf="center">
                {day}
              </Text>
              <Text size="XS" italic weight="400" alignSelf="center">
                {startAlias + ' - ' + endAlias}
              </Text>
              <Text size="XS" weight="500" alignSelf="center">
                {startTime + ' - ' + endTime}
              </Text>
            </ScheduleBox>
          );
        })}
      </InlineRow>
    </ClassBox>
  );
}
