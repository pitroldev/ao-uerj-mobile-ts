import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import { Icon } from '../Icon';
import { Text } from '../Text';

export type TimelineEvent = {
  key: string;
  /** Início em minutos desde 00:00 (12:20 → 740). */
  start: number;
  /** Fim em minutos desde 00:00. */
  end: number;
  title: string;
  /** "12:20–14:10 · T1–T2 · Sala 6019 B". */
  meta?: string;
  /** Status no canto superior direito (StatusLabel "Tarde", "Agora", "Encerrada"). */
  status?: React.ReactNode;
  /** `past` esmaece; `live` destaca a borda. */
  state?: 'past' | 'live' | 'upcoming';
  onPress?: () => void;
  accessibilityLabel?: string;
};

export type DayTimelineProps = {
  /** Eventos do dia, ordenados por início. */
  events: TimelineEvent[];
  /** Linha de "agora" (só no dia de hoje). */
  now?: { minutes: number; label: string };
  /** Escala vertical. Padrão 0.8 (48dp por hora). */
  pxPerMinute?: number;
  /** Intervalo mínimo para mostrar "Livre · 1h50". Padrão 40 min. */
  freeGapMinutes?: number;
  /** Texto do intervalo livre. */
  freeLabel?: (minutes: number) => string;
  /** Rótulo da hora cheia. Padrão "8h". */
  hourLabel?: (hour: number) => string;
  /** Quando não há eventos. */
  emptyText?: string;
  style?: StyleProp<ViewStyle>;
};

/** Folga acima da primeira e abaixo da última hora. */
const PAD = 10;
/** Largura da coluna de horas + espaço até os blocos. */
const RAIL = 56;

/** "1h50", "45 min". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return `${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

const Empty = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-style: dashed;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
`;

const Grow = styled(Text)`
  flex: 1;
`;

const Canvas = styled.View<{ $height: number }>`
  position: relative;
  height: ${({ $height }) => $height}px;
`;

/** Linha de hora/agora: 16 de altura centrada no minuto. */
const Rule = styled.View<{ $y: number; $z?: number }>`
  position: absolute;
  left: 0px;
  right: 0px;
  top: ${({ $y }) => $y - 8}px;
  height: 16px;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  z-index: ${({ $z }) => $z ?? 0};
`;

const HourText = styled(Text)<{ $hidden?: boolean }>`
  width: 44px;
  opacity: ${({ $hidden }) => ($hidden ? 0 : 1)};
`;

const HourLine = styled.View<{ $now?: boolean }>`
  flex: 1;
  height: ${({ $now }) => ($now ? 1.5 : 1)}px;
  background-color: ${({ theme, $now }) =>
    $now ? theme.colors.accent : theme.colors.rule};
`;

const NowDot = styled.View`
  position: absolute;
  left: 48px;
  top: 3.5px;
  width: 9px;
  height: 9px;
  border-radius: 4.5px;
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.surface};
  background-color: ${({ theme }) => theme.colors.accent};
`;

const Free = styled.View<{ $top: number; $height: number; $justify: string }>`
  position: absolute;
  left: ${RAIL}px;
  right: 0px;
  top: ${({ $top }) => $top}px;
  height: ${({ $height }) => $height}px;
  align-items: center;
  justify-content: ${({ $justify }) => $justify};
  padding: 8px 0px;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-style: dashed;
  border-color: ${({ theme }) => theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.colors.surface};
  z-index: 1;
`;

const Event = styled.Pressable<{
  $top: number;
  $height: number;
  $past: boolean;
  $live: boolean;
}>`
  position: absolute;
  left: ${RAIL}px;
  right: 0px;
  top: ${({ $top }) => $top}px;
  height: ${({ $height }) => $height}px;
  padding: 9px 12px;
  gap: 2px;
  overflow: hidden;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme, $past, $live }) =>
    $past
      ? theme.colors.rule
      : $live
        ? theme.colors.accentLine
        : theme.colors.ruleStrong};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme, $past }) =>
    $past ? theme.colors.surface : theme.colors.surfaceMuted};
  z-index: 1;
`;

const EventTitle = styled(Text)<{ $room: boolean }>`
  line-height: 20px;
  padding-right: ${({ $room }) => ($room ? 84 : 0)}px;
`;

const EventStatus = styled.View`
  position: absolute;
  top: 11px;
  right: 12px;
`;

