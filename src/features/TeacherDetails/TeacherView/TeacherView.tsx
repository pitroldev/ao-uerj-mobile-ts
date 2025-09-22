import React from 'react';
import moment from 'moment';
import { ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

import { Docente } from '../types';

import { useAppDispatch, useAppSelector } from '@root/store';
import * as apiConfigReducer from '@reducers/apiConfig';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import parser from '@services/parser';

import Text from '@atoms/Text';
import SubjectBox from '@molecules/SubjectBox';

type SubjectClass = {
  subject: {
    name: string;
    id: string;
  };
  classNumber: string;
  location: string;
};

const TeacherView = (props: Docente) => {
  const { createdAt, disciplinas, docente: name } = props;

  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { isBlocked } = useAppSelector(apiConfigReducer.selectApiConfig);

  const handleSubjectPress = (item: SubjectClass) => {
    if (isBlocked) {
      Toast.show({
        type: 'error',
        text1: 'Aluno Online bloqueado',
        text2: 'Tente novamente mais tarde.',
      });
      return;
    }
    const code = parser.parseSubjectCode(item.subject.id) as number;
    dispatch(subjectDetailReducer.appendData({ code }));
    dispatch(subjectDetailReducer.select({ code }));
    navigation.navigate('Pesquisa de Disciplinas');
  };

  const lastUpdatedAt = moment(createdAt).format('DD/MM/yyyy');

  const subjects = Object.entries(disciplinas);
  const subjectClasses = subjects.reduce((acc, [id, data]) => {
    const subject = {
      name: data.disciplina,
      id,
    };
    data.turmas.forEach(t => {
      acc.push({ subject, classNumber: t.turma, location: t.local });
    });
    return acc;
  }, [] as SubjectClass[]);

  return (
    <>
      <Text weight="bold" size="XL">
        {name}
      </Text>
      <Text italic size="SM">
        Atualizado em: {lastUpdatedAt}
      </Text>
      <Text weight="bold" marginTop="12px" marginBottom="8px">
        Discplinas Ministradas
      </Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {subjectClasses.map(c => (
          <SubjectBox
            key={c.subject.id + c.classNumber}
            name={parser.parseSubjectName(c.subject.name)}
            topLeftInfo={parser.parseSubjectID(c.subject.name)}
            topRightInfo={`Turma ${c.classNumber}`}
            bottomLeftInfo={c.location ?? null}
            onPress={() => handleSubjectPress(c)}
            boldOptions={{ name: true }}
          />
        ))}
      </ScrollView>
    </>
  );
};

export default TeacherView;
