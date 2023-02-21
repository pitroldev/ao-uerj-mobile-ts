import React, {useState, useRef} from 'react';
import {ListRenderItemInfo} from 'react-native';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import {Picker} from '@react-native-picker/picker';
import {FlatList} from 'react-native-gesture-handler';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import {useQuery} from 'react-query';

import {SUBJECT_TYPE} from '@utils/constants/subjectDictionary';
import {normalizeText} from '@utils/normalize';
import parser from '@services/parser';

import {useAppDispatch, useAppSelector} from '@root/store';

import * as infoReducer from '@reducers/userInfo';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as reducer from '@features/CurriculumSubjects/reducer';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import {CurriculumSubject} from '@features/CurriculumSubjects/types';
import {fetchCurriculumSubjects} from '@features/CurriculumSubjects/core';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import {Container} from './CurriculumSubjects.styles';

const HOUR_IN_MS = 1000 * 60 * 60;

const CurriculumSubjects = () => {
  const [subjectType, setSubjectType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {data} = useAppSelector(reducer.selectCurriculumSubjects);
  const {isBlocked} = useAppSelector(apiConfigReducer.selectApiConfig);
  const {periodo, matricula} = useAppSelector(infoReducer.selectUserInfo);

  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const ref = useRef<FlatList>(null);

  const {
    isFetching: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['curriculum-subjects', periodo, matricula],
    queryFn: fetchCurriculumSubjects,
    staleTime: 24 * HOUR_IN_MS,
    onSuccess: d => {
      dispatch(reducer.setState(d));
    },
  });

  const handleSubjectTypeChange = (value: string) => {
    setSubjectType(value);
    ref.current?.scrollToOffset({animated: true, offset: 0});
  };

  const handleSubjectPress = (subject: CurriculumSubject) => {
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
  }: ListRenderItemInfo<CurriculumSubject>) => {
    if (!subject) {
      return null;
    }

    const {name, id, type, credits, workload, branch, period} = subject;
    const creditText = credits ? `${credits} créditos` : '';
    const workloadText = credits ? `${workload} horas` : '';

    const periodText = period ? `${period}º Período` : '';

    const ramificationText = branch
      ? `${periodText ? ' - ' : ''}Ramificação ${branch}`
      : '';

    const description = `${periodText}${ramificationText}`;

    return (
      <SubjectBox
        topLeftInfo={id}
        topRightInfo={SUBJECT_TYPE[type] || type}
        name={name}
        description={description}
        bottomLeftInfo={creditText}
        bottomRightInfo={workloadText}
        boldOptions={{
          topLeft: true,
          name: true,
        }}
        onPress={() => handleSubjectPress(subject)}
      />
    );
  };

  const filteredData = data.filter(({type, name}) => {
    const hasSubjectType = !subjectType || type === subjectType;
    const hasSearchQuery =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));

    return hasSubjectType && hasSearchQuery;
  });

  const isEmpty = filteredData.length === 0;
  const showList = !isEmpty;
  const showSpinner = isEmpty && loading;

  if (isBlocked) {
    return (
      <Container>
        <DummyMessage
          type="BLOCK"
          text="Parece que o Aluno Online está temporariamente bloqueado. Tente novamente mais tarde."
          onPress={refetch}
        />
      </Container>
    );
  }

  return (
    <Container>
      <StyledPicker
        selectedValue={subjectType}
        onValueChange={s => handleSubjectTypeChange(s as string)}
        loading={loading}
        enabled={!loading}>
        <Picker.Item label={'Todas'} value={''} />
        <Picker.Item label={'Disciplinas Obrigatórias'} value={'MANDATORY'} />
        <Picker.Item label={'Eletivas Restritas'} value={'RESTRICTED'} />
        <Picker.Item label={'Eletivas Definidas'} value={'DEFINED'} />
      </StyledPicker>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Pesquise pelo nome da disciplina"
        icon={<FontAwesome name="search" size={15} />}
      />
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

export default CurriculumSubjects;
