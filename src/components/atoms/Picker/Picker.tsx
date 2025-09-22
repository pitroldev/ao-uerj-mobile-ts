import React, { forwardRef } from 'react';
import { useTheme } from 'styled-components';
import { Picker } from '@react-native-picker/picker';

import { PickerContainer, StyleProps, StyledSpinner } from './Picker.styles';

type PickerProps = StyleProps & React.ComponentProps<typeof Picker>;
const PickerComponent = forwardRef((props: PickerProps, ref: any) => {
  const { COLORS } = useTheme();
  const style = {
    backgroundColor: COLORS.BACKGROUND,
    color: COLORS.TEXT_PRIMARY,
  };
  return (
    <PickerContainer>
      {props.loading && <StyledSpinner size={25} />}
      <Picker
        {...props}
        ref={ref}
        mode="dialog"
        dropdownIconColor={COLORS.TEXT_PRIMARY}
        itemStyle={style}
      >
        {props.children}
      </Picker>
    </PickerContainer>
  );
});

export default PickerComponent;
