import React from 'react';
import { useTheme } from 'styled-components';
import { AntDesign as Icon } from '@react-native-vector-icons/ant-design';

import Text from '@atoms/Text';
import { View } from './DummyMessage.styles';

type Props = {
  text: string;
  type: 'ERROR' | 'INFO' | 'EMPTY' | 'BLOCK';
  onPress?: any;
};

const DummyMessage = ({ text, type, onPress }: Props) => {
  const { COLORS } = useTheme();

  const icons: Record<
    Props['type'],
    React.ComponentProps<typeof Icon>['name']
  > = {
    ERROR: 'close-circle',
    EMPTY: 'frown',
    INFO: 'notification',
    BLOCK: 'lock',
  };

  const isEnabled = typeof onPress === 'function';

  const handleOnPress = () => {
    if (isEnabled) {
      onPress();
    }
  };

  return (
    <View onPress={handleOnPress} disabled={!isEnabled}>
      <Icon name={icons[type]} color={COLORS.DISABLED} size={45} />
      <Text
        size="MD"
        marginTop="12px"
        textAlign="center"
        alignSelf="center"
        weight="500"
        color="BACKGROUND_400"
      >
        {text}
      </Text>
    </View>
  );
};

DummyMessage.defaultProps = {
  onPress: undefined,
};

export default DummyMessage;
