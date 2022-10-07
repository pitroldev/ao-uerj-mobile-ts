import React from 'react';

import {ScrollContainer} from './ScrollView.styles';

type ExtraProps = {
  children?: React.ReactNode;
};

type Props = React.ComponentProps<typeof ScrollContainer> & ExtraProps;

const ScrollView = React.forwardRef((props: Props, ref: any) => {
  return (
    <ScrollContainer {...props} ref={ref}>
      {props.children}
    </ScrollContainer>
  );
});

export default ScrollView;