/**
 * Dia como régua de horas (".cal"): fios por hora, blocos com altura
 * proporcional à duração, intervalos livres e a linha de "agora".
 * Blocos muito curtos (menos de ~70 min) cortam a segunda linha; ajuste
 * `pxPerMinute` se precisar.
 */
export function DayTimeline({
  events,
  now,
  pxPerMinute = 0.8,
  freeGapMinutes = 40,
  freeLabel = m => `Livre · ${formatDuration(m)}`,
  hourLabel = h => `${h}h`,
  emptyText = 'Sem aulas neste dia.',
  style,
}: DayTimelineProps) {
  const theme = useTheme();
  const c = theme.colors;

  if (!events.length) {
    return (
      <Empty style={style}>
        <Icon
          name="event_available"
          size={theme.sizes.icon.xl}
          color={c.inkMuted}
        />
        <Grow tone="muted">{emptyText}</Grow>
      </Empty>
    );
  }

  let first = events[0].start;
  let last = events[events.length - 1].end;
  if (now) {
    first = Math.min(first, now.minutes);
    last = Math.max(last, now.minutes);
  }
  const lo = Math.floor(first / 60) * 60;
  const hi = Math.ceil(last / 60) * 60;
  const y = (m: number) => PAD + (m - lo) * pxPerMinute;
  const nowY = now ? y(now.minutes) : null;

  const hours: number[] = [];
  for (let h = lo; h <= hi; h += 60) hours.push(h);

  return (
    <Canvas $height={y(hi) + PAD} style={style}>
      {hours.map(h => (
        <Rule
          key={h}
          $y={y(h)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <HourText
            variant="caption"
            weight="regular"
            tone="muted"
            tabular
            align="right"
            maxFontSizeMultiplier={1.2}
            $hidden={nowY != null && Math.abs(y(h) - nowY) < 14}
          >
            {hourLabel(h / 60)}
          </HourText>
          <HourLine />
        </Rule>
      ))}

      {events.map((ev, i) => {
        const prev = events[i - 1];
        const gap = prev ? ev.start - prev.end : 0;
        let free: React.ReactNode = null;
        if (prev && gap >= freeGapMinutes) {
          const ft = y(prev.end) + 4;
          const fb = y(ev.start) - 4;
          const mid = (ft + fb) / 2;
          let justify = 'center';
          // afasta o rótulo da linha de "agora" quando ela cruza o intervalo
          if (
            nowY != null &&
            nowY > ft &&
            nowY < fb &&
            Math.abs(nowY - mid) < 16
          ) {
            justify = nowY > mid ? 'flex-start' : 'flex-end';
          }
          free = (
            <Free $top={ft} $height={fb - ft} $justify={justify}>
              <Text
                variant="caption"
                weight="regular"
                tone="muted"
                numberOfLines={1}
              >
                {freeLabel(gap)}
              </Text>
            </Free>
          );
        }
        const past = ev.state === 'past';
        return (
          <React.Fragment key={ev.key}>
            {free}
            <Event
              $top={y(ev.start) + 1}
              $height={(ev.end - ev.start) * pxPerMinute - 2}
              $past={past}
              $live={ev.state === 'live'}
              onPress={ev.onPress}
              disabled={!ev.onPress}
              accessibilityRole={ev.onPress ? 'button' : undefined}
              accessibilityLabel={
                ev.accessibilityLabel ??
                [ev.title, ev.meta].filter(Boolean).join(', ')
              }
              style={({ pressed }) =>
                pressed && !past && { borderColor: c.fieldBorder }
              }
            >
              <EventTitle
                variant="body"
                weight={past ? 'medium' : 'semibold'}
                tone={past ? 'muted' : 'ink'}
                numberOfLines={1}
                $room={Boolean(ev.status)}
              >
                {ev.title}
              </EventTitle>
              {ev.meta ? (
                <Text variant="meta" tone="muted" numberOfLines={1}>
                  {ev.meta}
                </Text>
              ) : null}
              {ev.status ? <EventStatus>{ev.status}</EventStatus> : null}
            </Event>
          </React.Fragment>
        );
      })}

      {now && nowY != null ? (
        <Rule
          $y={nowY}
          $z={3}
          accessible
          accessibilityLabel={`Agora, ${now.label}`}
          pointerEvents="none"
        >
          <HourText
            variant="caption"
            weight="semibold"
            tone="accent"
            tabular
            align="right"
            maxFontSizeMultiplier={1.2}
          >
            {now.label}
          </HourText>
          <HourLine $now />
          <NowDot />
        </Rule>
      ) : null}
    </Canvas>
  );
}

export default DayTimeline;
