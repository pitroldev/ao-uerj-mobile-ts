import React from 'react';
import {ScrollView, TouchableOpacity} from 'react-native';
import Text from '@atoms/Text';
import {Container, Step, Circle, Line} from './StepHeader.styles';

type Props = {
  labels: string[];
  current: number;
  onStepPress?: (index: number) => void;
};

const StepHeader = ({labels, current, onStepPress}: Props) => {
  return (
    <Container>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{alignItems: 'center'}}>
        {labels.map((label, index) => {
          const isActive = index === current;
          const isCompleted = index < current;
          const canPress = !!onStepPress && index <= current;
          return (
            <React.Fragment key={`${index}-${label}`}>
              {index > 0 && <Line completed={isCompleted} />}
              <TouchableOpacity
                activeOpacity={canPress ? 0.7 : 1}
                onPress={() => canPress && onStepPress(index)}>
                <Step>
                  <Circle active={isActive} completed={isCompleted}>
                    <Text
                      weight="bold"
                      size="XS"
                      alignSelf="center"
                      textAlign="center"
                      color={
                        isActive || isCompleted
                          ? 'BACKGROUND'
                          : 'BACKGROUND_700'
                      }>
                      {index + 1}
                    </Text>
                  </Circle>
                </Step>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </Container>
  );
};

export default StepHeader;
