import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useSchedule } from '@root/modules/academics/presentation/queries';
import type { AttendedSubjectInfo } from '@root/modules/academics/domain/models';
import { errorMessage } from '@root/shared/errors/AppError';
import Spinner from '@atoms/Spinner';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import { Container } from './SubjectList.styles';

type Props = { onSubjectPress: (item: AttendedSubjectInfo) => void };

const SubjectList = ({ onSubjectPress }: Props) => {
  const query = useSchedule();
  const subjects = (query.data ?? []).reduce((acc, item) => {
    if (
      item.class.status !== 'CANCELED' &&
      !acc.some(
        subject =>
          subject.id === item.class.id && subject.class === item.class.class,
      )
    )
      acc.push(item.class);
    return acc;
  }, [] as AttendedSubjectInfo[]);
  if (query.isLoading) return <Spinner loading size="large" />;
  if (query.error && !query.data)
    return (
      <DummyMessage
        type="ERROR"
        text={errorMessage(query.error)}
        onPress={() => {
          void query.refetch();
        }}
      />
    );
  if (subjects.length === 0)
    return (
      <DummyMessage
        type="EMPTY"
        text="Parece que você não está inscrito em nenhuma disciplina no momento."
      />
    );
  return (
    <Container>
      {subjects.map(subject => (
        <TouchableOpacity
          key={`${subject.id}-${subject.class}`}
          onPress={() => onSubjectPress(subject)}
        >
          <SubjectBox
            topLeftInfo={subject.id}
            topRightInfo={`Turma ${subject.class}`}
            name={subject.name}
            boldOptions={{ topLeft: true }}
          />
        </TouchableOpacity>
      ))}
    </Container>
  );
};

export default SubjectList;
