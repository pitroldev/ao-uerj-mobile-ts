import React from 'react';

import bootSplash from '@/assets/bootsplash/manifest.json';
import { AoLogo, LoadingBar } from '@components/ui';
import { Below, MainContainer, Message, Spacer } from './Loading.styles';

/**
 * Carregamento (restaurando a sessão): logo, aviso e barra indeterminada. É a
 * primeira tela depois do splash nativo: o logo tem a mesma largura e fica no
 * mesmo ponto (centro da janela), então o fade do splash não dá salto.
 */
export const LoadingPage = () => {
  return (
    <MainContainer>
      <Spacer />
      <AoLogo width={bootSplash.logo.width} />
      <Below>
        <Message
          tone="onBrandMuted"
          align="center"
          accessibilityLiveRegion="polite"
        >
          Aguarde um momento enquanto carregamos os dados...
        </Message>
        <LoadingBar tone="onBrand" width={120} testID="loading-bar" />
      </Below>
    </MainContainer>
  );
};
