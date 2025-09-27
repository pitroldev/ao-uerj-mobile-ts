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
  align-items: center;

  margin-top: 12px;
`;

export const Column = styled.View`
  display: flex;
  flex-direction: column;
`;

export const ScrollView = styled.ScrollView`
  height: 80%;
`;

export const Switch = styled.Switch.attrs(({ theme }) => ({
  trackColor: {
    false: theme.COLORS.DISABLED,
    true: theme.COLORS.PRIMARY,
  },
  thumbColor: theme.COLORS.BACKGROUND_500,
}))`
  display: flex;
  flex: 1;
`;

export const ChipsContainer = styled.View`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`;

export const ChipItem = styled.View`
  margin-right: 8px;
  margin-bottom: 8px;
`;
