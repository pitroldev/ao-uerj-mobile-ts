import React from 'react';
import styled from 'styled-components/native';

import {
  ChipGroup,
  EmptyState,
  FilterChip,
  FootNote,
  List,
  ListRow,
  Notice,
  Section,
  SegmentedControl,
  Switch,
  Text,
  TimeField,
  snackbar,
} from '@components/ui';
import { REMINDER_KEYS } from '@root/modules/evaluations/domain/evaluations';
import { REMINDER_LABEL } from '@root/modules/evaluations/presentation/evaluationText';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useNow } from '@features/AttendedClassesSchedule/useNow';
import { CHECK_INTERVAL_HOURS } from '@root/modules/notifications/domain/checkState';
import {
  REMINDER_LEADS,
  hasAnyNotification,
  usesPortalChecks,
  type EvaluationDefaults,
  type NotificationPreferences,
  type ReminderLead,
} from '@root/modules/notifications/domain/preferences';
import type { UpdateResult } from '@root/modules/notifications/application/NotificationSettings';
import { checkStatusText } from '@root/modules/notifications/presentation/checkStatus';
import { systemTexts } from '@root/modules/notifications/presentation/systemTexts';
import { useNotificationSettings } from '@root/modules/notifications/presentation/useNotificationSettings';

type Toggle = Exclude<
  keyof NotificationPreferences,
  'reminderLead' | 'promptAnswered' | 'evaluationDefaults'
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

const Times = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md}px;
  margin-top: ${({ theme }) => theme.spacing.lg}px;
`;

const Half = styled.View`
  flex: 1;
`;

/**
 * Notificações: lembrete antes da aula (grade salva, sem portal), lembretes
 * das avaliações anotadas (com os padrões das novas) e avisos do Aluno
 * Online (nota, RID e documento), cada um ligado pelo aluno. Os avisos do
 * Aluno Online dependem da verificação em segundo plano, que só o Android
 * tem; no iPhone a tela mostra os lembretes.
 */
export function NotificationsPage() {
  const { snapshot, settings } = useNotificationSettings();
  const { preferences, permission, exactAlarms, check, ready } = snapshot;
  // a tela continua montada no menu: "hoje" e a pausa acompanham o relógio
  const now = useNow().getTime();
  const texts = systemTexts();

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
      snackbar.info('Aviso não ligado', texts.deniedHint);
    if (result === 'blocked')
      snackbar.info(texts.blockedTitle, texts.blockedHint);
  };

  const save = (change: Parameters<typeof settings.update>[0]) => {
    settings
      .update(change)
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

  const defaults = preferences.evaluationDefaults;
  /**
   * Parte dos padrões já salvos, não dos desta tela: dois toques seguidos
   * (ou um horário e um toque) não se desfazem.
   */
  const saveDefaults = (
    change: (current: EvaluationDefaults) => Partial<EvaluationDefaults>,
  ) => {
    if (!ready) return;
    save(current => ({
      evaluationDefaults: {
        ...current.evaluationDefaults,
        ...change(current.evaluationDefaults),
      },
    }));
  };
  // a chave das avaliações começa ligada: sem a permissão, nada chega e
  // nenhum outro aviso abriu o pedido no topo
  const evaluationsNeedPermission =
    preferences.evaluationReminders && permission === 'denied' && !blocked;

  const exactAlarmNotice = (
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
  );

  return (
    <ScreenPanel>
      {blocked ? (
        <NoticeSlot>
          <Notice
            tone="warn"
            icon="notifications"
            text={
              permission === 'blocked'
                ? texts.blockedNotice
                : texts.deniedNotice
            }
            action={{
              label: permission === 'blocked' ? texts.openSettings : 'Permitir',
              accessibilityLabel:
                permission === 'blocked'
                  ? texts.openSettingsLabel
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
            {exactAlarms === false ? <Spaced>{exactAlarmNotice}</Spaced> : null}
          </>
        ) : null}
      </Section>

      <Section title="Avaliações">
        <List>
          {row(
            'evaluationReminders',
            'Lembretes de avaliações',
            'Nas provas e trabalhos que você anota no Início, com os lembretes escolhidos em cada um.',
          )}
        </List>
        {evaluationsNeedPermission ? (
          <Spaced>
            <Notice
              tone="warn"
              icon="notifications"
              text="Sem a sua permissão, os lembretes das avaliações não chegam."
              action={{
                label: 'Permitir',
                accessibilityLabel: 'Permitir avisos',
                onPress: allowNotifications,
              }}
            />
          </Spaced>
        ) : null}
        {preferences.evaluationReminders ? (
          <>
            <LeadLabel variant="meta" tone="muted">
              Padrão das novas avaliações
            </LeadLabel>
            <ChipGroup accessibilityLabel="Lembretes padrão das novas avaliações">
              {REMINDER_KEYS.map(key => {
                const on = defaults.reminders.includes(key);
                return (
                  <FilterChip
                    key={key}
                    label={REMINDER_LABEL[key]}
                    selected={on}
                    disabled={!ready}
                    onPress={() =>
                      saveDefaults(current => ({
                        reminders: REMINDER_KEYS.filter(item =>
                          item === key
                            ? !current.reminders.includes(key)
                            : current.reminders.includes(item),
                        ),
                      }))
                    }
                  />
                );
              })}
            </ChipGroup>
            <Times>
              <Half>
                <TimeField
                  label="Dias antes, às"
                  accessibilityLabel="Horário padrão dos lembretes de dias antes"
                  value={defaults.earlyTime}
                  onChange={earlyTime => saveDefaults(() => ({ earlyTime }))}
                />
              </Half>
              <Half>
                <TimeField
                  label="No dia, às"
                  accessibilityLabel="Horário padrão do lembrete no dia"
                  value={defaults.dayTime}
                  onChange={dayTime => saveDefaults(() => ({ dayTime }))}
                />
              </Half>
            </Times>
            <Status variant="meta" tone="muted">
              Vale para as próximas que você anotar; as já anotadas mantêm os
              lembretes delas.
            </Status>
            {exactAlarms === false && !preferences.classReminders ? (
              <Spaced>{exactAlarmNotice}</Spaced>
            ) : null}
          </>
        ) : null}
      </Section>

      {snapshot.backgroundChecks ? (
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
      ) : null}

      <Foot>
        <FootNote
          icon="lock"
          text="Os avisos são montados no próprio aparelho. Suas notas e sua senha não vão para nenhum servidor além do Aluno Online."
        />
      </Foot>
    </ScreenPanel>
  );
}
