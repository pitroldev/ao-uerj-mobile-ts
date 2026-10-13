import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Button } from '../Button/Button';
import { PORTAL_BLOCKED_TEXT } from '../Feedback/BlockedState';
import { Spinner } from '../Feedback/Spinner';
import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';

export type NoticeTone = 'info' | 'neutral' | 'warn' | 'bad' | 'good';

/**
 * Situações padrão de dados do portal (mesmos ícones e tons em todas as
 * telas):
 * - `updating`: info + "sync" girando
 * - `offline`: neutro + "cloud_off" (dados salvos)
 * - `refreshFailed`: atenção + "sync_problem"
 * - `blocked`: crítico + "lock" (portal bloqueado); sem `text` nem
 *   `children`, usa o texto padrão `PORTAL_BLOCKED_TEXT`
 */
export type NoticeKind = 'updating' | 'offline' | 'refreshFailed' | 'blocked';

const KINDS: Record<NoticeKind, { tone: NoticeTone; icon: IconName }> = {
  updating: { tone: 'info', icon: 'sync' },
  offline: { tone: 'neutral', icon: 'cloud_off' },
  refreshFailed: { tone: 'warn', icon: 'sync_problem' },
  blocked: { tone: 'bad', icon: 'lock' },
};

const DEFAULT_ICON: Record<NoticeTone, IconName> = {
  info: 'info',
  neutral: 'info',
  warn: 'warning',
  bad: 'error',
  good: 'check_circle',
};

export type NoticeProps = {
  /** Texto do aviso (13/18). Também aceita `children`. */
  text?: string;
  children?: React.ReactNode;
  kind?: NoticeKind;
  tone?: NoticeTone;
  icon?: IconName;
  /** Cor do ícone (ex.: acento no aviso neutro do Sobre). */
  iconColor?: string;
  /** Gira o ícone (atualizando). */
  spin?: boolean;
  /** Ação em texto abaixo da mensagem ("Tentar novamente", "Configurar créditos"). */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /** Chamado ao tocar em "Tentar novamente" (atalho para `action`). */
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const Box = styled.View<{ $bg: string; $border: string }>`
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ $border }) => $border};
  border-radius: ${({ theme }) => theme.radii.lg}px;
  border-top-right-radius: 0px;
  background-color: ${({ $bg }) => $bg};
`;

const Glyph = styled.View`
  margin-top: -1px;
`;

const Body = styled.View`
  flex: 1;
  min-width: 0px;
`;

/** ".notice-act": alvo de 48dp sem empurrar o aviso. */
const ACTION_STYLE = {
  alignSelf: 'flex-start',
  marginTop: -6,
  marginBottom: -12,
  marginLeft: -8,
} as const;

/**
 * Aviso em faixa (".notice"): ícone + texto + ação opcional, fundo pastel do
 * tom e canto cortado. Sem conexão, falha ao atualizar, portal bloqueado,
 * créditos não configurados. Não tem margem própria: deixe 20 abaixo.
 */
export function Notice({
  text,
  children,
  kind,
  tone: toneProp,
  icon: iconProp,
  iconColor,
  spin,
  action,
  onRetry,
  style,
  testID,
}: NoticeProps) {
  const theme = useTheme();
  const preset = kind ? KINDS[kind] : undefined;
  const tone = toneProp ?? preset?.tone ?? 'info';
  const icon = iconProp ?? preset?.icon ?? DEFAULT_ICON[tone];
  const spinning = spin ?? kind === 'updating';
  const neutral = tone === 'neutral';
  const t = theme.status[tone];
  const fg = iconColor ?? (neutral ? theme.colors.inkMuted : t.ink);
  const shownText =
    text ??
    (kind === 'blocked' && children == null ? PORTAL_BLOCKED_TEXT : null);
  const act =
    action ??
    (onRetry ? { label: 'Tentar novamente', onPress: onRetry } : undefined);
  // no escuro a ação dos avisos quentes segue o tom; sublinhada, continua
  // lida como link sem o azul
  const actionColor =
    tone === 'warn'
      ? theme.colors.noticeWarnAction
      : tone === 'bad'
        ? theme.colors.noticeBadAction
        : theme.colors.accent;
  const tinted = actionColor !== theme.colors.accent;

  return (
    <Box
      testID={testID}
      $bg={neutral ? theme.colors.surfaceMuted : t.wash}
      $border={neutral ? theme.colors.rule : t.washLine}
      style={style}
    >
      <Glyph>
        {spinning ? (
          <Spinner size={theme.sizes.icon.lg} color={fg} />
        ) : (
          <Icon name={icon} size={theme.sizes.icon.lg} color={fg} />
        )}
      </Glyph>
      <Body>
        {shownText != null ? (
          <Text
            variant="meta"
            accessibilityLiveRegion="polite"
            accessibilityRole={
              tone === 'bad' || tone === 'warn' ? 'alert' : undefined
            }
          >
            {shownText}
          </Text>
        ) : null}
        {children}
        {act ? (
          <Button
            variant="text"
            size="xs"
            label={act.label}
            accessibilityLabel={act.accessibilityLabel}
            onPress={act.onPress}
            color={tinted ? actionColor : undefined}
            underline={tinted}
            style={ACTION_STYLE}
          />
        ) : null}
      </Body>
    </Box>
  );
}
