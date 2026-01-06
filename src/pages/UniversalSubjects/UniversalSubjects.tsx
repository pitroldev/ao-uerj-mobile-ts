import React, { useState, useRef } from 'react';
import { ListRenderItemInfo } from 'react-native';
import Toast from 'react-native-toast-message';
import { Picker } from '@react-native-picker/picker';
import { FlatList } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome } from '@react-native-vector-icons/fontawesome';
import { useQuery } from '@tanstack/react-query';

import { normalizeText } from '@utils/normalize';
import { UERJ_UNIT_OPTIONS } from '@root/utils/constants/unitOptions';
import parser from '@services/parser';

import { useAppDispatch, useAppSelector } from '@root/store';

import * as infoReducer from '@reducers/userInfo';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as reducer from '@features/UniversalSubjects/reducer';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import { UniversalSubject } from '@features/UniversalSubjects/types';
import { fetchUniversalSubjects } from '@features/UniversalSubjects/core';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import { Container } from './UniversalSubjects.styles';

const HOUR_IN_MS = 1000 * 60 * 60;

const UniversalSubjects = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<
    string | undefined
  >(undefined);

  const { periodo } = useAppSelector(infoReducer.selectUserInfo);
  const { isBlocked } = useAppSelector(apiConfigReducer.selectApiConfig);
  const { subjects } = useAppSelector(reducer.selectUniversalSubjects);

  const departmentOptions = subjects
    .reduce(
      (acc, subject) => {
        const [departmentCode] = subject.id.split('-');
        const onlyLettersDepartmentCode = departmentCode.replace(/\d/g, '');

        const alreadyHasDepartment = acc.some(({ value }) =>
          value.includes(onlyLettersDepartmentCode),
        );
        if (alreadyHasDepartment) {
          return acc;
        }

        const label =
          UERJ_UNIT_OPTIONS.find(({ text }) =>
            text.includes(onlyLettersDepartmentCode),
          )?.text || departmentCode;

        return [...acc, { value: onlyLettersDepartmentCode, label }];
      },
      [] as {
        value: string;
        label: string;
      }[],
    )
    .sort((a, b) => a.label.localeCompare(b.label));

  const {
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['universal-subjects', periodo],
    queryFn: () => fetchUniversalSubjects(),
    staleTime: 24 * HOUR_IN_MS,
  });

  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const ref = useRef<FlatList>(null);

  const handleOptionChange = (value: string) => {
    setSelectedDepartment(value);
  };

  const handleSubjectPress = (subject: UniversalSubject) => {
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
        sourceRoute: 'Disciplinas Universais',
      }),
    );
    navigation.navigate('Pesquisa de Disciplinas');
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<UniversalSubject>) => {
    if (!subject) {
      return null;
    }

    const { workload, id, credits, name } = subject;

    const creditText = credits ? `${credits} créditos` : '';
    const workloadText = credits ? `${workload} horas` : '';

    return (
      <SubjectBox
        key={id}
        topLeftInfo={id}
        topRightInfo={'Universal'}
        name={name}
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

  const filteredSubjects = subjects?.filter(({ name, id }) => {
    const hasDepartmentMatch =
      !selectedDepartment || id.includes(selectedDepartment);
    const hasSearchQuery: boolean =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));

    return hasSearchQuery && hasDepartmentMatch;
  });

  const isEmpty = filteredSubjects?.length === 0;
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
        selectedValue={selectedDepartment}
        onValueChange={s => handleOptionChange(s as string)}
        loading={loading}
        enabled={!loading}
      >
        <Picker.Item value={undefined} label="Todos os departamentos" />
        {departmentOptions.map(({ value, label }) => {
          return <Picker.Item value={value} key={value} label={label} />;
        })}
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
      {!loading && (error as Error) && !isBlocked && (
        <DummyMessage
          type="ERROR"
          onPress={refetch}
          text="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
        />
      )}
      {!loading && !error && isEmpty && (
        <DummyMessage
          type="EMPTY"
          text="Parece que não há disciplinas no departamento selecionado."
        />
      )}
      {showList && (
        <FlatList
          ref={ref}
          data={filteredSubjects || []}
          renderItem={renderSubjects}
          showsVerticalScrollIndicator={false}
          keyExtractor={item => item?.id}
        />
      )}
    </Container>
  );
};

export default UniversalSubjects;
