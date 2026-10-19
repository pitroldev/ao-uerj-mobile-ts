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

/** Valor da Síntese: o número e a origem, no lugar do contador. */
const Fixed = styled.View`
  align-items: flex-end;
`;

const COPY = {
  manual:
    'Configure o total de créditos exigidos pelo currículo para cada tipo de eletiva',
  synthesis: 'Os créditos exigidos vêm da Síntese da Formação do Aluno Online.',
  partial:
    'Os grupos que a Síntese da Formação informa já vêm preenchidos. Configure os demais.',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (config: ElectiveCreditsConfig) => Promise<boolean>;
  initialConfig: ElectiveCreditsConfig;
  /** Grupos que vêm da Síntese da Formação: aparecem sem contador. */
  fromSynthesis?: Partial<ElectiveCreditsConfig>;
};

/**
 * Folha "Configurar créditos exigidos": total de créditos de cada tipo de
 * eletiva, com Resetar (pede confirmação) e Salvar. Os grupos que a Síntese da
 * Formação informa vêm preenchidos e não se editam.
 */
export function CreditsSheet({
  visible,
  onClose,
  onSave,
  initialConfig,
  fromSynthesis = {},
}: Props) {
  const editable = ELECTIVES.filter(type => fromSynthesis[type] === undefined);
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
          // o que vem da Síntese fica
          onPress: () =>
            setDraft(previous => ({
              ...previous,
              ...Object.fromEntries(editable.map(type => [type, '0'])),
            })),
        },
      ],
    );
  };

  let description = COPY.manual;
  if (!editable.length) description = COPY.synthesis;
  else if (editable.length < ELECTIVES.length) description = COPY.partial;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Configurar créditos exigidos"
      footer={
        editable.length
          ? [
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
            ]
          : [<Button key="done" label="Pronto" onPress={onClose} />]
      }
    >
      <Description tone="muted">{description}</Description>
      {ELECTIVES.map(type => {
        const name = SUBJECT_TYPE[type];
        const fixed = fromSynthesis[type];
        if (fixed !== undefined) {
          const value = fixed
            ? `${fixed} ${fixed === 1 ? 'crédito' : 'créditos'}`
            : 'Não exigida';
          return (
            <Row
              key={type}
              accessible
              accessibilityLabel={`Créditos exigidos de ${name}: ${value}, pela Síntese da Formação`}
            >
              <Label variant="body" weight="medium">
                {name}
              </Label>
              <Fixed>
                <Text variant="body" weight="semibold" tabular>
                  {value}
                </Text>
                <Text variant="caption" tone="muted">
                  Síntese da Formação
                </Text>
              </Fixed>
            </Row>
          );
        }
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
