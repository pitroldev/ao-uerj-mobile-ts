import React from 'react';
import { useTheme } from 'styled-components';
import Icon from 'react-native-vector-icons/AntDesign';

import Text from '@atoms/Text';
import { View } from './SmallDummyMessage.styles';

type Props = {
  text: string;
  type: 'ERROR' | 'INFO' | 'EMPTY' | 'BLOCK';
  onPress?: any;
  withPadding?: boolean;
};

const SmallDummyMessage = ({ text, type, onPress, withPadding }: Props) => {
  const { COLORS } = useTheme();

  const icons = {
    ERROR: 'closecircleo',
    EMPTY: 'frowno',
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
    <View
      onPress={handleOnPress}
      disabled={!isEnabled}
      withPadding={withPadding}
    >
      <Icon name={icons[type]} color={COLORS.DISABLED} size={25} />
      <Text
        size="SM"
        weight="500"
        color="BACKGROUND_400"
        marginLeft="4px"
        marginTop="auto"
        marginBottom="auto"
      >
        {text}
      </Text>
    </View>
  );
};

SmallDummyMessage.defaultProps = {
  onPress: undefined,
  withPadding: true,
};

export default SmallDummyMessage;
