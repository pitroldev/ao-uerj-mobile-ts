import {StyleSheet} from 'react-native';
import styled from 'styled-components/native';
import Hyperlink from 'react-native-hyperlink';

export const styles = StyleSheet.create({
  url: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
});

export const Row = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  width: 100%;

  margin-bottom: 4px;
`;

export const ChatText = styled(Hyperlink).attrs({
  linkStyle: styles.url,
})`
  width: 100%;
`;

export const TouchableButton = styled.TouchableOpacity`
  margin: 5px;
`;
