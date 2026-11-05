import React, { useEffect, useMemo, useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import styled from 'styled-components/native';

import {
  Button,
  IconTile,
  List,
  ListRow,
  Section,
  Tag,
  Text,
  snackbar,
} from '@components/ui';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import {
  isLive,
  type CampusNotice,
  type NoticeAnswer,
} from '@root/modules/campus-now/domain/campusNow';
import {
  askTarget,
  classSpots,
  nearReason,
  onCampusToday,
  roomClasses,
} from '@root/modules/campus-now/domain/nearby';
import {
  campusNowErrorMessage,
  colleagues,
  KIND_TEXT,
  nearText,
  noticeTitle,
  pointsText,
  shortPlaceText,
  sinceText,
} from '@root/modules/campus-now/presentation/campusNowText';
import {
  HOME_POLL_MS,
  useCampusActions,
  useCampusNotices,
  useCampusNowState,
} from '@root/modules/campus-now/presentation/useCampusNow';
import { isFeatureDisabled } from '@root/modules/delivery/domain/appStatus';
import { useRemoteStatus } from '@root/modules/delivery/presentation/DeliveryProvider';
import { CampusIntroCard } from './CampusIntroCard';
import { StillThereCard } from './StillThereCard';

const Summary = styled(Text)`
  margin-top: -${({ theme }) => theme.spacing.xs}px;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

/** Quantos avisos o Início mostra antes de "Ver todos". */
const HOME_LIMIT = 2;

type Props = { schedule: readonly AttendedClassesSchedule[]; now: Date };

/**
 * "Agora no campus" no Início, sempre à vista (quem nunca abriu o menu também
 * fica sabendo que existe). Com o aluno no campus pela grade: a pergunta
 * "ainda está lá?" de um aviso no caminho da aula, respondida ali mesmo, ou
 * os avisos confirmados de agora, os do caminho primeiro; sem aviso, uma
 * linha só ("Nada no seu caminho", com Avisar). Fora do campus ou sem
 * resposta do servidor, a linha diz para que serve, sem prometer nada. Na
 * primeira vez, uma apresentação curta toma o lugar da linha.
 */
export function CampusNowHome(props: Props) {
  const { campusNow } = useAppServices();
  const { status } = useRemoteStatus();
  // sem a sessão de aluno (simulador, app fora da loja) ou desligado pelo aviso remoto
  if (!campusNow.supported || isFeatureDisabled(status, 'campus')) return null;
  return <CampusSlot {...props} />;
}

function CampusSlot({ schedule, now }: Props) {
  const { campusNow } = useAppServices();
  const navigation = useNavigation();
  const focused = useIsFocused();
  // a grade nova vale também para o "ainda está lá?" do celular
  const classes = useMemo(() => roomClasses(schedule), [schedule]);
  useEffect(() => {
    void campusNow.rememberClasses(classes).catch(() => undefined);
  }, [campusNow, classes]);
  const nowMs = now.getTime();
  const onCampus = onCampusToday(schedule, now);
  const spots = useMemo(() => classSpots(schedule, now), [schedule, now]);
  const query = useCampusNotices({
    enabled: onCampus,
    poll: focused && onCampus,
    interval: HOME_POLL_MS,
  });
  const state = useCampusNowState();
  const actions = useCampusActions();
  const [busy, setBusy] = useState<NoticeAnswer | null>(null);

  const open = () => navigation.navigate('Agora no campus');
  const report = () => navigation.navigate('Agora no campus', { report: true });

  // a apresentação, até o aluno abrir a tela ou dispensar (só depois de ler
  // as escolhas da conta, para não piscar)
  const introducing =
    state.scope !== null && !state.visited && !state.introduced;
  const quiet = (line: 'calm' | 'about') =>
    introducing ? (
      <Section
        title="Agora no campus"
        action={<Tag tone="accent" label="Novo" />}
      >
        <CampusIntroCard
          onOpen={open}
          onDismiss={() => {
            void campusNow.dismissIntro().catch(() => undefined);
          }}
        />
      </Section>
    ) : (
      <Section title="Agora no campus">
        <List>
          {line === 'calm' ? (
            <ListRow
              leading={<IconTile icon="task_alt" tone="accent" />}
              title="Nada no seu caminho"
              subtitle="Viu algo? Avise em dois toques."
              trailing={
                <Button
                  variant="text"
                  size="sm"
                  icon="campaign"
                  label="Avisar"
                  onPress={report}
                />
              }
              onPress={open}
              accessibilityLabel="Agora no campus: nada no seu caminho. Ver os avisos"
            />
          ) : (
            <ListRow
              leading={<IconTile icon="campaign" tone="accent" />}
              title="Avisos sobre o campus"
              subtitle="Fila, elevador ou Wi-Fi: quem está lá avisa."
              chevron
              onPress={open}
              accessibilityLabel="Agora no campus: avisos sobre o campus. Ver"
            />
          )}
        </List>
      </Section>
    );

  // fora do campus pela grade, sem consultar nada
  if (!onCampus) return quiet('about');
  // sem resposta (sem internet, aluno ainda sem confirmação): não promete calma
  if (!query.data) return query.error ? quiet('about') : null;
  const notices = query.data.notices.filter(notice => isLive(notice, nowMs));
  const ask = askTarget(notices, spots, {
    skipped: state.skipped,
    now: nowMs,
    prefer: state.asked,
  });

  const answer = async (notice: CampusNotice, value: NoticeAnswer) => {
    setBusy(value);
    try {
      const result = await actions.answer(notice.id, value);
      const points = result.you.earned
        ? ` · ${pointsText(result.you.earned)}`
        : '';
      snackbar.success(
        value === 'confirm' ? `Confirmado${points}` : `Anotado${points}`,
        value === 'confirm'
          ? 'Quem vai passar por lá agradece.'
          : result.notice.state === 'active'
            ? 'Quando mais colegas disserem que acabou, o aviso sai do mapa.'
            : 'O aviso saiu do mapa.',
      );
    } catch (error) {
      snackbar.error(campusNowErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const action = (
    <Button
      variant="text"
      size="sm"
      label="Ver todos"
      icon="chevron_right"
      iconPosition="end"
      onPress={open}
    />
  );

  if (ask)
    return (
      <Section title="Agora no campus" action={action}>
        <StillThereCard
          notice={ask.notice}
          near={ask.near}
          now={nowMs}
          busy={busy}
          onAnswer={(notice, value) => {
            void answer(notice, value);
          }}
          onSkip={notice => {
            void actions.skip(notice.id).catch(() => undefined);
          }}
        />
      </Section>
    );

  // os que valem para todos (e os do aluno), os do caminho primeiro
  const shown = notices
    .filter(notice => notice.confirmed || notice.mine)
    .map(notice => ({ notice, near: nearReason(notice, spots) }))
    .sort(
      (a, b) =>
        Number(b.near !== null) - Number(a.near !== null) ||
        b.notice.confirmations - a.notice.confirmations ||
        b.notice.createdAt - a.notice.createdAt,
    );
  if (!shown.length) return quiet('calm');
  const helpers = query.data.helpersToday;
  const summary = `${shown.length} ${shown.length === 1 ? 'aviso agora' : 'avisos agora'}${helpers ? ` · ${colleagues(helpers)} ${helpers === 1 ? 'ajudou' : 'ajudaram'} hoje` : ''}`;

  return (
    <Section title="Agora no campus" action={action}>
      <Summary variant="meta" tone="muted">
        {summary}
      </Summary>
      <List>
        {shown.slice(0, HOME_LIMIT).map(({ notice, near }) => (
          <ListRow
            key={notice.id}
            leading={
              <IconTile icon={KIND_TEXT[notice.kind].icon} tone="accent" />
            }
            title={noticeTitle(notice)}
            subtitle={
              notice.mine
                ? `Seu aviso · ${shortPlaceText(notice.place)}`
                : near
                  ? nearText(near)
                  : `${shortPlaceText(notice.place)} · ${sinceText(notice.createdAt, nowMs)}`
            }
            chevron
            onPress={open}
          />
        ))}
      </List>
    </Section>
  );
}
