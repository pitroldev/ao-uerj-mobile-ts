import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import { Button, Icon, Text } from '@components/ui';
import type {
  CampusNotice,
  NoticeAnswer,
} from '@root/modules/campus-now/domain/campusNow';
import type { NearReason } from '@root/modules/campus-now/domain/nearby';
import {
  askText,
  colleagues,
  nearText,
  sinceText,
} from '@root/modules/campus-now/presentation/campusNowText';

const Box = styled.View`
  padding: ${({ theme }) => theme.spacing.lg}px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.accentLine};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.accentSoft};
`;

const Question = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

const Body = styled.View`
  flex: 1;
  gap: ${({ theme }) => theme.spacing.xxs}px;
`;

const Answers = styled.View`
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.sm}px;
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

const Half = styled.View`
  flex: 1;
`;

const Skip = styled.View`
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing.xxs}px;
  margin-bottom: -${({ theme }) => theme.spacing.sm}px;
`;

/** "8 colegas avisaram, há 29 min." ou "Aviso novo, há 4 min." */
function whoText(notice: CampusNotice, now: number): string {
  const since = sinceText(notice.createdAt, now);
  if (!notice.confirmed)
    return `Aviso novo, ${since}: ninguém confirmou ainda.`;
  if (notice.confirmations === 0) return `Avisado ${since}.`;
  return `${colleagues(notice.confirmations + 1)} avisaram, ${since}.`;
}

/**
 * A pergunta do momento: um aviso no caminho da aula de agora ou da próxima
 * (pela grade, sem GPS), com "Continua" e "Acabou" ali mesmo. "Não vou
 * passar por lá" dispensa o aviso até o fim do dia.
 */
export function StillThereCard({
  notice,
  near,
  now,
  busy,
  onAnswer,
  onSkip,
}: {
  notice: CampusNotice;
  near: NearReason;
  now: number;
  busy: NoticeAnswer | null;
  onAnswer: (notice: CampusNotice, answer: NoticeAnswer) => void;
  onSkip: (notice: CampusNotice) => void;
}) {
  const theme = useTheme();
  const question = askText(notice);
  return (
    <Box accessibilityRole="summary">
      <Question>
        <Icon
          name="help"
          size={theme.sizes.icon.xl}
          color={theme.colors.accent}
        />
        <Body>
          <Text variant="body" weight="semibold" accessibilityRole="header">
            {question}
          </Text>
          <Text variant="meta" tone="muted">
            {`${nearText(near)} ${whoText(notice, now)}`}
          </Text>
        </Body>
      </Question>
      <Answers>
        <Half>
          <Button
            variant="outline"
            size="sm"
            icon="thumb_up"
            label="Continua"
            block
            loading={busy === 'confirm'}
            loadingLabel="Enviando…"
            disabled={busy !== null}
            onPress={() => onAnswer(notice, 'confirm')}
            accessibilityLabel={`Continua: ${question}`}
          />
        </Half>
        <Half>
          <Button
            variant="outline"
            size="sm"
            icon="task_alt"
            label="Acabou"
            block
            loading={busy === 'end'}
            loadingLabel="Enviando…"
            disabled={busy !== null}
            onPress={() => onAnswer(notice, 'end')}
            accessibilityLabel={`Acabou: ${question}`}
          />
        </Half>
      </Answers>
      <Skip>
        <Button
          variant="text"
          size="sm"
          label="Não vou passar por lá"
          disabled={busy !== null}
          onPress={() => onSkip(notice)}
        />
      </Skip>
    </Box>
  );
}
