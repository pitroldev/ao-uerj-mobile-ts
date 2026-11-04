import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import {
  Card,
  ErrorState,
  FootNote,
  Icon,
  List,
  ProgressBar,
  Section,
  SkeletonList,
  Text,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import {
  badgesOf,
  levelProgress,
  pointsToNext,
} from '@root/modules/campus-now/domain/progress';
import {
  BADGE_TEXT,
  campusNowErrorMessage,
  levelName,
  levelText,
  POINT_RULES,
} from '@root/modules/campus-now/presentation/campusNowText';
import { useCampusYou } from '@root/modules/campus-now/presentation/useCampusNow';
import { Impact } from './Impact';
import { NoticeRow } from './NoticeRow';

const Top = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md + 2}px;
`;

const Badge = styled.View`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  border-top-right-radius: ${({ theme }) => theme.radii.xs}px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.fill};
`;

const Grow = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xxs}px;
`;

const Meter = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md + 2}px;
`;

const Ways = styled.View`
  margin-top: ${({ theme }) => theme.spacing.md}px;
  gap: ${({ theme }) => theme.spacing.xs}px;
`;

/** Uma regra de pontos: o que fazer e quanto vale, numa linha curta. */
const Way = styled.View`
  flex-direction: row;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Heading = styled(Text)`
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
`;

const Grid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm + 2}px;
`;

const Achievement = styled.View<{ $done: boolean }>`
  flex-basis: 45%;
  flex-grow: 1;
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm + 2}px;
  padding: ${({ theme }) => theme.spacing.md}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-style: ${({ $done }) => ($done ? 'solid' : 'dashed')};
  border-color: ${({ theme, $done }) =>
    $done ? theme.colors.rule : theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: ${({ theme }) => theme.radii.xs}px;
`;

const Notes = styled.View`
  margin-top: ${({ theme }) => theme.layout.sectionGap}px;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

/**
 * "Você ajudou": o nível, os pontos até o próximo, como ganhar pontos, a
 * semana do aluno (quantas vezes alguém viu um aviso dele antes de sair),
 * os avisos de hoje e as conquistas. Os pontos valem na conta, sem placar.
 */
export function YouView({ now }: { now: number }) {
  const theme = useTheme();
  const query = useCampusYou();
  const data = query.data;

  let content: React.ReactNode;
  if (query.isLoading && !data)
    content = (
      <SkeletonList count={4} accessibilityLabel="Carregando seus pontos…" />
    );
  else if (!data)
    content = (
      <ErrorState
        message={campusNowErrorMessage(query.error)}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  else {
    const { you, week, today } = data;
    const left = pointsToNext(you);
    const progress = levelProgress(you);
    const badges = badgesOf(data);
    content = (
      <>
        <Heading variant="titleL" accessibilityRole="header">
          Você ajudou
        </Heading>
        <Card>
          <Top>
            <Badge>
              <Icon
                name="verified"
                size={theme.sizes.icon.empty}
                color={theme.colors.onFill}
              />
            </Badge>
            <Grow>
              <Text variant="titleS" accessibilityRole="header">
                {levelText(you.level)}
              </Text>
              <Text variant="meta" tone="muted" tabular>
                {left === null
                  ? `${you.points.toLocaleString('pt-BR')} pontos · o nível mais alto`
                  : `${you.points.toLocaleString('pt-BR')} pontos · faltam ${left} para ${levelName(you.level + 1)}`}
              </Text>
            </Grow>
          </Top>
          <Meter>
            <ProgressBar
              value={progress}
              accessibilityLabel={
                left === null
                  ? 'Nível mais alto'
                  : `${Math.round(progress * 100)}% do caminho até o nível ${you.level + 1}`
              }
            />
          </Meter>
          <Ways accessibilityLabel="Como ganhar pontos">
            {POINT_RULES.map(rule => (
              <Way
                key={rule.label}
                accessible
                accessibilityLabel={`${rule.label}: mais ${rule.points}`}
              >
                <Text variant="meta" tone="muted">
                  {rule.label}
                </Text>
                <Text variant="meta" weight="semibold" tabular>
                  {`+${rule.points}`}
                </Text>
              </Way>
            ))}
          </Ways>
        </Card>

        <Section title="Esta semana">
          <Impact
            items={[
              {
                value: week.notices.toLocaleString('pt-BR'),
                label: week.notices === 1 ? 'aviso seu' : 'avisos seus',
              },
              {
                value: week.views.toLocaleString('pt-BR'),
                label: 'vezes que alguém viu um aviso seu antes de sair',
              },
              {
                value: week.thanks.toLocaleString('pt-BR'),
                label:
                  week.thanks === 1 ? 'valeu recebido' : 'valeus recebidos',
              },
            ]}
          />
        </Section>

        <Section title="Seus avisos de hoje">
          {today.length ? (
            <List>
              {today.map(notice => (
                <NoticeRow
                  key={notice.id}
                  notice={notice}
                  now={now}
                  near={null}
                  readOnly
                />
              ))}
            </List>
          ) : (
            <Text tone="muted">
              Nenhum aviso seu hoje. Viu fila, falta de luz ou Wi-Fi fora? Avise
              em dois toques.
            </Text>
          )}
        </Section>

        <Section title="Conquistas">
          <Grid>
            {badges.map(badge => {
              const text = BADGE_TEXT[badge.id];
              return (
                <Achievement
                  key={badge.id}
                  $done={badge.done}
                  accessible
                  accessibilityLabel={`${text.name}: ${text.text}. ${badge.done ? 'Conquistada' : `${badge.progress} de ${badge.goal}`}`}
                >
                  <Icon
                    name={text.icon}
                    size={theme.sizes.icon.xl}
                    color={
                      badge.done ? theme.colors.accent : theme.colors.inkMuted
                    }
                  />
                  <Grow>
                    <Text
                      variant="meta"
                      weight="semibold"
                      tone={badge.done ? 'ink' : 'muted'}
                    >
                      {text.name}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {badge.done
                        ? text.text
                        : `${text.text} · ${badge.progress} de ${badge.goal}`}
                    </Text>
                  </Grow>
                </Achievement>
              );
            })}
          </Grid>
        </Section>

        <Notes>
          <FootNote
            icon="lock"
            text="Os pontos e o nível valem na sua conta, em qualquer aparelho. Não há placar entre alunos: ninguém vê os pontos de ninguém."
          />
          <FootNote
            icon="flag"
            text={
              'Aviso falso custa caro: com três "Não é verdade", ele sai do ar e quem avisou perde 15 pontos.'
            }
          />
          <FootNote
            icon="schedule"
            text="Avisar dá pontos nos 5 primeiros avisos do dia; responder, nas 10 primeiras respostas."
          />
        </Notes>
      </>
    );
  }

  return (
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
        error={data ? query.error : null}
        hasData={data !== undefined}
        dataUpdatedAt={query.dataUpdatedAt}
        retry={query.refetch}
      />
      {content}
    </ScreenPanel>
  );
}
