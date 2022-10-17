import React from 'react';
import {useNavigation} from '@react-navigation/native';

import * as subjectDetailReducer from '@root/features/SubjectClassesSchedule/reducer';

import {useAppDispatch} from '@root/store';
import {PartialRID} from '@root/features/PartialRID/types';

import parser from '@services/parser';
import {numberToColor} from '@utils/numberToColor';

import Text from '@atoms/Text';
import {SubjectBox, MiniBox, Container, Row, Button} from './RIDBoard.styles';

type Props = {
  data: {
    subjects: PartialRID[];
    updatedAt: string;
  };
};

const RIDBoard = ({data}: Props) => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const {subjects, updatedAt} = data;

  if (subjects.length === 0) {
    return null;
  }

  function handleOnPress(item: PartialRID) {
    const code = parser.parseSubjectCode(item.id);
    dispatch(subjectDetailReducer.appendData({code}));
    dispatch(subjectDetailReducer.select({code}));
    navigation.navigate('Pesquisa de Disciplinas');
  }

  function renderItem(item: PartialRID) {
    const {id, classNumber, name, available, requested, position, status} =
      item;

    const hasWarning = position === 0;
    const vacanciesColor = numberToColor(requested, available, true);
    const positionColor = hasWarning
      ? 'DISABLED'
      : numberToColor(position, available, true);
    return (
      <Button onPress={() => handleOnPress(item)} key={id}>
        <SubjectBox key={id}>
          <Row>
            <Text weight="500" size="XS" alignSelf="center">
              {id}
            </Text>
            <Text italic size="XS" alignSelf="center">
              Turma {classNumber}
            </Text>
          </Row>
          <Text size="SM">{name}</Text>

          <Row>
            <MiniBox color={vacanciesColor}>
              <Text weight="500" size="XS" alignSelf="center">
                Solicitadas/Oferecidas
              </Text>
              <Text italic size="XS" alignSelf="center">
                {requested}/{available}
              </Text>
            </MiniBox>
            <MiniBox color={positionColor}>
              <Text weight="500" size="XS" alignSelf="center">
                Sua Posição
              </Text>
              <Text italic size="XS" alignSelf="center">
                {position}
              </Text>
            </MiniBox>
          </Row>
          {hasWarning && (
            <Text
              weight="bold"
              size={'XXS'}
              alignSelf="center"
              marginTop="10px"
              color={'ERROR'}>
              {status}
            </Text>
          )}
        </SubjectBox>
      </Button>
    );
  }

  return (
    <Container>
      <Text weight="bold" marginLeft="12px">
        RID Parcial
      </Text>
      <Text italic size="SM" marginLeft="12px">
        Última atualização em {updatedAt.trim()}
      </Text>
      {subjects?.map(renderItem)}
      <Text />
    </Container>
  );
};

export default React.memo(RIDBoard, (prev, next) => {
  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return true;
  }
  return false;
});
