import React, { useEffect, useRef, useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import styled, { useTheme } from 'styled-components/native';

import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  List,
  ListRow,
  Notice,
  Section,
  Skeleton,
  Tag,
  Text,
  snackbar,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useNow } from '@features/AttendedClassesSchedule/useNow';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import {
  canJoin,
  CompanionError,
  PHRASES_BY_KIND,
  seatsLeft,
  type CallMember,
  type CompanionCall,
  type MemberCall,
  type PhraseId,
} from '@root/modules/companion/domain/companion';
import {
  callTitle,
  clockText,
  companionErrorMessage,
  DESTINATION_TEXT,
  goingText,
  KIND_TEXT,
  LEAVE_PHRASE,
  PHRASE_TEXT,
  seatsText,
  SPOT_TEXT,
} from '@root/modules/companion/presentation/companionText';
import {
  companionKeys,
  useMemberCall,
  useMemberships,
} from '@root/modules/companion/presentation/useCompanion';
import { useNotificationSettings } from '@root/modules/notifications/presentation/useNotificationSettings';
import { MeetingMap } from './MeetingMap';
import { mapPlaceOf, meetingPins } from './meetingPoints';
import { ReportSheet } from './ReportSheet';

const Head = styled.View`
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const Below = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

const Step = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md}px;
  padding: ${({ theme }) => theme.spacing.sm}px 0px;
`;

const StepNumber = styled.View`
  width: ${({ theme }) => theme.sizes.tag}px;
  height: ${({ theme }) => theme.sizes.tag}px;
  border-radius: ${({ theme }) => theme.sizes.tag / 2}px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.fill};
`;

const StepBody = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xxs}px;
`;

const People = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Faces = styled.View`
  flex-direction: row;
`;

const Face = styled.View<{ $first: boolean }>`
  margin-left: ${({ $first }) => ($first ? 0 : -8)}px;
  border-radius: 14px;
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.background};
`;

/** Os recados prontos: botões que quebram em linhas. */
const Phrases = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const Grow = styled.View`
  flex: 1;
