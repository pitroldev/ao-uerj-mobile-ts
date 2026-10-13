import React, { useState } from 'react';
import { Alert } from 'react-native';
import styled from 'styled-components/native';

import {
  BottomSheet,
  Button,
  NumberStepper,
  Text,
  snackbar,
} from '@components/ui';
import { SUBJECT_TYPE } from '@utils/constants/subjectDictionary';
import type {
  ElectiveCreditsConfig,
  ElectiveType,
} from '@hooks/useElectiveCreditsConfig';

const ELECTIVES: ElectiveType[] = ['RESTRICTED', 'DEFINED', 'UNIVERSAL'];
const MAX_CREDITS = 999;

type Draft = Record<ElectiveType, string>;

const toDraft = (config: ElectiveCreditsConfig): Draft => ({
  RESTRICTED: String(config.RESTRICTED),
  DEFINED: String(config.DEFINED),
  UNIVERSAL: String(config.UNIVERSAL),
});

const amount = (value: string) => Math.max(0, parseInt(value, 10) || 0);

const fromDraft = (draft: Draft): ElectiveCreditsConfig => ({
  RESTRICTED: amount(draft.RESTRICTED),
  DEFINED: amount(draft.DEFINED),
  UNIVERSAL: amount(draft.UNIVERSAL),
});

const ZERO: Draft = { RESTRICTED: '0', DEFINED: '0', UNIVERSAL: '0' };

const Description = styled(Text)`
  margin-bottom: 8px;
`;

/** ".cfg-row": rótulo à esquerda, contador à direita, fio embaixo. */
const Row = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0px;
  border-bottom-width: ${({ theme }) => theme.borders.hairline}px;
  border-bottom-color: ${({ theme }) => theme.colors.rule};
`;

const Label = styled(Text)`
  flex-shrink: 1;
`;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (config: ElectiveCreditsConfig) => Promise<boolean>;
  initialConfig: ElectiveCreditsConfig;
};

/**
 * Folha "Configurar créditos exigidos": total de créditos de cada tipo de
 * eletiva, com Resetar (pede confirmação) e Salvar.
 */
export function CreditsSheet({
  visible,
  onClose,
  onSave,
  initialConfig,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialConfig));
  const [saving, setSaving] = useState(false);

  // Abrir a folha (ou receber outra configuração com ela aberta) recomeça o
  // rascunho; o ajuste é feito no render.
  const [source, setSource] = useState({ visible, initialConfig });
  if (source.visible !== visible || source.initialConfig !== initialConfig) {
    setSource({ visible, initialConfig });
    if (visible) setDraft(toDraft(initialConfig));
  }

  // Sem `finally`: o React Compiler 1.0 não compila try/finally, e o catch
  // já trata qualquer falha.
  const saveConfig = async () => {
    try {
      setSaving(true);
      const success = await onSave(fromDraft(draft));
      if (success) {
        onClose();
        snackbar.success('Créditos salvos', 'O progresso foi recalculado.');
      } else {
        Alert.alert('Erro', 'Não foi possível salvar as configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração de créditos:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações');
    }
    setSaving(false);
  };

  const resetConfig = () => {
    Alert.alert(
      'Resetar Configurações',
      'Deseja resetar todas as configurações de créditos para 0?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar',
          style: 'destructive',
          onPress: () => setDraft(ZERO),
        },
      ],
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Configurar créditos exigidos"
      footer={[
        <Button
          key="reset"
          variant="outline"
          icon="restart_alt"
          label="Resetar"
          disabled={saving}
          onPress={resetConfig}
        />,
        <Button
          key="save"
          label="Salvar"
          loading={saving}
          loadingLabel="Salvando…"
          onPress={() => {
            void saveConfig();
          }}
        />,
      ]}
    >
      <Description tone="muted">
        Configure o total de créditos exigidos pelo currículo para cada tipo de
        eletiva
      </Description>
      {ELECTIVES.map(type => {
        const name = SUBJECT_TYPE[type];
        return (
          <Row key={type}>
            <Label
              variant="body"
              weight="medium"
              importantForAccessibility="no"
              accessibilityElementsHidden
            >
              {name}
            </Label>
            <NumberStepper
              value={draft[type]}
              onChangeText={value =>
                setDraft(previous => ({ ...previous, [type]: value }))
              }
              min={0}
              max={MAX_CREDITS}
              accessibilityLabel={`Créditos exigidos de ${name}`}
              decreaseLabel={`Diminuir ${name}`}
              increaseLabel={`Aumentar ${name}`}
            />
          </Row>
        );
      })}
    </BottomSheet>
  );
}
