import styled from 'styled-components/native';

export const View = styled.TouchableOpacity<any>`
  display: flex;
  flex-direction: row;

  align-items: center;
  align-self: center;
  justify-content: flex-start;

  margin: 8px;
  padding: ${props => (props.withPadding ? '0 16px' : '0')};
  width: 100%;
`;
