import React, { useEffect, useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import styled from 'styled-components/native';

import {
  Button,
  IconTile,
  List,
  ListRow,
  Section,
  Text,
  snackbar,
} from '@components/ui';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  isCurrent,
  SPOTS_BY_KIND,
  type CallKind,
  type CompanionCall,
} from '@root/modules/companion/domain/companion';
import {
  freeWindow,
  timeOptions,
  watchUntil,
  type FreeWindow,
} from '@root/modules/companion/domain/window';
import {
  callTitle,
  clockText,
  DESTINATION_TEXT,
  goingText,
  KIND_TEXT,
  relativeText,
  SPOT_TEXT,
  WATCH_CTA,
  watchingText,
  watchRequestText,
} from '@root/modules/companion/presentation/companionText';
import {
  useCompanionCalls,
  useMemberships,
} from '@root/modules/companion/presentation/useCompanion';
import { useCompanionInvite } from '@root/modules/companion/presentation/useCompanionInvite';
import { useCompanionWatch } from '@root/modules/companion/presentation/useCompanionWatch';
import { isFeatureDisabled } from '@root/modules/delivery/domain/appStatus';
import { useRemoteStatus } from '@root/modules/delivery/presentation/DeliveryProvider';

const Summary = styled(Text)`
  margin-top: -${({ theme }) => theme.spacing.xs}px;
  margin-bottom: ${({ theme }) => theme.spacing.xs}px;
`;

/** Os botões do convite, numa linha que quebra. */
const Actions = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm}px;
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

const Watching = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

/** No Início, a lista anda devagar: um minuto. */
const HOME_POLL_MS = 60_000;
/** Até quanto depois da última aula o grupo para voltar aparece no Início. */
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
 * "Companhia agora" no Início, logo abaixo da próxima aula: a mesa ou o grupo em que
 * o aluno está ou, na hora certa, as mesas abertas no horário livre e os
 * grupos para voltar depois da última aula. Com a lista vazia na hora certa, o
 * convite: abrir a primeira mesa ou pedir um aviso se alguém abrir ("Agora
 * não" esconde até o fim do dia). Fora da hora, não aparece.
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
  const invite = useCompanionInvite(now);
  const watch = useCompanionWatch(nowMs);
  const [asking, setAsking] = useState(false);

  const calls = (query.data?.calls ?? []).filter(
    (call: CompanionCall) =>
      call.kind === moment && call.at > nowMs - 5 * 60_000,
  );
  const watched = watch.request?.kind === moment ? watch.request : null;
  const { satisfied } = watch;
  // alguém abriu com o Início na tela: o aviso pedido já não precisa sair
  useEffect(() => {
    if (focused && watched && calls.length) void satisfied();
  }, [focused, watched, calls.length, satisfied]);

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
            meta={
              current.host
                ? KIND_TEXT[current.kind].yours
                : KIND_TEXT[current.kind].joined
            }
            highlighted
            chevron
            onPress={() => open(current.callId)}
          />
        </List>
      </Section>
    );
  }

  // a lista ainda não veio: nada de convite antes de saber se há mesa ou grupo
  if (!moment || !query.data) return null;
  const watching = watchingText(query.data.watching);
  const free =
    window.kind === 'free'
      ? `Livre até ${minuteText(window.next.start)} · `
      : '';

  if (!calls.length) {
    if (!invite.ready || (invite.dismissed && !watched)) return null;
    return (
      <Invite
        kind={moment}
        window={window}
        now={now}
        summary={
          moment === 'lunch'
            ? `${free}nenhuma mesa aberta`
            : 'Sua aula acabou · nenhum grupo para voltar ainda'
        }
        watching={watching}
        watched={watched}
        watchSupported={watch.supported}
        asking={asking}
        onCreate={() =>
          navigation.navigate('Companhia agora', { create: moment })
        }
        onWatch={async until => {
          setAsking(true);
          try {
            const result = await watch.ask(moment, until, []);
            if (result === 'requested')
              snackbar.success('Combinado', watchRequestText(moment, until));
            else
              snackbar.info(
                'Avisos desligados',
                'Sem os avisos do app ligados, não dá para avisar quando alguém abrir.',
              );
          } finally {
            setAsking(false);
          }
        }}
        onCancelWatch={() => {
          void watch.cancel();
        }}
        onDismiss={() => {
          void invite.dismiss();
        }}
      />
    );
  }

  // a mais próxima primeiro, como na lista
  const top = [...calls].sort((a, b) => a.at - b.at).slice(0, 2);
  const summary =
    moment === 'lunch'
      ? `${free}${calls.length} ${calls.length === 1 ? 'mesa aberta' : 'mesas abertas'}`
      : `Sua aula acabou · ${calls.length} ${calls.length === 1 ? 'grupo para voltar' : 'grupos para voltar'}`;

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
        {watching ? `${summary} · ${watching}` : summary}
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
                  : `${call.host} abriu · ${goingText(call.going)}`
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

type InviteProps = {
  kind: CallKind;
  window: FreeWindow;
  now: Date;
  summary: string;
  watching: string | null;
  watched: { until: number } | null;
  watchSupported: boolean;
  asking: boolean;
  onCreate: () => void;
  onWatch: (until: number) => Promise<void>;
  onCancelWatch: () => void;
  onDismiss: () => void;
};

/**
 * A lista vazia na hora certa: o convite para abrir a primeira mesa ou grupo (o
 * horário e o ponto que a folha já traz) ou, para quem não quer abrir,
 * o aviso se alguém abrir no horário livre.
 */
function Invite({
  kind,
  window,
  now,
  summary,
  watching,
  watched,
  watchSupported,
  asking,
  onCreate,
  onWatch,
  onCancelWatch,
  onDismiss,
}: InviteProps) {
  const first = timeOptions(kind, window, now)[0];
  const spot = SPOT_TEXT[SPOTS_BY_KIND[kind][0]];
  const until = watchUntil(kind, window, now);
  const when = first ? `Às ${clockText(first)}` : 'Escolha o horário';
  return (
    <Section title="Companhia agora">
      <Summary variant="meta" tone="muted">
        {summary}
      </Summary>
      <List>
        <ListRow
          leading={<IconTile icon={KIND_TEXT[kind].icon} tone="accent" />}
          title={KIND_TEXT[kind].first}
          subtitle={
            kind === 'lunch'
              ? `${when} no ${spot.short} · quem estiver livre vê na hora`
              : `${first ? `Saindo às ${clockText(first)}` : 'Escolha a hora'} da ${spot.short} · metrô, trem ou ônibus`
          }
          chevron
          onPress={onCreate}
        />
      </List>
      {watching ? (
        <Watching variant="meta" tone="muted">
          {watching}: quem abrir primeiro junta a turma.
        </Watching>
      ) : null}
      {watched ? (
        <Actions>
          <Text variant="meta" tone="muted">
            {watchRequestText(kind, watched.until)}
          </Text>
          <Button
            variant="text"
            size="sm"
            label="Cancelar o aviso"
            onPress={onCancelWatch}
          />
        </Actions>
      ) : (
        <Actions>
          {watchSupported && until !== null ? (
            <Button
              variant="outline"
              size="sm"
              icon="notifications"
              label={WATCH_CTA[kind]}
              loading={asking}
              loadingLabel="Pedindo…"
              onPress={() => {
                void onWatch(until);
              }}
            />
          ) : null}
          <Button
            variant="text"
            size="sm"
            label="Agora não"
            onPress={onDismiss}
          />
        </Actions>
      )}
    </Section>
  );
}
