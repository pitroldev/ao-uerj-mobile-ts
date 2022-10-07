import React, {forwardRef} from 'react';
import {Picker} from '@react-native-picker/picker';

import {PickerContainer, StyleProps, StyledSpinner} from './Picker.styles';

type Props = StyleProps & React.ComponentProps<typeof Picker>;
const PickerComponent = forwardRef((props: Props, ref: any) => {
  return (
    <PickerContainer>
      {props.loading && <StyledSpinner size={25} />}
      <Picker {...props} ref={ref}>
        {props.children}
      </Picker>
    </PickerContainer>
  );
});

export default PickerComponent;
