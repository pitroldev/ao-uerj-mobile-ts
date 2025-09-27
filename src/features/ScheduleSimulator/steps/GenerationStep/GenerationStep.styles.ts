import styled from 'styled-components/native';

export const Container = styled.View`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const ContentContainer = styled.View`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

export const Column = styled.View`
  display: flex;
  flex-direction: column;
`;

export const TabRow = styled.View`
  display: flex;
  flex-direction: row;

  justify-content: space-around;
  align-items: center;
`;

type TabProps = { active: boolean };

export const TabBtn = styled.TouchableOpacity<TabProps>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;

  padding: 8px 12px;
  border-bottom: 2px solid
    ${({ theme, active }) =>
      active ? theme.COLORS.PRIMARY : theme.COLORS.BACKGROUND_400};
`;

export const ButtonsRow = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: center;

  padding: 8px;
`;
