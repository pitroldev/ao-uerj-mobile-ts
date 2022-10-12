import React, {forwardRef} from 'react';
import {ButtonProps, ButtonContainer, Spinner} from './RoundedButton.styles';

const RoundedButton = forwardRef((props: ButtonProps, ref: any) => {
  return (
    <ButtonContainer {...props} ref={ref}>
      {props.loading && <Spinner size={props.size as never} />}
      {props.children}
    </ButtonContainer>
  );
});

export default RoundedButton;
