import React from 'react';
import {TouchableOpacity} from 'react-native-gesture-handler';
import styled, {DefaultTheme} from 'styled-components/native';

type StyleProps = {
  variant?: keyof DefaultTheme['COLORS'];
  size?: 'small' | 'large';
  disabled?: boolean;
  loading?: boolean;
};

export type ButtonProps = StyleProps &
  React.ComponentProps<typeof TouchableOpacity>;
export const ButtonContainer = styled(TouchableOpacity)<ButtonProps>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  background-color: ${({variant, theme}) => theme.COLORS[variant ?? 'PRIMARY']};

  margin: 5px;
  border-radius: ${({size}) => (size === 'small' ? '15px' : '25px')};
  padding: ${({size}) => (size === 'small' ? '5px' : '8px')};
  width: ${({size}) => (size === 'small' ? '30px' : '50px')};
  height: ${({size}) => (size === 'small' ? '30px' : '50px')};

  ${({disabled, theme}) =>
    disabled &&
    `
    background-color: ${theme.COLORS.DISABLED};
    `}

  elevation: 4;
`;

export const Spinner = styled.ActivityIndicator.attrs(props => ({
  color: props.theme.COLORS.TEXT_SECONDARY,
  size: props.size === 'small' ? 15 : 25,
}))<StyleProps>``;
