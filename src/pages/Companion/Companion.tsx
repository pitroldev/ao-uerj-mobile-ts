import React, { useEffect, useMemo, useState } from 'react';
import {
  useIsFocused,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components/native';

import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  FootNote,
  IconTile,
  List,
  ListRow,
  Section,
  SegmentedControl,
  SkeletonList,
  Text,
  snackbar,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useHeaderBack } from '@templates/Header/headerStore';
import { useBackHandler } from '@hooks/useBackHandler';
import { useNow } from '@features/AttendedClassesSchedule/useNow';
import {
  useAppServices,
  useIdentity,
} from '@root/app/providers/AppServicesProvider';
import { useSchedule } from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { AppError } from '@root/shared/errors/AppError';
import { useCanInvite } from '@root/modules/delivery/presentation/DeliveryProvider';
import { InviteLine } from '@root/modules/delivery/presentation/InviteLine';
import { InviteSheet } from '@root/modules/delivery/presentation/InviteSheet';
import {
  COMPANION_INVITE,
  type Invite,
} from '@root/modules/delivery/presentation/inviteText';
import {
  isCurrent,
  type CallKind,
  type CompanionCall,
  type MemberCall,
  type Membership,
} from '@root/modules/companion/domain/companion';
import {
  freeWindow,
  watchUntil,
  type FreeWindow,
} from '@root/modules/companion/domain/window';
import {
  callTitle,
  clockText,
  companionErrorMessage,
  DESTINATION_TEXT,
  KIND_TEXT,
  LIFETIME_TEXT,
  relativeText,
  SPOT_TEXT,
  WATCH_CTA,
  watchingText,
  watchRequestText,
} from '@root/modules/companion/presentation/companionText';
import { useCompanionWatch } from '@root/modules/companion/presentation/useCompanionWatch';
import {
  companionKeys,
  useCompanionCalls,
  useCompanionName,
  useMemberships,
} from '@root/modules/companion/presentation/useCompanion';
import type { RootDrawerParamList } from '@root/routes';
import { CallRow } from './CallRow';
import { CallScreen } from './CallScreen';
import { CreateCallSheet } from './CreateCallSheet';
import { NameSheet } from './NameSheet';
import { minuteText, WindowCard } from './WindowCard';

const Gap = styled.View`
  height: ${({ theme }) => theme.spacing.md}px;
`;

const Notes = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

