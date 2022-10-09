import styled, {DefaultTheme} from 'styled-components/native';
import {TouchableOpacity} from 'react-native-gesture-handler';

type StyleProps = {
  color?: keyof DefaultTheme['COLORS'];
};

export const Container = styled(TouchableOpacity)<StyleProps>`
  display: flex;
  background-color: ${({theme, color}) => theme.COLORS[color ?? 'BACKGROUND']};
  margin: 5px;
  padding: 12px;
  border-radius: 12px;
  border-top-right-radius: 0;
  elevation: 4;
`;

type PositionProps = {
  margin?: 'top' | 'bottom';
};

export const InfoRow = styled.View<PositionProps>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

export const TopRow = styled(InfoRow)`
  margin-bottom: 8px;
`;

export const BottomRow = styled(InfoRow)`
  margin-top: 8px;
`;
