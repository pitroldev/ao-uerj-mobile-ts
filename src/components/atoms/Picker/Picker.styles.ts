import styled from 'styled-components/native';
import Spinner from '@atoms/Spinner';

export type StyleProps = {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'large';
  loading?: boolean;
};

export type Props = StyleProps;
export const PickerContainer = styled.View<Props>`
  position: relative;
  display: flex;
  justify-content: center;
  margin: 5px;
  background-color: ${({ theme }) => theme.COLORS.BACKGROUND};
  border: 1px solid ${({ theme }) => theme.COLORS.BACKGROUND_400};
  height: ${({ size }) => (size === 'small' ? '30px' : '50px')};
  border-radius: ${({ size }) => (size === 'small' ? '5px' : '8px')};
  border-top-right-radius: 0;
`;

export const StyledSpinner = styled(Spinner)`
  position: absolute;
  right: 10%;
  top: 25%;
`;
