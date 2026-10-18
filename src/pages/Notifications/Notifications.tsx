import React from 'react';
import styled from 'styled-components/native';

import {
  EmptyState,
  FootNote,
  List,
  ListRow,
  Notice,
  Section,
  SegmentedControl,
  Switch,
  Text,
  snackbar,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useNow } from '@features/AttendedClassesSchedule/useNow';
import { CHECK_INTERVAL_HOURS } from '@root/modules/notifications/domain/checkState';
import {
  REMINDER_LEADS,
  hasAnyNotification,
  usesPortalChecks,
  type NotificationPreferences,
  type ReminderLead,
} from '@root/modules/notifications/domain/preferences';
import type { UpdateResult } from '@root/modules/notifications/application/NotificationSettings';
import { checkStatusText } from '@root/modules/notifications/presentation/checkStatus';
import { useNotificationSettings } from '@root/modules/notifications/presentation/useNotificationSettings';

type Toggle = Exclude<
  keyof NotificationPreferences,
  'reminderLead' | 'promptAnswered'
>;

const LEAD_OPTIONS = REMINDER_LEADS.map(lead => ({
  value: String(lead) as `${ReminderLead}`,
  label: `${lead} min`,
  accessibilityLabel: `${lead} minutos antes`,
}));

const NoticeSlot = styled.View`
  margin-bottom: ${({ theme }) => theme.layout.gutter}px;
`;

const LeadLabel = styled(Text)`
  margin: ${({ theme }) => theme.spacing.lg}px 0px
    ${({ theme }) => theme.spacing.sm}px;
`;

const Spaced = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

const Status = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

const Foot = styled.View`
  margin-top: ${({ theme }) => theme.layout.sectionGap}px;
`;

/**
 * Notificações: lembrete antes da aula (grade salva, sem portal) e avisos do
 * Aluno Online (nota, RID e documento), cada um ligado pelo aluno.
 */
export function NotificationsPage() {
  const { snapshot, settings } = useNotificationSettings();
  const { preferences, permission, exactAlarms, check, ready } = snapshot;
  // a tela continua montada no menu: "hoje" e a pausa acompanham o relógio
  const now = useNow().getTime();

  if (!snapshot.supported) {
    return (
      <ScreenPanel>
        <EmptyState
          icon="notifications"
          text="Os avisos do AO UERJ ainda não estão disponíveis neste aparelho."
        />
      </ScreenPanel>
    );
  }

  const explain = (result: UpdateResult) => {
    if (result === 'denied')
      snackbar.info(
        'Aviso não ligado',
        'O Android precisa da sua permissão para mostrar avisos.',
      );
    if (result === 'blocked')
      snackbar.info(
        'Avisos bloqueados no Android',
        'Toque em “Abrir configurações”, no topo da tela, para liberar.',
      );
  };

  const save = (patch: Partial<NotificationPreferences>) => {
    settings
      .update(patch)
      .then(explain)
      .catch(() => snackbar.error('Não foi possível salvar a escolha.'));
  };

  const openSettings = () => {
    void settings.openSettings();
  };

  const openExactAlarmSettings = () => {
    void settings.openExactAlarmSettings();
  };

  const allowNotifications = () => {
    void settings.requestPermission().then(result => {
      if (result === 'blocked') void settings.openSettings();
    });
  };

  const row = (key: Toggle, title: string, meta: string) => {
    const on = preferences[key];
    return (
      <ListRow
        key={key}
        title={title}
        titleWeight="regular"
        meta={meta}
        trailing={<Switch value={on} />}
        accessibilityRole="switch"
        accessibilityState={{ checked: on, disabled: !ready }}
        onPress={ready ? () => save({ [key]: !on }) : undefined}
      />
    );
  };

  const blocked =
    permission === 'blocked' ||
    (permission === 'denied' && hasAnyNotification(preferences));

  return (
    <ScreenPanel>
      {blocked ? (
        <NoticeSlot>
          <Notice
            tone="warn"
            icon="notifications"
            text={
              permission === 'blocked'
                ? 'O Android está bloqueando os avisos do AO UERJ.'
                : 'Os avisos precisam da sua permissão no Android.'
            }
            action={{
              label:
                permission === 'blocked' ? 'Abrir configurações' : 'Permitir',
              accessibilityLabel:
                permission === 'blocked'
                  ? 'Abrir as configurações de avisos do Android'
                  : 'Permitir avisos',
              onPress:
                permission === 'blocked' ? openSettings : allowNotifications,
            }}
          />
        </NoticeSlot>
      ) : null}

      <Section title="Aulas" first>
        <List>
          {row(
            'classReminders',
            'Lembrete antes da aula',
            'Segue a grade salva no aparelho, sem consultar o portal. Avisa também em feriados.',
          )}
        </List>
        {preferences.classReminders ? (
          <>
            <LeadLabel variant="meta" tone="muted">
              Avisar antes do início
            </LeadLabel>
            <SegmentedControl
              options={LEAD_OPTIONS}
              value={`${preferences.reminderLead}`}
              onChange={value =>
                save({ reminderLead: Number(value) as ReminderLead })
              }
              accessibilityLabel="Antecedência do lembrete"
            />
            {exactAlarms === false ? (
              <Spaced>
                <Notice
                  tone="info"
                  icon="schedule"
                  text="Para o lembrete chegar na hora, mesmo com o celular parado, permita “Alarmes e lembretes” para o AO UERJ."
                  action={{
                    label: 'Permitir',
                    accessibilityLabel: 'Permitir alarmes e lembretes',
                    onPress: openExactAlarmSettings,
                  }}
                />
              </Spaced>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section
        title="Aluno Online"
        description={`O app consulta o portal a cada ${CHECK_INTERVAL_HOURS} horas, das 7h às 22h, com a conta salva neste aparelho.`}
      >
        <List>
          {row(
            'grades',
            'Notas novas',
            'Quando sair ou mudar uma nota do período.',
          )}
          {preferences.grades
            ? row(
                'gradeValues',
                'Mostrar a nota no aviso',
                'Desligado, o aviso diz só a disciplina e a avaliação.',
              )
            : null}
          {row(
            'rid',
            'RID',
            'Posição no RID Parcial e resultado da inscrição.',
          )}
          {row(
            'documents',
            'Documentos perto de vencer',
            'Até 3 dias antes do vencimento de um documento emitido.',
          )}
        </List>
        {usesPortalChecks(preferences) ? (
          <Status variant="meta" tone="muted">
            {checkStatusText(check, now)}
          </Status>
        ) : null}
      </Section>

      <Foot>
        <FootNote
          icon="lock"
          text="Os avisos são montados no próprio aparelho. Suas notas e sua senha não vão para nenhum servidor além do Aluno Online."
        />
      </Foot>
    </ScreenPanel>
  );
}
