import React from 'react';
import {TouchableOpacity} from 'react-native';
import styled, {DefaultTheme} from 'styled-components/native';

type StyleProps = {
  variant?: keyof DefaultTheme['COLORS'];
  size?: 'small' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  width?: number;
  height?: number;
};

export type ButtonProps = StyleProps &
  React.ComponentProps<typeof TouchableOpacity>;

export const ButtonContainer = styled(TouchableOpacity)<ButtonProps>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  background-color: ${({variant, theme}) => theme.COLORS[variant ?? 'PRIMARY']};

  border-radius: ${({size}) => (size === 'small' ? '5px' : '8px')};
  padding: ${({size}) => (size === 'small' ? '5px' : '8px')};
  ${({fullWidth, width, size}) => {
    if (fullWidth) {
      return 'width: 100%;';
      // return 'width: 100%;';
    }
    if (width) {
      return `width: ${width}px;`;
    }

    return `width: ${size === 'small' ? '150px' : '300px'};`;
  }}
  ${({height, size}) =>
    height
      ? `height: ${height}px;`
      : `height: ${size === 'small' ? '30px' : '50px'};`}

  ${({disabled, theme}) =>
    disabled &&
    `
    background-color: ${theme.COLORS.DISABLED};
    `}

    elevation: 4;
`;

export const ButtonText = styled.Text<StyleProps>`
  color: ${({theme}) => theme.COLORS.TEXT_SECONDARY};
  font-family: ${({theme}) => theme.FONTS.REGULAR};
  font-size: ${({size, theme}) =>
    size === 'small' ? theme.FONT_SIZE.XS : theme.FONT_SIZE.MD};
  font-weight: ${({variant}) => (variant === 'SECONDARY' ? 'normal' : 'bold')};
  text-align: center;
  ${({disabled, theme}) =>
    disabled &&
    `
    color: ${theme.COLORS.TEXT_PRIMARY};
    `}
`;

export const Spinner = styled.ActivityIndicator.attrs(props => ({
  color: props.theme.COLORS.TEXT_SECONDARY,
  size: props.size === 'small' ? 15 : 25,
}))<StyleProps>``;
