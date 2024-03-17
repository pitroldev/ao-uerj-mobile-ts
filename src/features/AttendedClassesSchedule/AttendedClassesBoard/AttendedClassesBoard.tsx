import React from 'react';
import Modal from 'react-native-modal';
import {TouchableOpacity} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import parser from '@services/parser';
import {useAppDispatch} from '@root/store';

import {AttendedClassesSchedule} from '@features/AttendedClassesSchedule/types';
import * as subjectDetailReducer from '@features/SubjectClassesSchedule/reducer';

import Text from '@atoms/Text';
import SubjectBox from '@molecules/SubjectBox';

import {View} from './AttendedClassesBoard.styles';

type Props = {
  isVisible: boolean;
  setVisibility: React.Dispatch<React.SetStateAction<boolean>>;
  data: AttendedClassesSchedule[];
};

const AttendedClassesBoard = ({isVisible, setVisibility, data}: Props) => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();

  if (!data) {
    return null;
  }

  const subjects = data.reduce((acc, c) => {
    const alreadyHasSubject = acc.some(s => s.id === c.class.id);
    if (!alreadyHasSubject) {
      acc.push(c.class);
    }
    return acc;
  }, [] as AttendedClassesSchedule['class'][]);

  function handleOnPress(item: AttendedClassesSchedule['class']) {
    const code = parser.parseSubjectCode(item.id) as number;

    setVisibility(false);
    dispatch(subjectDetailReducer.setCurrent({code}));
    navigation.navigate('Pesquisa de Disciplinas');
  }

  function renderItem(item: AttendedClassesSchedule['class']) {
    const {id, name, status, uerjLocation} = item;

    const isCanceled = status === 'CANCELED';
    const hasLocal = !!uerjLocation;
    const parsedLocal = hasLocal ? `- ${uerjLocation}` : '';
    return (
      <TouchableOpacity key={id} onPress={() => handleOnPress(item)}>
        <SubjectBox
          key={id}
          topLeftInfo={id}
          topRightInfo={
            isCanceled ? 'Cancelada' : `Turma ${item.class} ${parsedLocal}`
          }
          name={name}
          boldOptions={{topLeft: true}}
          color={isCanceled ? 'CANCELED' : undefined}
        />
      </TouchableOpacity>
    );
  }

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={() => setVisibility(false)}
      onBackButtonPress={() => setVisibility(false)}
      useNativeDriver
      animationIn={'fadeInDown'}
      animationInTiming={150}
      animationOut={'fadeOutUp'}
      animationOutTiming={150}>
      <View>
        <Text weight="bold" alignSelf="center" marginBottom="8px">
          Disciplinas em Curso
        </Text>
        {subjects.map(renderItem)}
      </View>
    </Modal>
  );
};

export default React.memo(AttendedClassesBoard, (prev, next) => {
  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return true;
  }
  return false;
});
