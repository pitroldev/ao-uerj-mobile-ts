import React, { useState } from 'react';
import { Share } from 'react-native';
import styled from 'styled-components/native';

import {
  Button,
  ErrorState,
  IconTile,
  List,
  ListRow,
  Notice,
  Section,
  SegmentedControl,
  SkeletonList,
  Text,
  snackbar,
} from '@components/ui';
import { ScreenPanel } from '@templates/ScreenPanel';
import { QueryNotice } from '@root/modules/academics/presentation/QueryNotice';
import {
  monthOf,
  previousMonth,
} from '@root/modules/campus-now/domain/campusNow';
import {
  campusNowErrorMessage,
  communityShareText,
  durationText,
  KIND_TEXT,
  monthName,
  problemText,
  problemTitle,
} from '@root/modules/campus-now/presentation/campusNowText';
import { useCampusCommunity } from '@root/modules/campus-now/presentation/useCampusNow';
import { Impact } from './Impact';

const Lead = styled(Text)`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
  margin-bottom: ${({ theme }) => theme.spacing.sm}px;
`;

const Gap = styled.View`
  height: ${({ theme }) => theme.spacing.md}px;
`;

const Side = styled.View`
  align-items: flex-end;
`;

const Footer = styled.View`
  margin-top: ${({ theme }) => theme.layout.sectionGap}px;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

/**
 * O campus somado, sem ninguém: a semana (de segunda até agora) e o mês,
 * com os problemas que mais se repetem (só avisos confirmados), para o CA e
 * o DCE levarem números à administração. "Compartilhar" manda o resumo em
 * texto, pronto para o grupo.
 */
export function CommunityView({ now }: { now: number }) {
  const current = monthOf(new Date(now));
  const [month, setMonth] = useState(current);
  const query = useCampusCommunity(month);
  const data = query.data;
  const isCurrent = month === current;

  const share = async () => {
    if (!data) return;
    try {
      await Share.share({
        message: communityShareText(data, { current: isCurrent }),
      });
    } catch {
      snackbar.error('Não foi possível abrir o compartilhamento.');
    }
  };

  let content: React.ReactNode;
  if (query.isLoading && !data)
    content = (
      <SkeletonList count={4} accessibilityLabel="Carregando o resumo…" />
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
    const { week, month: summary } = data;
    content = (
      <>
        <Text variant="titleM" accessibilityRole="header">
          Esta semana no campus
        </Text>
        <Lead variant="meta" tone="muted">
          De segunda até agora, somando todo mundo. Ninguém aparece com nome.
        </Lead>
        <Impact
          items={[
            {
              value: week.notices.toLocaleString('pt-BR'),
              label: week.notices === 1 ? 'aviso' : 'avisos',
            },
            {
              value: week.answers.toLocaleString('pt-BR'),
              label: 'respostas de "continua" e "acabou"',
            },
            {
              value: week.views.toLocaleString('pt-BR'),
              label: 'vezes que alguém viu um aviso antes de sair',
            },
            ...(week.minutesToEnd !== null
              ? [
                  {
                    value: durationText(week.minutesToEnd),
                    label: 'em média, do aviso ao "acabou"',
                  },
                ]
              : []),
          ]}
        />

        <Section
          title={`${monthName(summary.month)}${isCurrent ? ', até hoje' : ''}`}
          description={`${summary.weekdays} ${summary.weekdays === 1 ? 'dia útil' : 'dias úteis'} · ${summary.notices.toLocaleString('pt-BR')} ${summary.notices === 1 ? 'aviso confirmado' : 'avisos confirmados'}.`}
        >
          <SegmentedControl
            accessibilityLabel="Mês do resumo"
            options={[
              { value: current, label: monthName(current) },
              {
                value: previousMonth(current),
                label: monthName(previousMonth(current)),
              },
            ]}
            value={month}
            onChange={setMonth}
          />
          <Gap />
          {summary.problems.length ? (
            <List>
              {summary.problems.map(problem => (
                <ListRow
                  key={`${problem.kind}-${problem.status}-${problem.block ?? problem.gate ?? ''}`}
                  leading={
                    <IconTile
                      icon={KIND_TEXT[problem.kind].icon}
                      tone="neutral"
                    />
                  }
                  leadingAlign="start"
                  title={problemTitle(problem)}
                  subtitle={problemText(problem)}
                  trailing={
                    <Side>
                      <Text variant="titleM" tabular>
                        {String(problem.days)}
                      </Text>
                      <Text variant="caption" tone="muted" tabular>
                        {`de ${summary.weekdays} dias`}
                      </Text>
                    </Side>
                  }
                  accessibilityLabel={`${problemTitle(problem)}: em ${problem.days} de ${summary.weekdays} dias úteis. ${problemText(problem)}`}
                />
              ))}
            </List>
          ) : (
            <Text tone="muted">
              {isCurrent
                ? 'Nenhum problema confirmado neste mês ainda. Bom sinal.'
                : 'Nenhum problema confirmado nesse mês.'}
            </Text>
          )}
        </Section>

        <Footer>
          <Notice
            tone="info"
            icon="campaign"
            text="O resumo é de todos. Serve para o CA e o DCE levarem números, e não impressões, à administração do campus."
          />
          <Button
            variant="outline"
            icon="share"
            label="Compartilhar o resumo"
            disabled={!summary.problems.length}
            onPress={() => {
              void share();
            }}
          />
        </Footer>
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
