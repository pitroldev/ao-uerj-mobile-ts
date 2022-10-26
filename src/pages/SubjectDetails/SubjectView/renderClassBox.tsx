import React from 'react';

import {getVacancieHealth} from '@utils/health/vacancies';
import {getAliasPeriod} from '@utils/health/time';
import {TIME_DICTIONARY} from '@utils/constants/time';

import {Turno, WeekDay} from '@root/types/dateStuff';

import {
  Horario,
  SubjectClassesSchedule,
} from '@features/SubjectClassesSchedule/types';

import Text from '@atoms/Text';

import {
  InlineRow,
  ClassBox,
  VacancieBox,
  VacanciesRow,
  ScheduleBox,
  Column,
  Row,
} from './SubjectView.styles';

export default function renderClassBox(c: SubjectClassesSchedule) {
  const hasMultipleTeachers = (c?.teachers as string[])?.length > 1;

  const teachers: string[] = c.teachers ?? [];
  const schedule: Horario[] = c.schedule ?? [];

  return (
    <ClassBox key={c.classNumber}>
      <InlineRow>
        <Text size="XS" weight="bold" marginRight="auto">
          Turma {c.classNumber}
        </Text>
        <Text size="XS" italic marginLeft="auto" marginRight="4px">
          {c.hasPreference && 'Preferencial'}
        </Text>
      </InlineRow>

      <Row>
        <Column>
          <Text size="XS" weight="bold">
            {hasMultipleTeachers ? 'Docentes' : 'Docente'}
          </Text>
          {teachers.map(t => (
            <Text size="XS" key={t}>{`• ${t}`}</Text>
          ))}
        </Column>

        <VacanciesRow>
          <VacancieBox
            color={
              getVacancieHealth(
                c.vacancies?.uerj.requestedTaken as number,
                c.vacancies?.uerj.requestedAvailable as number,
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
        </VacanciesRow>
      </Row>

      <InlineRow>
        {schedule.map(obj => {
          const day = Object.keys(obj)[0] as WeekDay;
          const turnos = obj[day] ?? ([[]] as Turno[][]);
          const turno = turnos[0] ?? ([] as Turno[]);
          const startAlias = turno[0] ?? '??';
          const endAlias = turno[turno.length - 1] ?? '??';

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
