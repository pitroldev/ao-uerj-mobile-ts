import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import styled from 'styled-components/native';

import {
  Button,
  EmptyState,
  ErrorState,
  FootNote,
  IconTile,
  List,
  ListRow,
  Notice,
  Section,
  SkeletonList,
  Text,
  snackbar,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { useHeaderBack } from '@templates/Header/headerStore';
import { useBackHandler } from '@hooks/useBackHandler';
import { useNow } from '@features/AttendedClassesSchedule/useNow';
import { StillThereCard } from '@features/CampusNow/StillThereCard';
import {
  HowItWorksSheet,
  proofWaitText,
  type HowItWorksItem,
} from '@features/HowItWorks/HowItWorksSheet';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import { useSchedule } from '@root/modules/academics/presentation/queries';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import { useNotificationSettings } from '@root/modules/notifications/presentation/useNotificationSettings';
import { useCanInvite } from '@root/modules/delivery/presentation/DeliveryProvider';
import { InviteLine } from '@root/modules/delivery/presentation/InviteLine';
import { InviteSheet } from '@root/modules/delivery/presentation/InviteSheet';
import {
  CAMPUS_INVITE,
  type Invite,
} from '@root/modules/delivery/presentation/inviteText';
import { AppError } from '@root/shared/errors/AppError';
import {
  ENDS_TO_CLOSE,
  isLive,
  type CampusNotice,
  type NoticeAnswer,
} from '@root/modules/campus-now/domain/campusNow';
import {
  askTarget,
  classSpots,
  nearReason,
  roomClasses,
} from '@root/modules/campus-now/domain/nearby';
import { leveledUp } from '@root/modules/campus-now/domain/progress';
import {
  campusNowErrorMessage,
  colleagues,
  levelName,
  levelText,
  mapTarget,
  noticeTitle,
  placeText,
  pointsText,
} from '@root/modules/campus-now/presentation/campusNowText';
import {
  useCampusActions,
  useCampusNotices,
  useCampusNowState,
} from '@root/modules/campus-now/presentation/useCampusNow';
import type { RootDrawerParamList } from '@root/routes';
import { CommunityView } from './CommunityView';
import { NoticeMap } from './NoticeMap';
import { NoticeRow, type RowBusy } from './NoticeRow';
import { NoticeSheet } from './NoticeSheet';
import { ReportSheet } from './ReportSheet';
import { YouView } from './YouView';

const Live = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md}px;
  margin-bottom: ${({ theme }) => theme.spacing.md}px;
`;

const Helpers = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm}px;
  flex-shrink: 1;
`;

