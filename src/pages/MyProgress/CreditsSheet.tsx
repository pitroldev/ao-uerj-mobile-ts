import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import styled from 'styled-components/native';

import { BottomSheet, Button, NumberStepper, Text } from '@components/ui';
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
export default function CreditsSheet({
  visible,
  onClose,
  onSave,
  initialConfig,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialConfig));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(toDraft(initialConfig));
    }
  }, [visible, initialConfig]);

  const saveConfig = async () => {
    try {
      setSaving(true);
      const success = await onSave(fromDraft(draft));
      if (success) {
        onClose();
        Toast.show({
          type: 'success',
          text1: 'Créditos salvos',
          text2: 'O progresso foi recalculado.',
        });
      } else {
        Alert.alert('Erro', 'Não foi possível salvar as configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração de créditos:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações');
    } finally {
      setSaving(false);
    }
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
          onPress={saveConfig}
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
