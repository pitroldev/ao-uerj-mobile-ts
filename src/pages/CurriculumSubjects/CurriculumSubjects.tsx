import React, { useState, useRef, useEffect } from 'react';
import { ListRenderItemInfo } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { FlatList } from 'react-native-gesture-handler';
import { FontAwesome } from '@react-native-vector-icons/fontawesome';
import { useQuery } from '@tanstack/react-query';

import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';
import { normalizeText } from '@utils/normalize';
import parser from '@services/parser';

import { useAppDispatch, useAppSelector } from '@root/store';

import * as apiConfigReducer from '@reducers/apiConfig';
import * as reducer from '@features/CurriculumSubjects/reducer';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import { CurriculumSubject } from '@features/CurriculumSubjects/types';
import { fetchCurriculumSubjects } from '@features/CurriculumSubjects/core';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import TextInput from '@atoms/TextInput';
import Text from '@atoms/Text';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import { Container, Row, View } from './CurriculumSubjects.styles';

const HOUR_IN_MS = 1000 * 60 * 60;

const CurriculumSubjects = () => {
  const [subjectAlreadyTaken, setSubjectAlreadyTaken] = useState(false);
  const [subjectType, setSubjectType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data } = useAppSelector(reducer.selectCurriculumSubjects);
  const { isBlocked, cookies, createdAt } = useAppSelector(
    apiConfigReducer.selectApiConfig,
  );

  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const ref = useRef<FlatList>(null);

  const {
    data: curriculumData,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['curriculum-subjects', cookies, createdAt],
    queryFn: fetchCurriculumSubjects,
    staleTime: 24 * HOUR_IN_MS,
    enabled: Boolean(cookies),
    retry: 0,
  });

  useEffect(() => {
    if (curriculumData) {
      dispatch(reducer.setState(curriculumData));
    }
  }, [curriculumData, dispatch]);

  const handleSubjectTypeChange = (value: string) => {
    setSubjectType(value);
    ref.current?.scrollToOffset({ animated: true, offset: 0 });
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
    dispatch(
      subjectDetailReducer.setCurrent({
        code,
        sourceRoute: 'Disciplinas do Currículo',
      }),
    );
    navigation.navigate('Pesquisa de Disciplinas');
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<CurriculumSubject>) => {
    if (!subject) {
      return null;
    }

    const { name, id, type, credits, workload, branch, period, alreadyTaken } =
      subject;
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
        color={alreadyTaken ? 'GOOD' : undefined}
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

  const filteredData = data.filter(({ type, name, alreadyTaken }) => {
    const hasSubjectType = !subjectType || type === subjectType;
    const hasSearchQuery =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));
    const hasSubjectAlreadyTaken = subjectAlreadyTaken === alreadyTaken;

    return hasSubjectType && hasSearchQuery && hasSubjectAlreadyTaken;
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
      <Row>
        <View>
          <StyledPicker
            selectedValue={subjectType}
            onValueChange={s => handleSubjectTypeChange(s as string)}
            loading={loading}
            enabled={!loading}
          >
            <Picker.Item label={'Todas as Disciplinas'} value={''} />
            <Picker.Item
              label={'Disciplinas Obrigatórias'}
              value={'MANDATORY'}
            />
            <Picker.Item label={'Eletivas Restritas'} value={'RESTRICTED'} />
            <Picker.Item label={'Eletivas Definidas'} value={'DEFINED'} />
            <Picker.Item label={'Universais'} value={'UNIVERSAL'} />
          </StyledPicker>
        </View>
        <View>
          <StyledPicker
            selectedValue={subjectAlreadyTaken}
            onValueChange={s => setSubjectAlreadyTaken(s as boolean)}
            loading={loading}
            enabled={!loading}
          >
            <Picker.Item label={'Não Atendidas'} value={false} />
            <Picker.Item label={'Atendidas'} value={true} />
          </StyledPicker>
        </View>
      </Row>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Pesquise pelo nome da disciplina"
        icon={<FontAwesome name="search" size={15} />}
      />
      {!loading && !isBlocked && !error && (
        <Text size="SM" marginTop="8px" marginBottom="8px" marginLeft="5px">
          Exibindo {filteredData.length} disciplina
          {filteredData.length === 1 ? '' : 's'}
        </Text>
      )}
      {isBlocked && showList && (
        <SmallDummyMessage
          type="BLOCK"
          text="O Aluno Online está temporariamente bloqueado."
          onPress={refetch}
        />
      )}
      {showSpinner && <Spinner size={40} />}
      {!loading && (error as Error) && !isBlocked && (
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
