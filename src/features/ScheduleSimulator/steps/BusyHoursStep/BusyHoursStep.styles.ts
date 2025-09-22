import styled, { DefaultTheme } from 'styled-components/native';
import { TouchableOpacity } from 'react-native';

export const Container = styled.View`
  display: flex;
  flex: 1;
`;

export const ContentContainer = styled.View`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const ButtonsRow = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  padding-bottom: 8px;
`;

export const Row = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

type ScheduleItemProps = {
  color: keyof DefaultTheme['COLORS'];
};

export const Header = styled(Row)`
  justify-content: space-around;
`;

export const ScheduleItem = styled(TouchableOpacity)<ScheduleItemProps>`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;

  background-color: ${({ theme, color }) => theme.COLORS[color]};

  border-radius: 8px;
  padding: 4px;
  margin: 4px;

  elevation: 2;
  border: 1px solid ${({ theme }) => theme.COLORS.BACKGROUND_400};
`;

export const ScrollContainer = styled.ScrollView`
  display: flex;
  width: 100%;

  margin-bottom: 8px;
`;

export const Square = styled.View<ScheduleItemProps>`
  background-color: ${({ theme, color }) => theme.COLORS[color]};
  width: 20px;
  height: 20px;

  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.COLORS.BACKGROUND_400};

  margin-right: 8px;
`;
