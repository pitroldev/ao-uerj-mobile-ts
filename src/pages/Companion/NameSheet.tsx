import React, { useState } from 'react';
import styled from 'styled-components/native';

import { BottomSheet, Button, Text, TextField, snackbar } from '@components/ui';
import {
  isValidName,
  NAME_MAX,
} from '@root/modules/companion/domain/companion';

const Lede = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
`;

type Props = {
  visible: boolean;
  name: string;
  /** O primeiro nome da conta, para voltar a ele. */
  fallback: string;
  onClose: () => void;
  onSave: (name: string) => Promise<boolean>;
  /** O motivo da abertura: o nome da conta não serve (sem letras). */
  required?: boolean;
};

/**
 * Como o aluno aparece nas chamadas: o primeiro nome da conta ou outro (o
 * nome social, um apelido), uma palavra só. Fica só no aparelho.
 */
export function NameSheet({
  visible,
  name,
  fallback,
  onClose,
  onSave,
  required = false,
}: Props) {
  const [draft, setDraft] = useState(name);
  const [tried, setTried] = useState(false);
  const valid = isValidName(draft);

  async function save(value: string) {
    if (!isValidName(value)) {
      setTried(true);
      return;
    }
    if (await onSave(value)) onClose();
    else snackbar.error('Não foi possível salvar o nome. Tente novamente.');
  }

  const footer = [
    fallback && fallback !== draft.trim() ? (
      <Button
        key="account"
        variant="outline"
        label={`Usar ${fallback}`}
        onPress={() => {
          void save(fallback);
        }}
      />
    ) : (
      <Button
        key="cancel"
        variant="outline"
        label="Cancelar"
        onPress={onClose}
      />
    ),
    <Button
      key="save"
      label="Salvar"
      onPress={() => {
        void save(draft);
      }}
    />,
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Como você aparece"
      footer={footer}
    >
      <Lede tone="muted">
        {required
          ? 'Escolha um primeiro nome para entrar nas mesas e nos grupos. '
          : ''}
        Quem está junto vê só este nome: sem foto, curso ou matrícula. Use o
        nome que preferir, uma palavra só.
      </Lede>
      <TextField
        label="Primeiro nome"
        value={draft}
        onChangeText={setDraft}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="done"
        onSubmitEditing={() => {
          void save(draft);
        }}
        error={
          tried && !valid
            ? 'Use só letras, numa palavra (sem número, espaço ou @).'
            : undefined
        }
      />
    </BottomSheet>
  );
}
