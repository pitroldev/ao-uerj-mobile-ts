import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled from 'styled-components/native';

import { Button, Notice, Text, snackbar } from '@components/ui';
import { systemTexts } from './systemTexts';
import { useNotificationSettings } from './useNotificationSettings';

/** Mesmo recuo das ações dos avisos remotos (alvo de 48dp sem empurrar o aviso). */
const Actions = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin: -6px 0px -12px -8px;
`;

/**
 * Convite no Início, abaixo da próxima aula: uma vez só. "Ativar" pede a
 * permissão do sistema; recusada ou dispensada, o convite não volta (as
 * Notificações, no menu, continuam lá).
 */
export function ReminderPrompt({ style }: { style?: StyleProp<ViewStyle> }) {
  const { snapshot, settings } = useNotificationSettings();
  const { supported, ready, remoteDisabled, preferences } = snapshot;
  if (
    !supported ||
    !ready ||
    remoteDisabled ||
    preferences.promptAnswered ||
    preferences.classReminders
  )
    return null;

  const lead = preferences.reminderLead;
  const answer = (enable: boolean) => {
    settings
      .answerPrompt(enable)
      .then(result => {
        if (!enable) return;
        if (result === 'saved')
          snackbar.success(
            'Lembretes ligados',
            `Você recebe um aviso ${lead} minutos antes de cada aula. Ajuste em Notificações, no menu.`,
          );
        else
          snackbar.info('Lembretes não ligados', systemTexts().promptRefused);
      })
      .catch(() => snackbar.error('Não foi possível salvar a escolha.'));
  };

  return (
    <Notice tone="info" icon="notifications" style={style}>
      <Text variant="meta" weight="semibold" accessibilityRole="header">
        Lembrete antes da aula
      </Text>
      <Text variant="meta">
        {`Quer um aviso ${lead} minutos antes de cada aula, com o horário e a sala?`}
      </Text>
      <Actions>
        <Button
          variant="text"
          size="xs"
          label="Ativar lembretes"
          onPress={() => answer(true)}
        />
        <Button
          variant="text"
          size="xs"
          label="Agora não"
          accessibilityLabel="Agora não: dispensar o convite de lembretes"
          onPress={() => answer(false)}
        />
      </Actions>
    </Notice>
  );
}
