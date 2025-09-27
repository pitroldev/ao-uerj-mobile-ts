import React from 'react';

import { getVacancieHealth } from '@utils/health/vacancies';

import {
  Horario,
  SubjectClassesSchedule,
} from '@features/SubjectClassesSchedule/types';

import Text from '@atoms/Text';

import ScheduleDayBoxes from '../ScheduleBox';

import {
  InlineRow,
  Container,
  VacancieBox,
  VacanciesRow,
  Column,
  Row,
} from './ClassBox.styles';

const ClassBox = (c: SubjectClassesSchedule) => {
  const hasMultipleTeachers = (c?.teachers as string[])?.length > 1;

  const teachers: string[] = c.teachers ?? [];
  const schedule: Horario[] = c.schedule ?? [];

  return (
    <Container key={c.classNumber}>
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
            }
          >
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
            }
          >
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
        {schedule.map((props, index) => (
          <ScheduleDayBoxes {...props} key={index.toString()} />
        ))}
      </InlineRow>
    </Container>
  );
};

export default ClassBox;
