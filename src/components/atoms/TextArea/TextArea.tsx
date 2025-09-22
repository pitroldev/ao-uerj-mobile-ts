import React, { forwardRef } from 'react';
import { TextAreaProps, Container, TextArea } from './TextArea.styles';

export type Props = TextAreaProps & React.ComponentProps<typeof TextArea>;

const CustomTextArea = forwardRef((props: Props, ref: any) => {
  return (
    <Container showsVerticalScrollIndicator={false}>
      {!props.loading && <TextArea {...props} ref={ref} />}
    </Container>
  );
});

export default CustomTextArea;
