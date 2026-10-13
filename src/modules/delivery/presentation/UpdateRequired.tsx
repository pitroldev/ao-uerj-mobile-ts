import React, { useState } from 'react';
import { BackHandler, Modal, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled from 'styled-components/native';

import { AoLogo, Button, Text } from '@components/ui';

type Props = {
  appVersion: string;
  /** Sem ação onde não há loja para abrir (iOS fora da App Store). */
  onUpdate?: () => Promise<void>;
};

const Root = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.brand};
`;

/** Mesma faixa azul com o logo do Login. */
const Top = styled.View<{ $inset: number }>`
  height: ${({ $inset }) => 220 + $inset}px;
  padding-top: ${({ $inset }) => $inset}px;
  align-items: center;
  justify-content: center;
`;

const Panel = styled.View<{ $inset: number }>`
  flex-grow: 1;
  gap: 8px;
  padding: 36px 24px ${({ $inset }) => 28 + $inset}px 24px;
  border-top-left-radius: ${({ theme }) => theme.layout.panelRadius}px;
  background-color: ${({ theme }) => theme.colors.background};
`;

const Message = styled(Text)`
  margin-bottom: 16px;
`;

/**
 * Bloqueio de versão sem suporte (abaixo de `minSupportedVersion` do aviso
 * remoto): cobre o app inteiro. O voltar do Android sai do app.
 */
export function UpdateRequired({ appVersion, onUpdate }: Props) {
  const insets = useSafeAreaInsets();
  const [updating, setUpdating] = useState(false);

  const update = () => {
    if (!onUpdate) return;
    setUpdating(true);
    // `.finally` da promessa: o React Compiler 1.0 não compila try/finally.
    void onUpdate().finally(() => setUpdating(false));
  };

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={() => BackHandler.exitApp()}
    >
      <Root accessibilityViewIsModal>
        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Top $inset={insets.top}>
            <AoLogo width={164} />
          </Top>
          <Panel $inset={insets.bottom}>
            <Text variant="titleL" accessibilityRole="header">
              Atualize o app
            </Text>
            <Message tone="muted">
              {`A versão ${appVersion} não funciona mais com o Aluno Online. Instale a versão mais recente para continuar.`}
            </Message>
            {onUpdate ? (
              <Button
                label="Atualizar"
                icon="download"
                block
                loading={updating}
                loadingLabel="Abrindo a loja…"
                onPress={update}
              />
            ) : null}
          </Panel>
        </ScrollView>
      </Root>
    </Modal>
  );
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1 } });
