import React, {useState, useEffect, useRef} from 'react';
import {RefreshControl, ListRenderItemInfo} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {FlatList} from 'react-native-gesture-handler';
import {useNavigation} from '@react-navigation/native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

import useUerjFetch from '@hooks/useUerjFetch';
import useRefresh from '@hooks/useRefresh';
import {normalizeText} from '@root/utils/normalize';
import parser from '@root/services/parser';

import {SubjectToTake} from '@root/types/subjectsToTake';

import {fetchSubjectsToTake} from '@features/api/fetchSubjectsToTake';

import {useAppDispatch, useAppSelector} from '@root/store';
import * as reducer from '@root/reducers/subjectsToTake';
import * as subjectDetailReducer from '@root/reducers/subjectClassesSearch';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import TextInput from '@atoms/TextInput';
import SubjectBox from '@molecules/SubjectBox';

import {Container} from './SubjectsToTake.styles';

const SubjectsToTake = () => {
  const [subjectType, setSubjectType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {data} = useAppSelector(reducer.selectSubjectsToTake);
  const {loading, fetch} = useUerjFetch(fetchSubjectsToTake);

  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const {refreshing, toggleRefresh} = useRefresh(fetch);

  const ref = useRef<FlatList>(null);
  const refreshRef = useRef<RefreshControl>(null);

  useEffect(() => {
    fetch();
  }, []);

  const handleSubjectTypeChange = (value: string) => {
    setSubjectType(value);
    ref.current?.scrollToOffset({animated: true, offset: 0});
  };

  const handleSubjectPress = (subject: SubjectToTake) => {
    const code = parser.parseCodigo(subject.id);
    dispatch(subjectDetailReducer.appendData({code}));
    dispatch(subjectDetailReducer.select({code}));
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

    const requirementText = has_prerequisites ? 'Possui pré-requisito' : '';
    const conflictText = allow_conflict ? '' : 'Não permite conflito';

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

  const filteredData = data.filter(({type, name}) => {
    const hasSubjectType = !subjectType || type === subjectType;
    const hasSearchQuery =
      !searchQuery || normalizeText(name).includes(normalizeText(searchQuery));

    return hasSubjectType && hasSearchQuery;
  });

  const isEmpty = filteredData.length === 0;
  const showList = !isEmpty;
  const showSpinner = isEmpty && loading;

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
      {showSpinner && <Spinner size={40} />}
      {showList && (
        <FlatList
          ref={ref}
          data={filteredData}
          renderItem={renderSubjects}
          showsVerticalScrollIndicator={false}
          keyExtractor={(_, index) => index.toString()}
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

export default SubjectsToTake;
