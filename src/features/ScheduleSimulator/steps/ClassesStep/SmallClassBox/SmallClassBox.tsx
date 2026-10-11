import { SubjectClasses } from '@root/modules/planning/domain/models';
import React from 'react';
import { TouchableOpacity } from 'react-native';

import { Horario } from '@root/modules/academics/domain/models';
import { SubjectInfo } from '@root/modules/academics/domain/models';

import ScheduleBox from '@root/pages/SubjectDetails/ScheduleBox';

import Text from '@atoms/Text';
import { InlineRow, Container, Column, Row } from './SmallClassBox.styles';

interface Props extends SubjectClasses {
  selected: boolean;
  onPress: (group: SubjectClasses) => void;
  subject: SubjectInfo;
}

const SmallClassBox = (c: Props) => {
  const { onPress, selected, subject, ...subjectClass } = c;
  const hasMultipleTeachers = (c?.teachers as string[])?.length > 1;

  const teachers: string[] = c.teachers ?? [];
  const schedule: Horario[] = c.schedule ?? [];

  return (
    <TouchableOpacity onPress={() => onPress(subjectClass)}>
      <Container key={c.classNumber} color={selected ? 'FREE' : 'BUSY'}>
        <InlineRow>
          <Text size="XS" weight="bold" marginRight="auto">
            {subject.id}
          </Text>
          <Text size="XS" weight="bold" marginLeft="auto">
            Turma {c.classNumber}
            {c.hasPreference && ' - Preferencial'}
          </Text>
        </InlineRow>
        <InlineRow>
          <Text size="XS" marginRight="auto">
            {subject.name}
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
