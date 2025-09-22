import React from 'react';

import { GeneratedSchedule } from '../types';

import Text from '@atoms/Text';
import {
  Container,
  InfoContainer,
  InfoRow,
  SubjectsColumn,
  SubjectsRow,
  TeacherColumn,
} from './ScheduleInfo.styles';

const ScheduleInfo = (generation: GeneratedSchedule) => {
  const subjectsWithClasses = generation.schedule
    .map(s => ({
      subject_name: s.name,
      subject_id: s.subject.id,
      class_id: s.id,
      teachers: s.teachers.sort(),
    }))
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  const subjectQtty = generation.schedule.length;
  const workload = generation.total_workload;
  const credits = generation.total_credits;

  return (
    <Container>
      <InfoRow>
        <InfoContainer>
          <Text weight="bold" size="SM" alignSelf="center">
            Disciplinas
          </Text>
          <Text alignSelf="center" size="SM">
            {subjectQtty}
          </Text>
        </InfoContainer>
        <InfoContainer>
          <Text weight="bold" size="SM" alignSelf="center">
            Créditos
          </Text>
          <Text alignSelf="center" size="SM">
            {credits}
          </Text>
        </InfoContainer>
        <InfoContainer>
          <Text weight="bold" size="SM" alignSelf="center">
            Carga horária
          </Text>
          <Text alignSelf="center" size="SM">
            {workload}h
          </Text>
        </InfoContainer>
      </InfoRow>
      {subjectsWithClasses.map(s => (
        <SubjectsColumn key={s.subject_name}>
          <SubjectsRow>
            <Text size="XS">{s.subject_id}</Text>
            <Text size="XS" italic>
              Turma {s.class_id}
            </Text>
          </SubjectsRow>
          <Text size="SM" weight="bold">
            {s.subject_name}
          </Text>
          <TeacherColumn>
            {s.teachers.map(t => (
              <Text key={t} italic size="SM">
                • {t}
              </Text>
            ))}
          </TeacherColumn>
        </SubjectsColumn>
      ))}
    </Container>
  );
};

export default ScheduleInfo;
