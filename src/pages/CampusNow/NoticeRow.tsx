import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import {
  Button,
  FilterChip,
  Icon,
  IconButton,
  IconTile,
  ListRow,
  Tag,
  Text,
} from '@components/ui';
import type {
  CampusNotice,
  NoticeAnswer,
} from '@root/modules/campus-now/domain/campusNow';
import type { NearReason } from '@root/modules/campus-now/domain/nearby';
import {
  KIND_TEXT,
  nearText,
  noticeTitle,
  outcomeText,
  placeText,
  stateText,
} from '@root/modules/campus-now/presentation/campusNowText';

/** A linha inteira, com os botões embaixo e o fio no fim. */
const Root = styled.View<{ $highlighted: boolean }>`
  background-color: ${({ theme, $highlighted }) =>
    $highlighted ? theme.colors.accentSoft : 'transparent'};
`;

const Near = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.xs + 2}px;
  margin-top: ${({ theme }) => theme.spacing.xxs}px;
`;

const NearText = styled(Text)`
  flex: 1;
`;

/**
 * Os botões ocupam a largura da linha (a partir do ícone): os três chips
 * cabem lado a lado mesmo com o "Mais" à direita da linha de cima.
 */
const Actions = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm}px;
  margin-top: -${({ theme }) => theme.spacing.xs}px;
  padding: 0px ${({ theme }) => theme.layout.gutter}px
    ${({ theme }) => theme.spacing.md}px;
`;

/** O botão de texto do próprio aviso, alinhado ao começo da faixa. */
const Own = styled.View`
  margin-left: -${({ theme }) => theme.spacing.md}px;
`;

const Badge = styled.View`
  margin-top: ${({ theme }) => theme.spacing.xs}px;
`;

const Rule = styled.View`
  height: ${({ theme }) => theme.borders.hairline}px;
  margin-left: ${({ theme }) => theme.layout.gutter}px;
  background-color: ${({ theme }) => theme.colors.rule};
`;

/** O que está em andamento numa linha (os botões esperam). */
export type RowBusy = NoticeAnswer | 'thanks' | null;

type Props = {
  notice: CampusNotice;
  now: number;
  near: NearReason | null;
  highlighted?: boolean;
  busy?: RowBusy;
  /** Só a leitura (os avisos de hoje do aluno, que já podem ter acabado). */
  readOnly?: boolean;
  /** O fio de baixo; o `List` tira o do último item. */
  divider?: boolean;
  onAnswer?: (notice: CampusNotice, answer: NoticeAnswer) => void;
  onThank?: (notice: CampusNotice) => void;
  onMore?: (notice: CampusNotice) => void;
};

/**
 * Um aviso na lista: o que é, onde, por que é do caminho do aluno (pela
 * grade), quantos confirmaram e há quanto tempo. Os de outros alunos têm
 * "Continua", "Acabou" e "Valeu"; o do aluno, "Já resolveu".
 */
export function NoticeRow({
  notice,
  now,
  near,
  highlighted = false,
  busy = null,
  readOnly = false,
  divider = true,
  onAnswer,
  onThank,
  onMore,
}: Props) {
  const theme = useTheme();
  const title = noticeTitle(notice);
  const place = placeText(notice.place);
  // confirmado (e o do aluno) no azul do app; o novo, apagado até alguém confirmar
  const tone = notice.mine || notice.confirmed ? 'accent' : 'muted';
  const status = readOnly ? outcomeText(notice, now) : stateText(notice, now);
  const waiting = busy !== null;

  const actions = readOnly ? null : notice.mine ? (
    <Actions>
      <Own>
        <Button
          variant="text"
          size="sm"
          icon="task_alt"
          label="Já resolveu"
          loading={busy === 'end'}
          loadingLabel="Encerrando…"
          disabled={waiting}
          onPress={() => onAnswer?.(notice, 'end')}
          accessibilityHint="Encerra o seu aviso para todo mundo"
        />
      </Own>
    </Actions>
  ) : (
    <Actions>
      <FilterChip
        icon="thumb_up"
        label="Continua"
        selected={notice.answer === 'confirm'}
        disabled={waiting || notice.answer !== null}
        onPress={() => onAnswer?.(notice, 'confirm')}
        accessibilityLabel={`Continua: ${title}`}
      />
      <FilterChip
        icon="task_alt"
        label="Acabou"
        selected={notice.answer === 'end'}
        disabled={waiting || notice.answer === 'end'}
        onPress={() => onAnswer?.(notice, 'end')}
        accessibilityLabel={`Acabou: ${title}`}
      />
      <FilterChip
        icon="sentiment_satisfied"
        label="Valeu"
        selected={notice.thanked}
        disabled={waiting || notice.thanked}
        onPress={() => onThank?.(notice)}
        accessibilityLabel={`Valeu para quem avisou: ${title}`}
      />
    </Actions>
  );

  return (
    <Root $highlighted={highlighted}>
      <ListRow
        leading={<IconTile icon={KIND_TEXT[notice.kind].icon} tone={tone} />}
        leadingAlign="start"
        title={title}
        subtitle={place}
        meta={[
          near && !readOnly ? (
            <Near key="near">
              <Icon
                name="near_me"
                size={theme.sizes.icon.sm}
                color={theme.colors.accent}
              />
              <NearText variant="meta" tone="accent">
                {nearText(near)}
              </NearText>
            </Near>
          ) : null,
          <Text key="state" variant="meta" tone="muted" tabular>
            {status}
          </Text>,
        ]}
        divider={false}
        trailing={
          onMore && !readOnly ? (
            <IconButton
              icon="more_vert"
              accessibilityLabel={`Mais sobre o aviso: ${title}`}
              onPress={() => onMore(notice)}
            />
          ) : undefined
        }
      >
        {notice.level !== null ? (
          <Badge>
            <Tag
              tone="info"
              icon="verified"
              label={`Quem avisou: nível ${notice.level}`}
            />
          </Badge>
        ) : null}
      </ListRow>
      {actions}
      {divider ? <Rule /> : null}
    </Root>
  );
}
