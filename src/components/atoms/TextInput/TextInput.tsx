import React, { forwardRef } from 'react';
import { InputContainer, Input, IconContainer } from './TextInput.styles';
import type { TextInput as RNTextInput } from 'react-native';

type Props = React.ComponentProps<typeof Input> & {
  icon?: React.ReactNode;
};
const TextInput = forwardRef<RNTextInput, Props>(({ icon, ...rest }, ref) => {
  return (
    <InputContainer>
      {icon && <IconContainer>{icon}</IconContainer>}
      <Input {...rest} ref={ref} />
    </InputContainer>
  );
});

export default TextInput;
