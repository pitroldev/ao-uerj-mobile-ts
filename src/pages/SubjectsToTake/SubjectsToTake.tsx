import React, { useState, useRef, useEffect } from 'react';
import { ListRenderItemInfo } from 'react-native';
import Toast from 'react-native-toast-message';
import { Picker } from '@react-native-picker/picker';
import { FlatList } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome } from '@react-native-vector-icons/fontawesome';
import { useQuery } from '@tanstack/react-query';

import { normalizeText } from '@utils/normalize';
import parser from '@services/parser';

import { useAppDispatch, useAppSelector } from '@root/store';

import { SubjectToTake } from '@features/SubjectsToTake/types';
import { fetchSubjectsToTake } from '@features/SubjectsToTake/core';

import * as apiConfigReducer from '@reducers/apiConfig';
import * as reducer from '@features/SubjectsToTake/reducer';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import { Container } from './SubjectsToTake.styles';

const HOUR_IN_MS = 1000 * 60 * 60;

const SubjectsToTake = () => {
  const [subjectType, setSubjectType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data } = useAppSelector(reducer.selectSubjectsToTake);
  const { isBlocked, cookies } = useAppSelector(
    apiConfigReducer.selectApiConfig,
  );

  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const ref = useRef<FlatList>(null);

  const {
    data: subjectsData,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subjects-to-take', cookies],
    queryFn: fetchSubjectsToTake,
    staleTime: 24 * HOUR_IN_MS,
    enabled: Boolean(cookies),
    retry: 0,
  });

  useEffect(() => {
    if (subjectsData) {
      dispatch(reducer.setState(subjectsData));
    }
  }, [subjectsData, dispatch]);

  const handleSubjectTypeChange = (value: string) => {
    setSubjectType(value);
    ref.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const handleSubjectPress = (subject: SubjectToTake) => {
    if (isBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Aluno Online bloqueado',
        text2: 'Tente novamente mais tarde.',
      });
      return;
    }

    const code = parser.parseSubjectCode(subject.id) as number;
    // dispatch(subjectDetailReducer.appendData({ code }));
    // dispatch(subjectDetailReducer.select({ code }));
    navigation.navigate('Pesquisa de Disciplinas');
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<SubjectToTake>) => {
    if (!subject) {
      return null;
    }

    const {
      has_prerequisites,
      allow_conflict,
      id,
      minimum_credits,
      name,
      period,
      branch,
      group,
    } = subject;

    const requirementText = has_prerequisites ? '' : 'Não possui pré-requisito';
    const conflictText = allow_conflict ? 'Permite conflito' : '';

    const creditsText = minimum_credits
      ? `Trava de ${minimum_credits} créditos`
      : '';

    const periodText = period ? `${period}º Período` : '';

    const ramificationText = branch
      ? `${periodText ? ' - ' : ''}Ramificação ${branch}`
      : '';

    const groupText = group
      ? `${ramificationText ? ' - ' : ''}Grupo ${group}`
      : '';

    const description = `${periodText}${ramificationText}${groupText}`;

    return (
      <SubjectBox
        topLeftInfo={id}
        topRightInfo={creditsText}
        name={name}
        description={description}
        bottomLeftInfo={requirementText}
        bottomRightInfo={conflictText}
        boldOptions={{
          topLeft: true,
          name: true,
        }}
        onPress={() => handleSubjectPress(subject)}
      />
    );
  };

  const filteredData = data.filter(({ type, name }) => {
    const hasSubjectType = !subjectType || type === subjectType;
    const hasSearchQuery =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));

    return hasSubjectType && hasSearchQuery;
  });

  const isEmpty = filteredData.length === 0;
  const showList = !isEmpty;
  const showSpinner = isEmpty && loading;

  const quantities = {
    all: data.length,
    mandatory: data.filter(({ type }) => type === 'MANDATORY').length,
    restricted: data.filter(({ type }) => type === 'RESTRICTED').length,
    defined: data.filter(({ type }) => type === 'DEFINED').length,
  };

  return (
    <Container>
      <StyledPicker
        selectedValue={subjectType}
        onValueChange={s => handleSubjectTypeChange(s as string)}
        loading={loading}
        enabled={!loading}
      >
        <Picker.Item label={`Todas (${quantities.all})`} value={''} />
        <Picker.Item
          label={`Disciplinas Obrigatórias (${quantities.mandatory})`}
          value={'MANDATORY'}
        />
        <Picker.Item
          label={`Eletivas Restritas (${quantities.restricted})`}
          value={'RESTRICTED'}
        />
        <Picker.Item
          label={`Eletivas Definidas (${quantities.defined})`}
          value={'DEFINED'}
        />
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
      {!loading && !!error && !isBlocked && (
        <DummyMessage
          type="ERROR"
          onPress={refetch}
          text="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
        />
      )}
      {!loading && !error && isEmpty && (
        <DummyMessage
          type="EMPTY"
          text="Parece que não há disciplinas a cursar nessa categoria."
        />
      )}
      {showSpinner && <Spinner size={40} />}
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

export default SubjectsToTake;
