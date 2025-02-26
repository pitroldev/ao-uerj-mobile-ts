import styled from 'styled-components/native';

type Props = {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
};

const Spinner = styled.ActivityIndicator.attrs(props => ({
  color: props.theme.COLORS.PRIMARY,
}))<Props>``;

export default Spinner;
