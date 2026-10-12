import React from 'react';

import { AoLogo, LoadingBar } from '@components/ui';
import { MainContainer, Message } from './Loading.styles';

/** Carregamento (restaurando a sessão): logo, aviso e barra indeterminada. */
const LoadingPage = () => {
  return (
    <MainContainer>
      <AoLogo width={150} />
      <Message
        tone="onBrandMuted"
        align="center"
        accessibilityLiveRegion="polite"
      >
        Aguarde um momento enquanto carregamos os dados...
      </Message>
      <LoadingBar tone="onBrand" width={120} />
    </MainContainer>
  );
};

export default LoadingPage;
