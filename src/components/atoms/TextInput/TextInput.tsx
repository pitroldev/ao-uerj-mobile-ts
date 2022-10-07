import React, {forwardRef} from 'react';
import {InputContainer, Input, IconContainer} from './TextInput.styles';

type Ref = React.Ref<typeof Input>;
type Props = React.ComponentProps<typeof Input> & {
  icon?: React.ReactNode;
};
const TextInput = forwardRef((props: Props, ref: Ref) => {
  return (
    <InputContainer>
      {props.icon && <IconContainer>{props.icon}</IconContainer>}
      <Input {...props} ref={ref} />
    </InputContainer>
  );
});

export default TextInput;
