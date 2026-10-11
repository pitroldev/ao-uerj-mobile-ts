import {
  useHistory,
  isPortalBlocked,
} from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import React, { useState, useRef } from 'react';
import { ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { FlatList } from 'react-native-gesture-handler';

import {
  SUBJECT_TYPE,
  SUBJECT_STATUS,
} from '@utils/constants/subjectDictionary';

import { SubjectsTaken } from '@root/modules/academics/domain/models';
import { getPeriodList } from '@root/modules/academics/domain/rules/progress';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import { Container } from './SubjectsTaken.styles';

const SubjectsAttended = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('');

  const query = useHistory();
  const { data = [], isLoading: loading, error, refetch } = query;
  const isBlocked = isPortalBlocked(error);
  const periodList = getPeriodList(data);

  const navigation = useNavigation();

  const ref = useRef<FlatList>(null);

  const handleSelectedPeriodChange = (value: string) => {
    setSelectedPeriod(value);
    ref.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const handleSubjectPress = (subject: SubjectsTaken) => {
    navigation.navigate('Pesquisa de Disciplinas', {
      subjectId: subject.id,
      sourceRoute: 'Disciplinas Realizadas',
    });
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<SubjectsTaken>) => {
    if (!subject) {
      return null;
    }

    const { name, status, type, frequency, credits, grade, workload } = subject;

    const description = frequency !== null ? `Frequência ${frequency}%` : '';
    let creditsText = credits !== null ? `${credits} Créditos` : '';
    if (workload) {
      creditsText += ` | ${workload} horas`;
    }
    const gradeText = grade !== null ? `Nota ${grade}` : '';
    const color = status === 'IN_PROGRESS' ? 'TEXT_SECONDARY' : status;

    return (
      <SubjectBox
        color={color}
        topLeftInfo={
          SUBJECT_STATUS[status as keyof typeof SUBJECT_STATUS] ?? status
        }
        topRightInfo={SUBJECT_TYPE[type as keyof typeof SUBJECT_TYPE] ?? type}
        name={name}
        description={description}
        bottomLeftInfo={gradeText}
        bottomRightInfo={creditsText}
        boldOptions={{
          topLeft: true,
          name: true,
          bottomLeft: true,
        }}
        onPress={() => handleSubjectPress(subject)}
      />
    );
  };

  const activePeriod = periodList.some(
    option => option.value === selectedPeriod,
  )
    ? selectedPeriod
    : periodList[0]?.value ?? '';

  const filteredData = data.filter(({ period }) => {
    const isFromSamePeriod = activePeriod
      ? period === activePeriod
      : period === periodList[0]?.value;

    return isFromSamePeriod;
  });

  const isEmpty = filteredData.length === 0;
  const showList = !isEmpty;
  const showSpinner = isEmpty && loading;

  return (
    <Container>
      <QueryNotice
        dataUpdatedAt={query.dataUpdatedAt}
        isPaused={query.isPaused}
        isFetching={query.isFetching}
        error={error}
        hasData={query.data !== undefined}
        retry={refetch}
      />
      <StyledPicker
        selectedValue={activePeriod}
        onValueChange={s => handleSelectedPeriodChange(s as string)}
        loading={loading}
        enabled={!loading}
      >
        {periodList.map(({ label, value }) => (
          <Picker.Item key={value} label={label} value={value} />
        ))}
      </StyledPicker>
      {isBlocked && showList && (
        <SmallDummyMessage
          type="BLOCK"
          text="O Aluno Online está temporariamente bloqueado."
          onPress={refetch}
        />
      )}
      {showSpinner && <Spinner size={40} />}
      {!loading && !!error && !isBlocked && !data.length && (
        <DummyMessage
          type="ERROR"
          onPress={refetch}
          text="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
        />
      )}
      {!loading && !query.isPaused && !error && isEmpty && (
        <DummyMessage
          type="EMPTY"
          text="Parece que não há disciplinas cursadas no período selecionado."
        />
      )}
      {showList && (
        <FlatList
          ref={ref}
          data={filteredData}
          renderItem={renderSubjects}
          showsVerticalScrollIndicator={false}
          keyExtractor={(_, index) => index.toString()}
        />
      )}
    </Container>
  );
};

export default SubjectsAttended;
