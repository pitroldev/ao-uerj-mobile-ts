import React, {useState, useEffect, useRef} from 'react';
import {RefreshControl, ListRenderItemInfo} from 'react-native';
import Toast from 'react-native-toast-message';
import {Picker} from '@react-native-picker/picker';
import {FlatList} from 'react-native-gesture-handler';
import {useNavigation} from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import useApiFetch from '@hooks/useApiFetch';
import useRefresh from '@hooks/useRefresh';
import {normalizeText} from '@utils/normalize';
import parser from '@root/services/parser';

import {useAppDispatch, useAppSelector} from '@root/store';

import * as apiConfigReducer from '@reducers/apiConfig';
import * as reducer from '@features/ClassesScheduleByDepartment/reducer';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import {SubjectByUnit} from '@features/ClassesScheduleByDepartment/types';
import {fetchClassesScheduleByDepartment} from '@features/ClassesScheduleByDepartment/core';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';
import DummyMessage from '@molecules/DummyMessage';
import SmallDummyMessage from '@molecules/SmallDummyMessage';

import {Container} from './ClassSchedulesByDepartment.styles';

const ClassesScheduleByUnit = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | undefined>(
    undefined,
  );

  const {isBlocked} = useAppSelector(apiConfigReducer.selectApiConfig);
  const {subjects, options} = useAppSelector(
    reducer.selectClassSchedulesByDepartment,
  );

  const {loading, fetch, error} = useApiFetch(() =>
    fetchClassesScheduleByDepartment(selectedOption),
  );

  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const {refreshing, toggleRefresh} = useRefresh(fetch);

  const ref = useRef<FlatList>(null);
  const refreshRef = useRef<RefreshControl>(null);

  useEffect(() => {
    fetch();
  }, [selectedOption]);

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

  const handleSubjectPress = (subject: SubjectByUnit) => {
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
  }: ListRenderItemInfo<SubjectByUnit>) => {
    if (!subject) {
      return null;
    }

    const {id, name} = subject;

    return (
      <SubjectBox
        key={id}
        topLeftInfo={id}
        name={name}
        boldOptions={{
          topLeft: true,
          name: true,
        }}
        onPress={() => handleSubjectPress(subject)}
      />
    );
  };

  const filteredSubjects = subjects.filter(({name}) => {
    const hasSearchQuery =
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
          onPress={fetch}
        />
      </Container>
    );
  }

  return (
    <Container>
      <StyledPicker
        selectedValue={currentSelectedOption?.value}
        onValueChange={s => handleOptionChange(s as string)}
        enabled={!loading}
        loading={loading}>
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
          onPress={fetch}
        />
      )}
      {showSpinner && <Spinner size={40} />}
      {!loading && error && !isBlocked && (
        <DummyMessage
          type="ERROR"
          onPress={fetch}
          text="Ops, ocorreu um erro ao buscar as disciplinas. Toque aqui para tentar novamente."
        />
      )}
      {!loading && isEmpty && (
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
          waitFor={refreshRef}
          refreshControl={
            <RefreshControl
              enabled
              onRefresh={toggleRefresh}
              refreshing={refreshing}
              ref={refreshRef}
            />
          }
        />
      )}
    </Container>
  );
};

export default ClassesScheduleByUnit;
