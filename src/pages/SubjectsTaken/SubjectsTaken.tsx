import React, {useState, useEffect, useRef} from 'react';
import {ListRenderItemInfo} from 'react-native';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import {Picker} from '@react-native-picker/picker';
import {FlatList} from 'react-native-gesture-handler';
import {useQuery} from 'react-query';

import parser from '@services/parser';
import {SUBJECT_TYPE, SUBJECT_STATUS} from '@utils/constants/subjectDictionary';

import {useAppDispatch, useAppSelector} from '@root/store';

import * as infoReducer from '@reducers/userInfo';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as reducer from '@features/SubjectsTaken/reducer';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import {SubjectsTaken} from '@features/SubjectsTaken/types';
import {fetchSubjectsTaken} from '@features/SubjectsTaken/core';
import {getPeriodList} from '@features/SubjectsTaken/getPeriodList';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import {Container} from './SubjectsTaken.styles';

const HOUR_IN_MS = 1000 * 60 * 60;

const SubjectsAttended = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('');

  const {data} = useAppSelector(reducer.selectSubjectsAttended);
  const {isBlocked} = useAppSelector(apiConfigReducer.selectApiConfig);
  const {periodo, matricula} = useAppSelector(infoReducer.selectUserInfo);

  const periodList = getPeriodList(data);

  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const ref = useRef<FlatList>(null);

  const {
    isFetching: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subjects-taken', periodo, matricula],
    queryFn: fetchSubjectsTaken,
    staleTime: 24 * HOUR_IN_MS,
    onSuccess: d => {
      dispatch(reducer.setState(d));
    },
  });

  useEffect(() => {
    setSelectedPeriod(periodList?.length ? periodList[0]?.value : '');
  }, [data]);

  const handleSelectedPeriodChange = (value: string) => {
    setSelectedPeriod(value);
    ref.current?.scrollToOffset({animated: true, offset: 0});
  };

  const handleSubjectPress = (subject: SubjectsTaken) => {
    if (isBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Aluno Online bloqueado',
        text2: 'Tente novamente mais tarde.',
      });
      return;
    }
    const code = parser.parseSubjectCode(subject.id) as number;
    dispatch(subjectDetailReducer.appendData({code}));
    dispatch(subjectDetailReducer.select({code}));
    navigation.navigate('Pesquisa de Disciplinas');
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<SubjectsTaken>) => {
    if (!subject) {
      return null;
    }

    const {name, status, type, frequency, credits, grade, workload} = subject;

    const description = frequency !== null ? `Frequência ${frequency}%` : '';
    let creditsText = credits !== null ? `${credits} Créditos` : '';
    if (workload) {
      creditsText += ` | ${workload} horas`;
    }
    const gradeText = grade !== null ? `Nota ${grade}` : '';
    const color = (status as keyof typeof SUBJECT_STATUS) ?? 'TEXT_SECONDARY';

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

  const filteredData = data.filter(({period}) => {
    const isFromSamePeriod = selectedPeriod
      ? period === selectedPeriod
      : period === periodList[0]?.value;

    return isFromSamePeriod;
  });

  const isEmpty = filteredData.length === 0;
  const showList = !isEmpty;
  const showSpinner = isEmpty && loading;

  return (
    <Container>
      <StyledPicker
        selectedValue={selectedPeriod}
        onValueChange={s => handleSelectedPeriodChange(s as string)}
        loading={loading}
        enabled={!loading}>
        {periodList.map(({label, value}) => (
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
      {!loading && error && !isBlocked && (
        <DummyMessage
          type="ERROR"
          onPress={refetch}
          text="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
        />
      )}
      {!loading && !error && isEmpty && (
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