/** O ponto de "ao vivo": verde com gente ajudando, apagado sem ninguém. */
const Dot = styled.View<{ $live: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: ${({ theme, $live }) =>
    $live ? theme.status.good.ink : theme.colors.inkSubtle};
`;

const Gap = styled.View`
  height: ${({ theme }) => theme.spacing.lg}px;
`;

const Notes = styled.View`
  margin-top: ${({ theme }) => theme.spacing.lg}px;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

type View = 'live' | 'you' | 'community';

/** O detalhe que sai do rodapé: abre por "Como funciona". */
const HOW_IT_WORKS: readonly HowItWorksItem[] = [
  {
    icon: 'verified',
    text: 'Só alunos da UERJ avisam, confirmados pela matrícula do login.',
  },
  {
    icon: 'visibility_off',
    text: 'Ninguém vê quem avisou: sem foto e sem nomes.',
  },
  { icon: 'flag', text: 'Se alguém denunciar, a moderação vê quem avisou.' },
  {
    icon: 'schedule',
    text: 'Cada aviso some sozinho. Cada "Continua" empurra o fim, e três "Acabou" encerram antes.',
  },
];

/** Por quanto tempo o aviso escolhido fica marcado na lista. */
const SELECTED_MS = 3000;

const VIEW_TITLES: Record<Exclude<View, 'live'>, string> = {
  you: 'Voltar para Agora no campus',
  community: 'Voltar para Agora no campus',
};

/**
 * Agora no campus: o mapa com os avisos de todo mundo, a pergunta do momento
 * ("ainda está lá?", a quem a grade diz que vai passar por ali), a lista e o
 * "Avisar". "Você ajudou" e "Comunidade" abrem por cima, com a seta do
 * cabeçalho e o voltar do Android.
 */
export function CampusNowPage() {
  const route = useRoute<RouteProp<RootDrawerParamList, 'Agora no campus'>>();
  const navigation = useNavigation();
  const { campusNow } = useAppServices();
  const [view, setView] = useState<View>('live');
  // o Início pediu para avisar: a folha abre uma vez por pedido
  const report = route.params?.report;
  const [reportKey, setReportKey] = useState(report ? 1 : 0);
  const [handledReport, setHandledReport] = useState(report);
  if (report !== handledReport) {
    setHandledReport(report);
    if (report) {
      setView('live');
      setReportKey(key => key + 1);
    }
  }
  useEffect(() => {
    if (report) navigation.setParams({ report: undefined });
  }, [navigation, report]);

  const focused = useIsFocused();
  // a primeira visita liga os avisos do celular (se o aluno os quiser)
  useEffect(() => {
    if (focused) void campusNow.visit().catch(() => undefined);
  }, [campusNow, focused]);

  const close = () => setView('live');
  // quem sai e volta (pelo menu, pelo Início ou por um aviso do celular)
  // encontra a lista ao vivo, com a pergunta do momento, e não a subtela de antes
  useFocusEffect(useCallback(() => () => setView('live'), []));
  useBackHandler(close, view !== 'live');
  useHeaderBack(
    view !== 'live' ? close : null,
    view !== 'live' ? VIEW_TITLES[view] : undefined,
  );

  const now = useNow();
  if (view === 'you') return <YouView now={now.getTime()} />;
  if (view === 'community') return <CommunityView now={now.getTime()} />;
  return <LiveView now={now} reportKey={reportKey} onOpen={setView} />;
}

function LiveView({
  now,
  reportKey,
  onOpen,
}: {
  now: Date;
  /** Muda quando o Início pede a folha de avisar. */
  reportKey: number;
  onOpen: (view: Exclude<View, 'live'>) => void;
}) {
  const navigation = useNavigation();
  const { campusNow } = useAppServices();
  const focused = useIsFocused();
  const nowMs = now.getTime();
  const schedule = useSchedule().data;
  const spots = useMemo(() => classSpots(schedule ?? [], now), [schedule, now]);
  const classes = useMemo(() => roomClasses(schedule ?? []), [schedule]);
  // as salas da grade ficam para a verificação sem tela (que não entra no portal)
  useEffect(() => {
    if (schedule)
      void campusNow.rememberClasses(classes).catch(() => undefined);
  }, [campusNow, classes, schedule]);

  const query = useCampusNotices({ poll: focused });
  const state = useCampusNowState();
  const actions = useCampusActions();
  const { snapshot: alerts, settings } = useNotificationSettings();
  const [reporting, setReporting] = useState(reportKey > 0);
  const [servedReport, setServedReport] = useState(reportKey);
  if (reportKey !== servedReport) {
    setServedReport(reportKey);
    if (reportKey) setReporting(true);
  }
  const [selected, setSelected] = useState<string | null>(null);
  // o aviso escolhido no mapa (ou o que acabou de sair) fica marcado por um momento
  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => setSelected(null), SELECTED_MS);
    return () => clearTimeout(timer);
  }, [selected]);
  const [details, setDetails] = useState<CampusNotice | null>(null);
  const [busy, setBusy] = useState<{ id: string; kind: RowBusy } | null>(null);
  // sem avisos, o convite: o Agora no campus depende de quem está lá
  const canInvite = useCanInvite();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [explaining, setExplaining] = useState(false);

  const notices = useMemo(
    () => (query.data?.notices ?? []).filter(notice => isLive(notice, nowMs)),
    [query.data, nowMs],
  );
  const ask = askTarget(notices, spots, {
    skipped: state.skipped,
    now: nowMs,
    prefer: state.asked,
  });
  // perto do aluno primeiro, depois os dele, os confirmados e os mais novos
  const ordered = useMemo(
    () =>
      notices
        .map(notice => ({ notice, near: nearReason(notice, spots) }))
        .sort(
          (a, b) =>
            Number(b.near !== null) - Number(a.near !== null) ||
            Number(b.notice.mine) - Number(a.notice.mine) ||
            Number(b.notice.confirmed) - Number(a.notice.confirmed) ||
            b.notice.createdAt - a.notice.createdAt,
        ),
    [notices, spots],
  );

  // o que apareceu na tela conta em "quantos viram" (uma vez por aviso)
  const visibleIds = useMemo(
    () => notices.filter(notice => !notice.mine).map(notice => notice.id),
    [notices],
  );
  useEffect(() => {
    if (focused && visibleIds.length)
      void campusNow.markSeen(visibleIds).catch(() => undefined);
  }, [campusNow, focused, visibleIds]);

  const levelUpText = (before: number | null, level: number) =>
    leveledUp(before === null ? null : { level: before }, { level })
      ? ` Você subiu para o nível ${level}, ${levelName(level)}.`
      : '';

  const answer = async (notice: CampusNotice, value: NoticeAnswer) => {
    setBusy({ id: notice.id, kind: value });
    try {
      const result = await actions.answer(notice.id, value);
      const points = result.you.earned
        ? ` · ${pointsText(result.you.earned)}`
        : '';
      const up = levelUpText(result.before, result.you.level);
      if (notice.mine)
        snackbar.success(
          'Aviso encerrado',
          'Saiu do mapa para todo mundo. Valeu por avisar!',
        );
      else if (value === 'confirm')
        snackbar.success(
          `Confirmado${points}`,
          `${colleagues(result.notice.confirmations)} ${result.notice.confirmations === 1 ? 'confirmou' : 'confirmaram'} até agora.${up}`,
        );
      else if (result.notice.state !== 'active')
        snackbar.success(
          `Acabou${points}`,
          `${result.notice.ends} disseram que acabou: o aviso saiu do mapa.${up}`,
        );
      else
        snackbar.success(
          `Anotado${points}`,
          `${result.notice.ends} de ${ENDS_TO_CLOSE} disseram que acabou.${up}`,
        );
    } catch (error) {
      snackbar.error(campusNowErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const thank = async (notice: CampusNotice) => {
    setBusy({ id: notice.id, kind: 'thanks' });
    try {
      await actions.thank(notice.id);
      snackbar.success(
        'Valeu enviado',
        'Quem avisou recebe, sem saber que foi você.',
      );
    } catch (error) {
      snackbar.error(campusNowErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const skip = async (notice: CampusNotice) => {
    try {
      await actions.skip(notice.id);
      snackbar.info(
        'Tudo bem',
        'O app não pergunta de novo sobre esse aviso hoje.',
      );
    } catch {
      snackbar.error('Não foi possível salvar agora. Tente de novo.');
    }
  };

  const openMap = (notice: CampusNotice) => {
    setDetails(null);
    navigation.navigate('Mapa', mapTarget(notice.place));
  };

  const select = (notice: CampusNotice) => {
    setSelected(notice.id);
    snackbar.info(
      noticeTitle(notice),
      `${placeText(notice.place)} · ${notice.confirmed ? 'confirmado' : 'novo, esperando confirmação'}`,
    );
  };

  const proofMissing =
    query.error instanceof AppError &&
    query.error.code === 'STUDENT_PROOF_UNAVAILABLE';
  const data = query.data;
  const helpers = data?.helpersToday ?? 0;

  let content: React.ReactNode;
  if (query.isLoading && !data) {
    content = (
      <SkeletonList count={3} accessibilityLabel="Carregando os avisos…" />
    );
  } else if (proofMissing && !data) {
    content = (
      <EmptyState
        icon="lock"
        title="Confirmando que você é aluno"
        text={proofWaitText()}
        action={{
          label: 'Tentar de novo',
          icon: 'refresh',
          onPress: () => {
            void query.refetch();
          },
        }}
      />
    );
  } else if (!data) {
    content = (
      <ErrorState
        message={campusNowErrorMessage(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  } else {
    content = (
      <>
        <Live>
          <Helpers
            accessible
            accessibilityLabel={
              helpers
                ? `${colleagues(helpers)} ${helpers === 1 ? 'ajudou' : 'ajudaram'} hoje`
                : 'Nenhum aviso hoje ainda'
            }
          >
            <Dot $live={helpers > 0} />
            {helpers ? (
              <Text variant="meta" tone="muted">
                <Text variant="meta" weight="semibold" tabular>
                  {helpers.toLocaleString('pt-BR')}
                </Text>
                {` ${helpers === 1 ? 'colega ajudou' : 'colegas ajudaram'} hoje`}
              </Text>
            ) : (
              <Text variant="meta" tone="muted">
                Nenhum aviso hoje ainda
              </Text>
            )}
          </Helpers>
          <Button
            variant="text"
            size="xs"
            icon="verified"
            label={`Nível ${data.you.level}`}
            onPress={() => onOpen('you')}
            accessibilityLabel={`${levelText(data.you.level)}, ${data.you.points} pontos. Ver o que você ajudou`}
          />
        </Live>
        {ask ? (
          <>
            <StillThereCard
              notice={ask.notice}
              near={ask.near}
              now={nowMs}
              busy={
                busy?.id === ask.notice.id && busy.kind !== 'thanks'
                  ? busy.kind
                  : null
              }
              onAnswer={(notice, value) => {
                void answer(notice, value);
              }}
              onSkip={notice => {
                void skip(notice);
              }}
            />
            <Gap />
          </>
        ) : null}
        {notices.length ? (
          <NoticeMap notices={notices} selected={selected} onSelect={select} />
        ) : null}
        <Section
          title="Avisos agora"
          first={!notices.length && !ask}
          note={notices.length ? String(notices.length) : undefined}
        >
          {ordered.length ? (
            <List>
              {ordered.map(({ notice, near }) => (
                <NoticeRow
                  key={notice.id}
                  notice={notice}
                  now={nowMs}
                  near={near}
                  highlighted={notice.id === selected}
                  busy={busy?.id === notice.id ? busy.kind : null}
                  onAnswer={(item, value) => {
                    void answer(item, value);
                  }}
                  onThank={item => {
                    void thank(item);
                  }}
                  onMore={setDetails}
                />
              ))}
            </List>
          ) : (
            <>
              <EmptyState
                icon="task_alt"
                title="Tudo tranquilo no campus agora"
                text="Nenhum aviso valendo. Viu fila, falta de luz ou Wi-Fi fora? Avise em dois toques: quem vai passar por lá agradece."
              />
              {canInvite ? (
                <InviteLine
                  text="Quanto mais gente, mais avisos no caminho."
                  onPress={() => setInvite(CAMPUS_INVITE)}
                />
              ) : null}
            </>
          )}
        </Section>

        <Section title="Você e o campus" dense>
          <List>
            <ListRow
              leading={<IconTile icon="verified" tone="accent" />}
              title="Você ajudou"
              subtitle={`${levelText(data.you.level)} · ${data.you.points.toLocaleString('pt-BR')} pontos`}
              chevron
              onPress={() => onOpen('you')}
            />
            <ListRow
              leading={<IconTile icon="groups" tone="accent" />}
              title="Comunidade"
              subtitle="O campus na semana e no mês, somando todo mundo"
              chevron
              onPress={() => onOpen('community')}
            />
          </List>
        </Section>

        <Notes>
          {alerts.supported &&
          alerts.frequentWatches &&
          alerts.ready &&
          alerts.preferences.campusAlerts &&
          alerts.permission !== null &&
          alerts.permission !== 'granted' ? (
            <Notice
              tone="info"
              icon="notifications"
              text='Ligue os avisos do app para receber o "ainda está lá?" quando um aviso estiver no caminho da sua aula.'
              action={{
                label:
                  alerts.permission === 'blocked'
                    ? 'Abrir configurações'
                    : 'Ligar avisos',
                onPress: () => {
                  void (alerts.permission === 'blocked'
                    ? settings.openSettings()
                    : settings.requestPermission());
                },
              }}
            />
          ) : null}
          <FootNote icon="schedule" text="Cada aviso some sozinho." />
          <FootNote
            icon="lock"
            text="Ninguém vê quem avisou."
            link={{
              label: 'Como funciona',
              onPress: () => setExplaining(true),
            }}
          />
        </Notes>
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
        footer={
          data ? (
            <Button
              icon="campaign"
              label="Avisar"
              onPress={() => setReporting(true)}
              accessibilityHint="Avisa os colegas sobre algo no campus, em dois toques"
            />
          ) : undefined
        }
      >
        <QueryNotice
          portal={false}
          isPaused={query.isPaused}
          isFetching={false}
          error={proofMissing || !data ? null : query.error}
          hasData={data !== undefined}
          dataUpdatedAt={query.dataUpdatedAt}
          retry={query.refetch}
        />
        {content}
      </ScreenPanel>
      {reporting ? (
        <ReportSheet
          key={`report-${servedReport}`}
          visible
          onClose={() => setReporting(false)}
          spots={spots}
          notices={notices}
          now={nowMs}
          onReport={actions.report}
          onSee={notice => {
            setReporting(false);
            setSelected(notice.id);
          }}
        />
      ) : null}
      <NoticeSheet
        notice={details}
        now={nowMs}
        onClose={() => setDetails(null)}
        onMap={openMap}
        onFlag={notice => actions.flag(notice.id)}
      />
      <InviteSheet invite={invite} onClose={() => setInvite(null)} />
      <HowItWorksSheet
        visible={explaining}
        onClose={() => setExplaining(false)}
        items={HOW_IT_WORKS}
      />
    </>
  );
}
