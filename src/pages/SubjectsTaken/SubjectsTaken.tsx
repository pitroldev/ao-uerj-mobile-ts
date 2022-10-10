import React, {useState, useEffect, useRef} from 'react';
import {RefreshControl, ListRenderItemInfo} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Picker} from '@react-native-picker/picker';
import {FlatList} from 'react-native-gesture-handler';

import useUerjFetch from '@hooks/useUerjFetch';
import useRefresh from '@hooks/useRefresh';
import parser from '@services/parser';

import {SubjectsTaken} from '@features/SubjectsTaken/types';

import {fetchSubjectsTaken} from '@features/SubjectsTaken/fetchSubjectsTaken';

import {useAppDispatch, useAppSelector} from '@root/store';
import * as reducer from '@features/SubjectsTaken/reducer';
import * as subjectDetailReducer from '@root/features/SubjectClassesSchedule/reducer';

import Spinner from '@atoms/Spinner';
import StyledPicker from '@atoms/Picker';
import SubjectBox from '@molecules/SubjectBox';

import {Container} from './SubjectsTaken.styles';
import {SUBJECT_TYPE, SUBJECT_STATUS} from '@utils/constants/subjectDictionary';
import {getPeriodList} from '@features/SubjectsTaken/getPeriodList';

const SubjectsAttended = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('');

  const {data} = useAppSelector(reducer.selectSubjectsAttended);
  const periodList = getPeriodList(data);

  const {loading, fetch} = useUerjFetch(fetchSubjectsTaken);

  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const {refreshing, toggleRefresh} = useRefresh(fetch);

  const ref = useRef<FlatList>(null);
  const refreshRef = useRef<RefreshControl>(null);

  useEffect(() => {
    fetch();
  }, []);

  useEffect(() => {
    setSelectedPeriod(periodList?.length ? periodList[0]?.value : '');
  }, [data]);

  const handleSelectedPeriodChange = (value: string) => {
    setSelectedPeriod(value);
    ref.current?.scrollToOffset({animated: true, offset: 0});
  };

  const handleSubjectPress = (subject: SubjectsTaken) => {
    const code = parser.parseCodigo(subject.id);
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

export default SubjectsAttended;
