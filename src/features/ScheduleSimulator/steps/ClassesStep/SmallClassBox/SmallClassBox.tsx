import React from 'react';
import {TouchableOpacity} from 'react-native';

import {
  Horario,
  SubjectClassesSchedule,
} from '@features/SubjectClassesSchedule/types';
import {SubjectInfo} from '@features/SubjectInfo/types';

import ScheduleBox from '@root/pages/SubjectDetails/ScheduleBox';

import Text from '@atoms/Text';
import {InlineRow, Container, Column, Row} from './SmallClassBox.styles';

interface Props extends SubjectClassesSchedule {
  selected: boolean;
  onPress: (c: any) => void;
  subject: SubjectInfo;
}

const SmallClassBox = (c: Props) => {
  const hasMultipleTeachers = (c?.teachers as string[])?.length > 1;

  const teachers: string[] = c.teachers ?? [];
  const schedule: Horario[] = c.schedule ?? [];

  return (
    <TouchableOpacity onPress={() => c.onPress(c)}>
      <Container key={c.classNumber} color={c.selected ? 'FREE' : 'BUSY'}>
        <InlineRow>
          <Text size="XS" weight="bold" marginRight="auto">
            {c.subject.id}
          </Text>
          <Text size="XS" weight="bold" marginLeft="auto">
            Turma {c.classNumber}
            {c.hasPreference && ' - Preferencial'}
          </Text>
        </InlineRow>
        <InlineRow>
          <Text size="XS" marginRight="auto">
            {c.subject.name}
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
        </Row>

        <InlineRow>
          {schedule.map((props, index) => (
            <ScheduleBox {...props} key={index.toString()} />
          ))}
        </InlineRow>
      </Container>
    </TouchableOpacity>
  );
};

export default SmallClassBox;
