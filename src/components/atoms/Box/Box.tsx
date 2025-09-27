import styled, { DefaultTheme } from 'styled-components/native';

type StyleProps = {
  color?: keyof DefaultTheme['COLORS'];
  size?: 'small' | 'large';
  fullWidth?: boolean;
};

const Box = styled.View<StyleProps>`
  justify-content: center;
  align-items: center;

  ${({ fullWidth }) => (fullWidth ? 'width: 100%;' : '')}

  padding: ${({ size }) => (size === 'small' ? '8px' : '12px')};
  border-radius: ${({ size }) => (size === 'small' ? '8px' : '12px')};
  border-top-right-radius: 0;
  background-color: ${({ color, theme }) =>
    color ? theme.COLORS[color] : theme.COLORS.BACKGROUND};
  elevation: 4;
`;

export default Box;
