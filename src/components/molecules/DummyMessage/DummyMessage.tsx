import React from 'react';
import {useTheme} from 'styled-components';
import Icon from 'react-native-vector-icons/AntDesign';

import Text from '@atoms/Text';
import {View} from './DummyMessage.styles';

type Props = {
  text: string;
  type: 'ERROR' | 'INFO' | 'EMPTY';
  onPress?: any;
};

const DummyMessage = ({text, type, onPress}: Props) => {
  const {COLORS} = useTheme();

  const icons = {
    ERROR: 'closecircleo',
    EMPTY: 'frowno',
    INFO: 'notification',
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
        size="LG"
        marginTop="12px"
        textAlign="center"
        alignSelf="center"
        weight="500"
        color="BACKGROUND_400">
        {text}
      </Text>
    </View>
  );
};

DummyMessage.defaultProps = {
  onPress: undefined,
};

export default DummyMessage;