`;

/** O tamanho dos rostos de "Quem vai" e do recado. */
const FACE = 24;

type Props = {
  callId: string;
  /** A chamada como a lista a mostrou (quem está fora vê só isto). */
  listed: CompanionCall | undefined;
  name: string;
  /** Pede o nome antes de entrar, se o da conta não servir. */
  onNeedName: () => void;
  onBack: () => void;
};

/** "Júlia, Lucas e você"; "Você e Lucas" quando quem chamou é o aluno. */
function namesText(call: MemberCall): string {
  const names = call.members.map(member => (member.you ? 'você' : member.name));
  const text =
    names.length < 2
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
}

/**
 * A mesa ou o grupo por dentro: o que e quando, o ponto de encontro no
 * desenho do Mapa e, no grupo para voltar, a saída e o destino; o recado de
 * quem abriu; quem vai (os nomes só para quem está dentro); os recados
 * prontos; e sair, encerrar ou denunciar.
 */
export function CallScreen({
  callId,
  listed,
  name,
  onNeedName,
  onBack,
}: Props) {
  const theme = useTheme();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const { companion, campusMap } = useAppServices();
  const { account } = useIdentity();
  const scope = account?.scope ?? 'signed-out';
  const memberships = useMemberships();
  const membership = memberships.find(item => item.callId === callId);
  const query = useMemberCall(membership ? callId : null, { poll: focused });
  const { snapshot: notices, settings } = useNotificationSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // quem chamou tira alguém: a confirmação, com o nome
  const [removing, setRemoving] = useState<CallMember | null>(null);
  // de fora, uma denúncia por chamada (o servidor conta uma por aluno)
  const [reported, setReported] = useState(() => companion.hasReported(callId));
  const removed = !membership && companion.wasRemoved(callId);
  // o relógio da agenda: anda a cada minuto e na volta do app
  const now = useNow().getTime();

  const member = query.data;
  const call: CompanionCall | undefined = member ?? listed;

  // alguém entrou: o aviso aparece com o app aberto (não há push)
  const seen = useRef<string[] | null>(null);
  useEffect(() => {
    if (!member) return;
    const names = member.members
      .filter(item => !item.you)
      .map(item => item.name);
    const previous = seen.current;
    seen.current = names;
    if (!previous) return;
    // quem não estava antes (dois com o mesmo nome contam como dois)
    const before = [...previous];
    const arrived = names.filter(item => {
      const index = before.indexOf(item);
      if (index < 0) return true;
      before.splice(index, 1);
      return false;
    });
    if (arrived.length)
      snackbar.info(
        `${arrived.join(', ')} ${arrived.length === 1 ? 'entrou' : 'entraram'}`,
        `${callTitle(member)}: agora são ${member.going}.`,
      );
  }, [member]);

  const gone =
    query.error instanceof CompanionError &&
    (query.error.refusal === 'gone' || query.error.refusal === 'not_member');

  if (!call) {
    if (membership && query.isLoading)
      return (
        <ScreenPanel>
          <Skeleton width="40%" height={24} />
          <Below>
            <Skeleton width="80%" height={28} />
          </Below>
          <Below>
            <Skeleton height={196} radius={theme.radii.xl} cut />
          </Below>
        </ScreenPanel>
      );
    // dentro da chamada, uma falha de rede não é a chamada que acabou
    if (membership && query.error && !gone)
      return (
        <ScreenPanel>
          <ErrorState
            message={companionErrorMessage(query.error, membership.kind)}
            onRetry={() => {
              void query.refetch();
            }}
          />
        </ScreenPanel>
      );
    return (
      <ScreenPanel>
        <EmptyState
          icon="groups"
          title="Isso não está mais aqui"
          text="Passou do horário, quem abriu encerrou ou saiu do ar."
          action={{ label: 'Voltar para a lista', onPress: onBack }}
        />
      </ScreenPanel>
    );
  }

  const callKind = call.kind;
  const kind = KIND_TEXT[callKind];
  const spot = SPOT_TEXT[call.spot];
  const destination = call.destination
    ? DESTINATION_TEXT[call.destination]
    : null;
  const title = callTitle(call);
  const host = Boolean(membership?.host);
  const ended = Boolean(member?.endedAt);
  const left = seatsLeft(call);
  const pins = meetingPins(campusMap.atlas, call);
  const place = mapPlaceOf(call);
  const exit =
    destination && destination.exit !== call.spot
      ? SPOT_TEXT[destination.exit]
      : null;

  const refresh = (next: MemberCall) =>
    queryClient.setQueryData(companionKeys.call(scope, callId), next);
  const refreshList = () => {
    void queryClient.invalidateQueries({
      queryKey: companionKeys.calls(scope),
    });
  };

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      snackbar.error(companionErrorMessage(error, callKind));
    } finally {
      setBusy(null);
    }
  }

  const join = () => {
    if (!name) {
      onNeedName();
      return;
    }
    void run('join', async () => {
      const joined = await companion.join(callId, name);
      refresh(joined);
      refreshList();
      snackbar.success(
        kind.joined,
        `Encontro: ${spot.name}, ${clockText(joined.at)}. Quem vai já vê o seu primeiro nome.`,
      );
    });
  };

  const say = (phrase: PhraseId) => {
    void run(phrase, async () => {
      refresh(await companion.say(callId, phrase));
      snackbar.success(
        'Recado enviado',
        `“${PHRASE_TEXT[phrase]}” para quem vai.`,
      );
    });
  };

  const leave = () => {
    void run('leave', async () => {
      await companion.leave(callId);
      setConfirmLeave(false);
      refreshList();
      snackbar.success(
        host ? kind.ended : 'Você saiu',
        host
          ? 'Quem ia vê que você encerrou.'
          : `${call.host} vê só a contagem diminuir.`,
      );
      onBack();
    });
  };

  const close = () => {
    void companion.forget(callId).then(() => {
      refreshList();
      onBack();
    });
  };

  const remove = (person: CallMember) => {
    void run('remove', async () => {
      refresh(await companion.remove(callId, person.ref));
      refreshList();
      setRemoving(null);
      snackbar.success(
        `${person.name} saiu ${kind.ofThe}`,
        'Não vê mais os nomes nem os recados. Se foi algo grave, denuncie também.',
      );
    });
  };

  const steps = destination ? (
    <>
      <Step>
        <StepNumber>
          <Text variant="caption" tone="onFill">
            1
          </Text>
        </StepNumber>
        <StepBody>
          <Text weight="semibold">
            {spot.name}, {clockText(call.at)}
          </Text>
          <Text variant="meta" tone="muted">
            {spot.detail}
          </Text>
        </StepBody>
      </Step>
      {exit ? (
        <Step>
          <StepNumber>
            <Text variant="caption" tone="onFill">
              2
            </Text>
          </StepNumber>
          <StepBody>
            <Text weight="semibold">Saída pelo {exit.short}</Text>
            <Text variant="meta" tone="muted">
              {exit.detail}
            </Text>
          </StepBody>
        </Step>
      ) : null}
      <Step>
        <StepNumber>
          <Text variant="caption" tone="onFill">
            {exit ? 3 : 2}
          </Text>
        </StepNumber>
        <StepBody>
          <Text weight="semibold">{destination.name}</Text>
          <Text variant="meta" tone="muted">
            Cada um segue o seu caminho dali
          </Text>
        </StepBody>
      </Step>
    </>
  ) : (
    <Step>
      <Icon
        name="location_on"
        size={theme.sizes.icon.xxl}
        color={theme.colors.accent}
      />
      <StepBody>
        <Text weight="semibold">
          {spot.name}, {clockText(call.at)}
        </Text>
        <Text variant="meta" tone="muted">
          {spot.detail}
        </Text>
      </StepBody>
    </Step>
  );

  const phrases = PHRASES_BY_KIND[call.kind];
  const notify =
    membership &&
    notices.supported &&
    notices.permission !== null &&
    notices.permission !== 'granted';

  const footer = membership
    ? [
        <Button
          key="report"
          variant="outline"
          icon="report"
          label="Denunciar"
          disabled={busy !== null}
          onPress={() => setReporting(true)}
        />,
        ended ? (
          <Button key="close" label="Fechar" onPress={close} />
        ) : (
          <Button
            key="leave"
            variant="outline"
            label={host ? 'Encerrar' : 'Sair'}
            disabled={busy !== null}
            onPress={() => setConfirmLeave(true)}
          />
        ),
      ]
    : canJoin(call, now) && !removed
      ? [
          <Button
            key="join"
            label={kind.join}
            loading={busy === 'join'}
            loadingLabel="Entrando…"
            onPress={join}
          />,
        ]
      : undefined;

  return (
    <>
      <ScreenPanel
        footer={footer}
        refreshing={query.isRefetching && !query.isLoading}
        onRefresh={
          membership
            ? () => {
                void query.refetch();
              }
            : undefined
        }
      >
        <Head>
          <Tag
            tone={call.kind === 'lunch' ? 'info' : 'neutral'}
            icon={kind.icon}
            label={kind.label}
          />
          <Text variant="titleL" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="meta" tone="muted">
            {host ? 'Você abriu' : `${call.host} abriu`} · some às{' '}
            {clockText(call.expiresAt)} · {seatsText(left)}
          </Text>
        </Head>

        {ended ? (
          <Below>
            <Notice
              tone="neutral"
              icon="info"
              text={`Quem abriu encerrou ${kind.this}. Ninguém mais entra, e ${call.kind === 'lunch' ? 'ela' : 'ele'} some no horário.`}
            />
          </Below>
        ) : null}
        {removed ? (
          <Below>
            <Notice
              tone="neutral"
              icon="info"
              text={`Quem abriu tirou você ${kind.ofThis}. ${kind.another}.`}
            />
          </Below>
        ) : null}

        <Section title="Onde" dense>
          <MeetingMap
            pins={pins}
            accessibilityLabel={`Mapa: ${spot.name}${
              destination
                ? `, saída pelo ${exit?.short}, ${destination.name}`
                : ''
            }`}
          />
          <Below>{steps}</Below>
          {place ? (
            <Button
              variant="text"
              size="sm"
              icon="location_on"
              label="Ver no Mapa"
              onPress={() => navigation.navigate('Mapa', { place })}
            />
          ) : null}
        </Section>

        {call.note ? (
          <Below>
            <Card muted>
              <Text variant="caption" tone="muted">
                {host ? 'Seu recado' : `Recado de ${call.host}`}
              </Text>
              <Text>{call.note}</Text>
            </Card>
          </Below>
        ) : null}

        <Section title="Quem vai" note={goingText(call.going)}>
          {member && host && !ended ? (
            // quem chamou vê cada pessoa e pode tirar quem incomodar
            <List>
              {member.members.map((item, index) => (
                <ListRow
                  key={item.ref || `${item.name}-${index}`}
                  dense
                  leading={
                    <Avatar name={item.name} tone="accent" size={FACE} />
                  }
                  title={item.you ? 'Você' : item.name}
                  titleWeight="regular"
                  meta={item.host ? 'Abriu' : undefined}
                  trailing={
                    !item.host && item.ref ? (
                      <Button
                        variant="text"
                        size="xs"
                        label="Tirar"
                        accessibilityLabel={`Tirar ${item.name} ${kind.ofThe}`}
                        disabled={busy !== null}
                        onPress={() => setRemoving(item)}
                      />
                    ) : undefined
                  }
                />
              ))}
            </List>
          ) : member ? (
            <People>
              <Faces>
                {member.members.slice(0, 5).map((item, index) => (
                  <Face key={`${item.name}-${index}`} $first={index === 0}>
                    <Avatar name={item.name} tone="accent" size={FACE} />
                  </Face>
                ))}
              </Faces>
              <Grow>
                <Text>{namesText(member)}</Text>
              </Grow>
            </People>
          ) : (
            <Text tone="muted">
              {goingText(call.going)}. Os nomes aparecem depois que você entrar;
              ninguém vê sua grade, seu curso ou sua foto.
            </Text>
          )}
        </Section>

        {member && !ended ? (
          <Section title="Recados" note="só frases prontas">
            <Phrases accessibilityLabel="Mandar recado">
              {phrases.map(phrase => (
                <Button
                  key={phrase}
                  variant="outline"
                  size="xs"
                  label={PHRASE_TEXT[phrase]}
                  loading={busy === phrase}
                  disabled={busy !== null}
                  onPress={() => say(phrase)}
                />
              ))}
              <Button
                variant="outline"
                size="xs"
                label={LEAVE_PHRASE}
                disabled={busy !== null}
                onPress={() => setConfirmLeave(true)}
              />
            </Phrases>
            {member.feed.length ? (
              <Below>
                <List>
                  {[...member.feed].reverse().map((entry, index) => (
                    <ListRow
                      key={`${entry.at}-${index}`}
                      dense
                      leading={
                        <Avatar name={entry.name} tone="accent" size={FACE} />
                      }
                      title={`${entry.you ? 'Você' : entry.name}: ${PHRASE_TEXT[entry.phrase]}`}
                      titleWeight="regular"
                      aside={clockText(entry.at)}
                    />
                  ))}
                </List>
              </Below>
            ) : (
              <Below>
                <Text variant="meta" tone="muted">
                  Nenhum recado ainda.
                </Text>
              </Below>
            )}
          </Section>
        ) : null}

        {notify ? (
          <Below>
            <Notice
              tone="info"
              icon="notifications"
              text={
                call.kind === 'home'
                  ? 'Ative os avisos para lembrar 10 minutos antes da saída e, depois, avisar que chegou.'
                  : 'Ative os avisos para lembrar 10 minutos antes da mesa.'
              }
              action={
                notices.permission === 'blocked'
                  ? {
                      label: 'Abrir configurações',
                      onPress: () => {
                        void settings.openSettings();
                      },
                    }
                  : {
                      label: 'Ativar avisos',
                      onPress: () => {
                        void settings.requestPermission();
                      },
                    }
              }
            />
          </Below>
        ) : null}

        {membership && !ended ? (
          <Below>
            <Text variant="meta" tone="muted">
              {call.kind === 'home'
                ? '40 minutos depois da saída, o app pergunta se você quer avisar que chegou. Recados e quem entra aparecem com o app aberto.'
                : 'Recados e quem entra aparecem com o app aberto; 10 minutos antes, o app avisa.'}
            </Text>
          </Below>
        ) : null}

        {!membership ? (
          <Below>
            {removed ? null : (
              <Text variant="meta" tone="muted">
                Quem vai passa a ver o seu primeiro nome ({name || 'escolha um'}
                ). O encontro é num lugar movimentado do campus.
              </Text>
            )}
            {reported ? (
              <Below>
                <Text variant="meta" tone="muted">
                  Você denunciou. A moderação vai olhar.
                </Text>
              </Below>
            ) : (
              <Button
                variant="text"
                size="sm"
                icon="report"
                label={`Denunciar ${kind.this}`}
                color={theme.status.bad.ink}
                onPress={() => setReporting(true)}
              />
            )}
          </Below>
        ) : null}
      </ScreenPanel>

      <ReportSheet
        visible={reporting}
        callId={callId}
        title={title}
        member={Boolean(membership)}
        host={host}
        onClose={() => setReporting(false)}
        onReported={() => {
          if (!membership) setReported(true);
          setReporting(false);
        }}
      />

      <BottomSheet
        visible={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Tirar ${removing.name} ${kind.ofThe}?` : ''}
        swipeToClose={busy === null}
        footer={[
          <Button
            key="back"
            variant="outline"
            label="Voltar"
            disabled={busy !== null}
            onPress={() => setRemoving(null)}
          />,
          <Button
            key="remove"
            label="Tirar"
            loading={busy === 'remove'}
            loadingLabel="Tirando…"
            onPress={() => {
              if (removing) remove(removing);
            }}
          />,
        ]}
      >
        <Text tone="muted">
          {removing?.name} sai e deixa de ver os nomes e os recados. A vaga
          volta para a lista. Se foi algo grave, denuncie também: a moderação
          vê.
        </Text>
      </BottomSheet>

      <BottomSheet
        visible={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={host ? `Encerrar ${kind.the}?` : `Sair ${kind.ofThe}?`}
        swipeToClose={busy === null}
        footer={[
          <Button
            key="back"
            variant="outline"
            label="Voltar"
            disabled={busy !== null}
            onPress={() => setConfirmLeave(false)}
          />,
          <Button
            key="leave"
            label={host ? 'Encerrar' : 'Sair'}
            loading={busy === 'leave'}
            loadingLabel={host ? 'Encerrando…' : 'Saindo…'}
            onPress={leave}
          />,
        ]}
      >
        <Text tone="muted">
          {host
            ? 'Ninguém mais entra, e quem ia vê que você encerrou.'
            : `Sua vaga volta para a lista, e ${call.host} vê só a contagem diminuir. Se mudar de ideia, dá para entrar de novo enquanto houver vaga.`}
        </Text>
      </BottomSheet>
    </>
  );
}
