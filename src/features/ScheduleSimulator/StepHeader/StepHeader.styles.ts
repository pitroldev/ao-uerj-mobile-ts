import styled from 'styled-components/native';

export const Container = styled.View`
  width: 100%;
  margin-bottom: 8px;
`;

export const Step = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 6px 8px;
`;

export const Circle = styled.View<{active: boolean; completed: boolean}>`
  width: 22px;
  height: 22px;
  display: flex;
  border-radius: 11px;
  align-items: center;
  justify-content: center;
  background-color: ${({theme, active, completed}) => {
    const t: any = theme as any;
    return active || completed ? t.COLORS.PRIMARY : t.COLORS.BACKGROUND_400;
  }};
`;

export const Line = styled.View<{completed: boolean}>`
  width: 18px;
  height: 2px;
  border-radius: 1px;
  background-color: ${({theme, completed}) => {
    const t: any = theme as any;
    return completed ? t.COLORS.PRIMARY : t.COLORS.BACKGROUND_400;
  }};
`;
