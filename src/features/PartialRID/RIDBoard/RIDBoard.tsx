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
    const code = parser.parseCodigo(item.id);
    dispatch(subjectDetailReducer.appendData({code}));
    dispatch(subjectDetailReducer.select({code}));
    navigation.navigate('Pesquisa de Disciplinas');
  }

  function renderItem(item: PartialRID) {
    const {id, classNumber, name, available, requested, position} = item;

    return (
      <Button onPress={() => handleOnPress(item)}>
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
            <MiniBox color={numberToColor(requested, available)}>
              <Text weight="500" size="XS" alignSelf="center">
                Solicitadas/Oferecidas
              </Text>
              <Text italic size="XS" alignSelf="center">
                {requested}/{available}
              </Text>
            </MiniBox>
            <MiniBox color={numberToColor(position, available)}>
              <Text weight="500" size="XS" alignSelf="center">
                Sua Posição
              </Text>
              <Text italic size="XS" alignSelf="center">
                {position}
              </Text>
            </MiniBox>
          </Row>
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