const WatchBox = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs}px;
`;

const NAME_AVATAR = 32;

/** A volta é o padrão à noite e depois da última aula do fim da tarde. */
function defaultKind(window: FreeWindow, now: Date): CallKind {
  if (now.getHours() >= 18) return 'home';
  if (window.kind === 'done' && window.last.end >= 17 * 60) return 'home';
  return 'lunch';
}

/**
 * O texto de quando a lista está vazia, conforme a hora e a grade, com
 * quantos outros alunos estão de olho (quem abrir primeiro junta a turma).
 */
function emptyText(
  kind: CallKind,
  window: FreeWindow,
  watching: string | null,
): {
  title: string;
  text: string;
} {
  const lookers = watching ? ` ${watching}.` : '';
  if (kind === 'home') {
    const last =
      window.kind === 'class' || window.kind === 'free'
        ? ` Hoje sua última aula acaba às ${minuteText(window.last.end)}.`
        : '';
    return {
      title: 'Nenhum grupo para voltar ainda',
      text: `Os grupos aparecem 1 hora antes da saída.${last}${lookers} Abra você: quem sai no mesmo horário vê na hora.`,
    };
  }
  const invite = 'Abra você: quem estiver livre no mesmo horário vê na hora.';
  return {
    title: 'Ninguém abriu mesa ainda',
    text: watching ? `${watching}. ${invite}` : invite,
  };
}

/**
 * Companhia agora: encontros de minutos com outros alunos. A mesa aberta no
 * almoço ou o grupo para voltar depois da última aula, com o horário livre
 * tirado da grade, o ponto de encontro dentro do campus e recados prontos.
 * Tocar numa mesa ou num grupo abre os detalhes; a seta do cabeçalho e o
 * voltar do Android fecham.
 */
export function CompanionPage() {
  const route = useRoute<RouteProp<RootDrawerParamList, 'Companhia agora'>>();
  const navigation = useNavigation();
  const requested = route.params?.callId;
  const [selected, setSelected] = useState<string | null>(requested ?? null);
  // aberta pelo Início ou por um aviso com a tela já montada: o pedido abre
  // a chamada uma vez, e o parâmetro sai para o próximo pedido valer
  const [handled, setHandled] = useState(requested);
  if (requested !== handled) {
    setHandled(requested);
    if (requested) setSelected(requested);
  }
  useEffect(() => {
    if (requested) navigation.setParams({ callId: undefined });
  }, [navigation, requested]);
  // o convite do Início: abre a folha de abrir uma vez, do tipo pedido
  const create = route.params?.create;
  const [createRequest, setCreateRequest] = useState<{
    kind: CallKind;
    key: number;
  } | null>(() => (create ? { kind: create, key: 1 } : null));
  const [handledCreate, setHandledCreate] = useState(create);
  if (create !== handledCreate) {
    setHandledCreate(create);
    if (create) {
      setSelected(null);
      setCreateRequest(previous => ({
        kind: create,
        key: (previous?.key ?? 0) + 1,
      }));
    }
  }
  useEffect(() => {
    if (create) navigation.setParams({ create: undefined });
  }, [navigation, create]);

  const close = () => setSelected(null);
  useBackHandler(close, Boolean(selected));
  useHeaderBack(selected ? close : null, 'Voltar para a lista');

  return (
    <CompanionScreen
      selected={selected}
      onSelect={setSelected}
      createRequest={createRequest}
    />
  );
}

function CompanionScreen({
  selected,
  onSelect,
  createRequest,
}: {
  selected: string | null;
  onSelect: (callId: string | null) => void;
  /** O pedido do Início para abrir a folha (uma vez por `key`). */
  createRequest: { kind: CallKind; key: number } | null;
}) {
  const { companion } = useAppServices();
  const { account } = useIdentity();
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const now = useNow();
  const schedule = useSchedule().data;
  const window = useMemo(
    () => freeWindow(schedule ?? [], now),
    [schedule, now],
  );
  const memberships = useMemberships();
  const { name, fallback, setName } = useCompanionName();
  const [tab, setTab] = useState<CallKind>(
    () => memberships[0]?.kind ?? defaultKind(window, now),
  );
  const [creating, setCreating] = useState<{ key: number } | null>(null);
  const [naming, setNaming] = useState<{
    key: number;
    required: boolean;
  } | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  // sem mesas nem grupos, o convite: mais gente no app, mais companhia
  const canInvite = useCanInvite();
  const [invite, setInvite] = useState<Invite | null>(null);
  // com a chamada aberta, a lista segue: quem está fora vê as vagas mudarem
  const query = useCompanionCalls({ poll: focused });
  const watch = useCompanionWatch(now.getTime());
  const scope = account?.scope ?? 'signed-out';
  const calls = query.data?.calls ?? [];
  const watching = watchingText(query.data?.watching ?? 0);
  const nowMs = now.getTime();

  // o convite do Início pediu para abrir: a aba certa e a folha (ou o nome antes)
  const [servedCreate, setServedCreate] = useState<number | null>(null);
  if (createRequest && createRequest.key !== servedCreate) {
    setServedCreate(createRequest.key);
    setTab(createRequest.kind);
    if (name) setCreating({ key: createRequest.key });
    else setNaming({ key: createRequest.key, required: true });
  }

  // a lista mostrou uma chamada do tipo pedido: o "Me avise" terminou
  const watchedHere = watch.request?.kind === tab ? watch.request : null;
  const listedOfTab = calls.filter(call => call.kind === tab).length;
  const { satisfied } = watch;
  useEffect(() => {
    if (focused && watchedHere && listedOfTab) void satisfied();
  }, [focused, watchedHere, listedOfTab, satisfied]);

  const roleOf = (callId: string) => {
    const membership = memberships.find(item => item.callId === callId);
    if (!membership) return null;
    return membership.host ? ('host' as const) : ('member' as const);
  };

  if (selected)
    return (
      <>
        <CallScreen
          callId={selected}
          listed={calls.find(call => call.id === selected)}
          name={name}
          onNeedName={() => setNaming({ key: Date.now(), required: true })}
          onBack={() => onSelect(null)}
        />
        {naming ? (
          <NameSheet
            key={naming.key}
            visible
            required={naming.required}
            name={name}
            fallback={fallback}
            onClose={() => setNaming(null)}
            onSave={setName}
          />
        ) : null}
      </>
    );

  const text = KIND_TEXT[tab];
  const shown = calls
    .filter(call => call.kind === tab)
    .sort(
      (a, b) =>
        Number(roleOf(b.id) !== null) - Number(roleOf(a.id) !== null) ||
        a.at - b.at,
    );
  // as chamadas em que o aluno está e que já saíram da lista (a volta depois
  // da saída, até o "Cheguei em casa")
  const outside = memberships.filter(
    item =>
      item.kind === tab &&
      isCurrent(item, nowMs) &&
      !calls.some(call => call.id === item.callId),
  );
  const host = memberships.find(item => item.host && isCurrent(item, nowMs));

  const openCreate = () => {
    if (!name) {
      setNaming({ key: Date.now(), required: true });
      return;
    }
    setCreating({ key: Date.now() });
  };

  const join = async (call: CompanionCall) => {
    if (!name) {
      setNaming({ key: Date.now(), required: true });
      return;
    }
    if (companion.wasRemoved(call.id)) {
      snackbar.error(`Quem abriu tirou você ${KIND_TEXT[call.kind].ofThis}.`);
      return;
    }
    setJoining(call.id);
    try {
      const joined = await companion.join(call.id, name);
      queryClient.setQueryData(companionKeys.call(scope, call.id), joined);
      void queryClient.invalidateQueries({
        queryKey: companionKeys.calls(scope),
      });
      snackbar.success(
        KIND_TEXT[call.kind].joined,
        `Encontro: ${SPOT_TEXT[call.spot].name}, ${clockText(call.at)}.`,
      );
      onSelect(call.id);
    } catch (error) {
      snackbar.error(companionErrorMessage(error, call.kind));
      void query.refetch();
    } finally {
      setJoining(null);
    }
  };

  const opened = (call: MemberCall) => {
    setCreating(null);
    queryClient.setQueryData(companionKeys.call(scope, call.id), call);
    void queryClient.invalidateQueries({
      queryKey: companionKeys.calls(scope),
    });
    snackbar.success(
      call.kind === 'lunch' ? 'Mesa aberta' : 'Grupo aberto',
      'Quem estiver livre no mesmo horário já vê. Quem entrar aparece aqui.',
    );
    onSelect(call.id);
  };

  const proofMissing =
    query.error instanceof AppError &&
    query.error.code === 'STUDENT_PROOF_UNAVAILABLE';

  let content: React.ReactNode;
  if (query.isLoading && !query.data) {
    content = (
      <SkeletonList count={3} accessibilityLabel="Carregando mesas e grupos…" />
    );
  } else if (proofMissing && !query.data) {
    content = (
      <EmptyState
        icon="lock"
        title="Confirmando que você é aluno"
        text="A Companhia agora só abre para alunos da UERJ, confirmados pela matrícula do login. Com a internet ligada, isso leva alguns segundos; em aparelhos sem a Play Store, não dá para confirmar."
        action={{
          label: 'Tentar de novo',
          icon: 'refresh',
          onPress: () => {
            void query.refetch();
          },
        }}
      />
    );
  } else if (query.error && !query.data) {
    content = (
      <ErrorState
        message={companionErrorMessage(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else {
    const empty = emptyText(tab, window, watching);
    const until = watchUntil(tab, window, now);
    const askWatch = async () => {
      if (until === null) return;
      setAsking(true);
      try {
        const result = await watch.ask(tab, until, []);
        if (result === 'requested')
          snackbar.success('Combinado', watchRequestText(tab, until));
        else
          snackbar.info(
            'Avisos desligados',
            'Sem os avisos do app ligados, não dá para avisar quando alguém abrir.',
          );
      } finally {
        setAsking(false);
      }
    };
    // quem não quer chamar pede um aviso: a lista vazia deixa de ser o fim
    const watchBox =
      watch.supported && (watchedHere || until !== null) ? (
        <WatchBox>
          {watchedHere ? (
            <>
              <Text variant="meta" tone="muted" align="center">
                {watchRequestText(tab, watchedHere.until)}
              </Text>
              <Button
                variant="text"
                size="sm"
                label="Cancelar o aviso"
                onPress={() => {
                  void watch.cancel();
                }}
              />
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              icon="notifications"
              label={WATCH_CTA[tab]}
              loading={asking}
              loadingLabel="Pedindo…"
              onPress={() => {
                void askWatch();
              }}
            />
          )}
        </WatchBox>
      ) : null;
    content =
      shown.length || outside.length ? (
        <List>
          {outside.map(item => (
            <MembershipRow
              key={item.callId}
              membership={item}
              now={nowMs}
              onOpen={() => onSelect(item.callId)}
            />
          ))}
          {shown.map(call => (
            <CallRow
              key={call.id}
              call={call}
              now={nowMs}
              role={roleOf(call.id)}
              joining={joining === call.id}
              onOpen={next => onSelect(next.id)}
              onJoin={next => {
                void join(next);
              }}
            />
          ))}
        </List>
      ) : (
        <>
          <EmptyState
            icon={text.icon}
            title={empty.title}
            text={empty.text}
            action={{ label: text.cta, icon: 'add', onPress: openCreate }}
          />
          {watchBox}
          {canInvite ? (
            <InviteLine
              text={
                tab === 'home'
                  ? 'Quanto mais gente, mais grupos para voltar.'
                  : 'Quanto mais gente, mais mesas no almoço.'
              }
              onPress={() => setInvite(COMPANION_INVITE)}
            />
          ) : null}
        </>
      );
  }

  return (
    <>
      <ScreenPanel
        refreshing={query.isRefetching && !query.isLoading}
        onRefresh={() => {
          void query.refetch();
        }}
      >
        <QueryNotice
          portal={false}
          isPaused={query.isPaused}
          isFetching={false}
          error={proofMissing ? null : query.error}
          hasData={query.data !== undefined}
          dataUpdatedAt={query.dataUpdatedAt}
          retry={query.refetch}
        />
        <SegmentedControl
          accessibilityLabel="Tipo de companhia"
          options={[
            {
              value: 'lunch',
              label: KIND_TEXT.lunch.label,
              icon: 'restaurant',
            },
            {
              value: 'home',
              label: KIND_TEXT.home.label,
              icon: 'directions_walk',
            },
          ]}
          value={tab}
          onChange={setTab}
        />
        <Gap />
        <WindowCard window={window} />

        <Section
          title={text.section}
          action={
            <Button
              variant="text"
              size="sm"
              icon="add"
              label={text.cta}
              onPress={openCreate}
            />
          }
        >
          {content}
          <Notes>
            {watching && (shown.length || outside.length) ? (
              <FootNote icon="groups" text={`${watching} na Companhia.`} />
            ) : null}
            <FootNote
              icon="schedule"
              text={`${LIFETIME_TEXT[tab]} Só aparece o primeiro nome.`}
            />
            <FootNote
              icon="lock"
              text="Só alunos da UERJ entram, confirmados pela matrícula. Os outros veem só o seu primeiro nome; numa denúncia, a moderação vê quem é. Sem foto, curso ou localização ao vivo; o encontro é sempre num lugar movimentado do campus."
            />
          </Notes>
        </Section>

        <Section title="Como você aparece" dense>
          <List>
            <ListRow
              leading={
                name ? (
                  <Avatar name={name} tone="accent" size={NAME_AVATAR} />
                ) : (
                  <IconTile icon="person" tone="muted" />
                )
              }
              title={name || 'Escolha um primeiro nome'}
              subtitle="Só o primeiro nome, nas mesas e grupos em que você entra"
              chevron
              onPress={() => setNaming({ key: Date.now(), required: false })}
              accessibilityLabel={`Como você aparece: ${name || 'sem nome'}. Trocar`}
            />
          </List>
        </Section>
      </ScreenPanel>

      {creating ? (
        <CreateCallSheet
          key={`${creating.key}-${tab}`}
          visible
          kind={tab}
          window={window}
          schedule={schedule ?? []}
          now={now}
          name={name}
          current={host ?? null}
          calls={calls.filter(
            call => roleOf(call.id) === null && !companion.wasRemoved(call.id),
          )}
          onJoin={call => {
            setCreating(null);
            void join(call);
          }}
          onClose={() => setCreating(null)}
          onOpened={opened}
        />
      ) : null}
      {naming ? (
        <NameSheet
          key={naming.key}
          visible
          required={naming.required}
          name={name}
          fallback={fallback}
          onClose={() => setNaming(null)}
          onSave={setName}
        />
      ) : null}
      <InviteSheet invite={invite} onClose={() => setInvite(null)} />
    </>
  );
}

/** Uma mesa ou um grupo em que o aluno está e que já saiu da lista. */
function MembershipRow({
  membership,
  now,
  onOpen,
}: {
  membership: Membership;
  now: number;
  onOpen: () => void;
}) {
  const spot = SPOT_TEXT[membership.spot];
  const icon = membership.destination
    ? DESTINATION_TEXT[membership.destination].icon
    : KIND_TEXT[membership.kind].icon;
  return (
    <ListRow
      leading={<IconTile icon={icon} tone="accent" />}
      title={callTitle(membership)}
      subtitle={`${spot.short} · ${relativeText(membership.at, now)}`}
      meta={
        membership.host
          ? KIND_TEXT[membership.kind].yours
          : KIND_TEXT[membership.kind].joined
      }
      highlighted
      chevron
      onPress={onOpen}
    />
  );
}
