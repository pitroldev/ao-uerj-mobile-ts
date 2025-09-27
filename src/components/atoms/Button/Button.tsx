import React, { forwardRef } from 'react';
import {
  ButtonProps,
  ButtonContainer,
  ButtonText,
  Spinner,
} from './Button.styles';

const TouchableButton = forwardRef((props: ButtonProps, ref: any) => {
  return (
    <ButtonContainer {...props} ref={ref}>
      {props.loading && <Spinner size={props.size as never} />}
      {!props.loading && (
        <ButtonText
          variant={props.variant}
          size={props.size}
          disabled={props.disabled}
          loading={props.loading}
        >
          {props.children}
        </ButtonText>
      )}
    </ButtonContainer>
  );
});

export default TouchableButton;
