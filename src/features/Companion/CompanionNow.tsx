import React from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import styled from 'styled-components/native';

import { Button, IconTile, List, ListRow, Section, Text } from '@components/ui';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  isCurrent,
  type CallKind,
  type CompanionCall,
} from '@root/modules/companion/domain/companion';
import {
  freeWindow,
  type FreeWindow,
} from '@root/modules/companion/domain/window';
import {
  callTitle,
  DESTINATION_TEXT,
  goingText,
  KIND_TEXT,
  relativeText,
  SPOT_TEXT,
} from '@root/modules/companion/presentation/companionText';
import {
  useCompanionCalls,
  useMemberships,
} from '@root/modules/companion/presentation/useCompanion';
import { isFeatureDisabled } from '@root/modules/delivery/domain/appStatus';
import { useRemoteStatus } from '@root/modules/delivery/presentation/DeliveryProvider';

const Summary = styled(Text)`
  margin-top: -${({ theme }) => theme.spacing.xs}px;
  margin-bottom: ${({ theme }) => theme.spacing.xs}px;
`;

/** No Início, a lista anda devagar: um minuto. */
const HOME_POLL_MS = 60_000;
/** Até quanto depois da última aula a volta aparece no Início. */
const AFTER_LAST_CLASS_MIN = 40;

const pad = (value: number) => String(value).padStart(2, '0');
const minuteText = (minute: number) =>
  `${Math.floor(minute / 60)}:${pad(minute % 60)}`;

/**
 * Quando a Companhia agora tem algo a dizer no Início: a janela livre do
 * almoço (das 10:30 às 14:30, com tempo antes da próxima aula) ou logo
 * depois da última aula do dia, à noite. Em aula, nada.
 */
function momentOf(window: FreeWindow, now: Date): CallKind | null {
  const minute = now.getHours() * 60 + now.getMinutes();
  const lunch = minute >= 10 * 60 + 30 && minute <= 14 * 60 + 30;
  if (window.kind === 'free' && lunch && window.next.start - minute >= 50)
    return 'lunch';
  if (window.kind === 'done') {
    if (
      window.last.end >= 17 * 60 &&
      minute - window.last.end <= AFTER_LAST_CLASS_MIN
    )
      return 'home';
    if (lunch) return 'lunch';
  }
  return null;
}

type Props = { schedule: readonly AttendedClassesSchedule[]; now: Date };

/**
 * "Companhia agora" no Início, logo abaixo da próxima aula: a chamada em que
 * o aluno está ou, na hora certa, as mesas abertas na janela livre e quem
 * está saindo depois da última aula. Sem nada a dizer, não aparece.
 */
export function CompanionNow(props: Props) {
  const { companion } = useAppServices();
  const { status } = useRemoteStatus();
  // sem tokens anônimos (iPhone, app fora da loja) ou desligada pelo aviso remoto
  if (!companion.supported || isFeatureDisabled(status, 'companion'))
    return null;
  return <CompanionSlot {...props} />;
}

function CompanionSlot({ schedule, now }: Props) {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const memberships = useMemberships();
  const nowMs = now.getTime();
  const window = freeWindow(schedule, now);
  const current = memberships
    .filter(item => isCurrent(item, nowMs))
    .sort((a, b) => a.at - b.at)[0];
  const moment = current ? null : momentOf(window, now);
  const query = useCompanionCalls({
    enabled: moment !== null,
    poll: focused,
    interval: HOME_POLL_MS,
  });

  const open = (callId?: string) =>
    navigation.navigate('Companhia agora', callId ? { callId } : undefined);

  if (current) {
    const spot = SPOT_TEXT[current.spot];
    const icon = current.destination
      ? DESTINATION_TEXT[current.destination].icon
      : KIND_TEXT[current.kind].icon;
    return (
      <Section title="Companhia agora">
        <List>
          <ListRow
            leading={<IconTile icon={icon} tone="accent" />}
            title={callTitle(current)}
            subtitle={`${spot.short} · ${relativeText(current.at, nowMs)}`}
            meta={current.host ? 'Sua chamada' : KIND_TEXT[current.kind].joined}
            highlighted
            chevron
            onPress={() => open(current.callId)}
          />
        </List>
      </Section>
    );
  }

  if (!moment) return null;
  const calls = (query.data ?? []).filter(
    (call: CompanionCall) =>
      call.kind === moment && call.at > nowMs - 5 * 60_000,
  );
  if (!calls.length) return null;
  // a mais próxima primeiro, como na lista
  const top = [...calls].sort((a, b) => a.at - b.at).slice(0, 2);
  const summary =
    moment === 'lunch'
      ? `${window.kind === 'free' ? `Livre até ${minuteText(window.next.start)} · ` : ''}${calls.length} ${calls.length === 1 ? 'mesa aberta' : 'mesas abertas'}`
      : `Sua aula acabou · ${calls.length} ${calls.length === 1 ? 'volta saindo' : 'voltas saindo'}`;

  return (
    <Section
      title="Companhia agora"
      action={
        <Button
          variant="text"
          size="sm"
          label="Ver todas"
          icon="chevron_right"
          iconPosition="end"
          onPress={() => open()}
        />
      }
    >
      <Summary variant="meta" tone="muted">
        {summary}
      </Summary>
      <List>
        {top.map(call => {
          const icon = call.destination
            ? DESTINATION_TEXT[call.destination].icon
            : KIND_TEXT[call.kind].icon;
          return (
            <ListRow
              key={call.id}
              leading={
                <IconTile
                  icon={icon}
                  tone={call.kind === 'lunch' ? 'accent' : 'neutral'}
                />
              }
              title={callTitle(call)}
              subtitle={
                call.kind === 'home'
                  ? `${SPOT_TEXT[call.spot].short} · ${goingText(call.going)}`
                  : `${call.host} chamou · ${goingText(call.going)}`
              }
              aside={relativeText(call.at, nowMs)}
              chevron
              onPress={() => open(call.id)}
            />
          );
        })}
      </List>
    </Section>
  );
}
