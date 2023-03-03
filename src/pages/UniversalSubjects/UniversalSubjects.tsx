import React, {useState, useRef} from 'react';
import {ListRenderItemInfo} from 'react-native';
import Toast from 'react-native-toast-message';
import {Picker} from '@react-native-picker/picker';
import {FlatList} from 'react-native-gesture-handler';
import {useNavigation} from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import {useQuery} from 'react-query';

import {normalizeText} from '@utils/normalize';
import parser from '@services/parser';

import {useAppDispatch, useAppSelector} from '@root/store';

import * as infoReducer from '@reducers/userInfo';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as reducer from '@features/UniversalSubjects/reducer';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import {UniversalSubject} from '@features/UniversalSubjects/types';
import {fetchUniversalSubjects} from '@features/UniversalSubjects/core';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import {Container} from './UniversalSubjects.styles';

const HOUR_IN_MS = 1000 * 60 * 60;

const UniversalSubjects = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | undefined>(
    undefined,
  );

  const {isBlocked} = useAppSelector(apiConfigReducer.selectApiConfig);
  const {subjects, options} = useAppSelector(reducer.selectUniversalSubjects);
  const {periodo} = useAppSelector(infoReducer.selectUserInfo);

  const {
    isFetching: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['universal-subjects', periodo, selectedOption],
    queryFn: () => fetchUniversalSubjects(selectedOption),
    staleTime: 24 * HOUR_IN_MS,
  });

  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  const ref = useRef<FlatList>(null);

  const handleOptionChange = (value: string) => {
    const newOptions = options.map(option => {
      if (option.value === value) {
        return {...option, selected: true};
      }
      return {...option, selected: false};
    });
    dispatch(reducer.setOptions(newOptions));
    setSelectedOption(value);
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
    dispatch(subjectDetailReducer.appendData({code}));
    dispatch(subjectDetailReducer.select({code}));
    navigation.navigate('Pesquisa de Disciplinas');
  };

  const renderSubjects = ({
    item: subject,
  }: ListRenderItemInfo<UniversalSubject>) => {
    if (!subject) {
      return null;
    }

    const {has_prerequisites, allow_conflict, id, minimum_credits, name} =
      subject;

    const requirementText = has_prerequisites ? 'Possui pré-requisito' : '';
    const conflictText = allow_conflict ? '' : 'Não permite conflito';

    const creditsText = minimum_credits
      ? `Trava de ${minimum_credits} créditos`
      : '';

    return (
      <SubjectBox
        key={id}
        topLeftInfo={id}
        topRightInfo={creditsText}
        name={name}
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

  const filteredSubjects = subjects.filter(({name}) => {
    const hasSearchQuery: boolean =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));

    return hasSearchQuery;
  });

  const isEmpty = filteredSubjects.length === 0;
  const showList = !isEmpty;
  const showSpinner = isEmpty && loading;

  const currentSelectedOption = options.find(opt => opt.selected);

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
        selectedValue={currentSelectedOption?.value}
        onValueChange={s => handleOptionChange(s as string)}
        loading={loading}
        enabled={!loading}>
        {options.map(({value, text}) => {
          return <Picker.Item value={value} key={value} label={text} />;
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
          text="Parece que não há disciplinas no departamento selecionado."
        />
      )}
      {showList && (
        <FlatList
          ref={ref}
          data={filteredSubjects}
          renderItem={renderSubjects}
          showsVerticalScrollIndicator={false}
          keyExtractor={item => item?.id}
        />
      )}
    </Container>
  );
};

export default UniversalSubjects;
