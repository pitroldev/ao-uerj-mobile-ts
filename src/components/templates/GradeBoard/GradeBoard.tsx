import React from 'react';

import {ClassGrade} from '@root/types/classGrades';

import Text from '@atoms/Text';
import {
  Container,
  Row,
  NotasRow,
  Column,
  BoxContainer,
  MiniBox,
} from './GradeBoard.styles';

type Props = {
  data: ClassGrade[];
};

function numberToColor(grade: unknown, base = 10) {
  if (typeof grade !== 'number') {
    return 'CANCELED';
  }

  const percent = grade / base;

  if (percent >= 0.8) {
    return 'GOOD';
  }
  if (percent >= 0.6) {
    return 'BAD';
  }

  return 'CRITICAL';
}

const GradeBoard = ({data}: Props) => {
  function disciplinaBox(subject: ClassGrade) {
    const {grades, id, name} = subject;

    const hasTests =
      typeof grades.p1 === 'number' ||
      typeof grades.p2 === 'number' ||
      typeof grades.pf === 'number';

    const hasResult = typeof grades.result === 'number';

    const hasGrades = hasTests || hasResult;

    if (!hasGrades) {
      return null;
    }

    return (
      <BoxContainer key={id}>
        <Row>
          <Column>
            <Text italic size="XS">
              {id}
            </Text>
            <Text weight="500" size="SM">
              {name}
            </Text>
          </Column>
          {hasResult && !hasTests && (
            <MiniBox color={numberToColor(grades.result)}>
              <Text weight="bold" size="XS" alignSelf="center">
                Média
              </Text>
              <Text italic size="XS" alignSelf="center">
                {grades.result ?? '-'}
              </Text>
            </MiniBox>
          )}
        </Row>
        {hasTests && (
          <NotasRow>
            <MiniBox color={numberToColor(grades.p1)}>
              <Text weight="bold" size="XS" alignSelf="center">
                P1
              </Text>
              <Text italic size="XS" alignSelf="center">
                {grades.p1 ?? '-'}
              </Text>
            </MiniBox>
            <MiniBox color={numberToColor(grades.p2)}>
              <Text weight="bold" size="XS" alignSelf="center">
                P2
              </Text>
              <Text italic size="XS" alignSelf="center">
                {grades.p2 ?? '-'}
              </Text>
            </MiniBox>
            <MiniBox color={numberToColor(grades.pf)}>
              <Text weight="bold" size="XS" alignSelf="center">
                PF
              </Text>
              <Text italic size="XS" alignSelf="center">
                {grades.pf ?? '-'}
              </Text>
            </MiniBox>
            <MiniBox color={numberToColor(grades.result)}>
              <Text weight="bold" size="XS" alignSelf="center">
                Média
              </Text>
              <Text italic size="XS" alignSelf="center">
                {grades.result ?? '-'}
              </Text>
            </MiniBox>
          </NotasRow>
        )}
      </BoxContainer>
    );
  }

  return <Container>{data?.map(disciplinaBox)}</Container>;
};

export default React.memo(GradeBoard, (prev, next) => {
  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return true;
  }
  return false;
});
