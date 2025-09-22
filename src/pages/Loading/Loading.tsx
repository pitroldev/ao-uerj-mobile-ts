import React from 'react';

import Text from '@atoms/Text';
import { MainContainer } from './Loading.styles';

import Spinner from '@root/components/atoms/Spinner';

const AboutPage = () => {
  return (
    <MainContainer>
      <Spinner size={64} />
      <Text
        weight="bold"
        size="LG"
        alignSelf="center"
        textAlign="center"
        marginTop="32px"
      >
        Aguarde um momento enquanto carregamos os dados...
      </Text>
    </MainContainer>
  );
};

export default AboutPage;
