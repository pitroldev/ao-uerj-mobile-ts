import React, {forwardRef} from 'react';
import {TouchableOpacity} from 'react-native-gesture-handler';
import {DefaultTheme} from 'styled-components/native';

import Text from '@atoms/Text';

import {Container, TopRow, BottomRow} from './SubjectBox.styles';

type BoldOptions = {
  topLeft?: boolean;
  topRight?: boolean;
  bottomLeft?: boolean;
  bottomRight?: boolean;
  name?: boolean;
  description?: boolean;
};

type CustomProps = {
  topLeftInfo?: string;
  topRightInfo?: string;
  name: string;
  description?: string;
  bottomLeftInfo?: string;
  bottomRightInfo?: string;
  color?: keyof DefaultTheme['COLORS'];
  boldOptions?: BoldOptions;
};

type Props = CustomProps & React.ComponentProps<typeof TouchableOpacity>;

const SubjectBox = forwardRef((props: Props, ref: any) => {
  const {
    topLeftInfo,
    topRightInfo,
    name,
    description,
    bottomLeftInfo,
    bottomRightInfo,
    color,
    boldOptions,
  } = props;

  const showDescription = Boolean(description);
  const showTopLeft = Boolean(topLeftInfo);
  const showTopRight = Boolean(topRightInfo);
  const showBottomLeft = Boolean(bottomLeftInfo);
  const showBottomRight = Boolean(bottomRightInfo);
  const showTop = showTopLeft || showTopRight;
  const showBottom = showBottomLeft || showBottomRight;

  return (
    <Container color={color} ref={ref} {...props}>
      {showTop && (
        <TopRow>
          {showTopLeft && (
            <Text
              weight={boldOptions?.topLeft ? 'bold' : 'normal'}
              marginRight="auto"
              size="XS">
              {topLeftInfo}
            </Text>
          )}
          {showTopRight && (
            <Text
              weight={boldOptions?.topRight ? 'bold' : 'normal'}
              marginLeft="auto"
              size="XS">
              {topRightInfo}
            </Text>
          )}
        </TopRow>
      )}
      <Text weight={boldOptions?.name ? 'bold' : 'normal'} size="MD">
        {name}
      </Text>
      {showDescription && (
        <Text weight={boldOptions?.description ? 'bold' : 'normal'} size="SM">
          {description}
        </Text>
      )}
      {showBottom && (
        <BottomRow>
          {showBottomLeft && (
            <Text
              weight={boldOptions?.bottomLeft ? 'bold' : 'normal'}
              marginRight="auto"
              size="XS">
              {bottomLeftInfo}
            </Text>
          )}
          {showBottomRight && (
            <Text
              weight={boldOptions?.bottomRight ? 'bold' : 'normal'}
              marginLeft="auto"
              size="XS">
              {bottomRightInfo}
            </Text>
          )}
        </BottomRow>
      )}
    </Container>
  );
});

export default SubjectBox;
