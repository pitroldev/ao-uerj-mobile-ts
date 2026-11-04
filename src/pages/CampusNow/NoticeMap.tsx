import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import styled, { useTheme } from 'styled-components/native';

import { Icon, Text } from '@components/ui';
import { useAppServices } from '@root/app/providers/AppServicesProvider';
import {
  fitCamera,
  orientPoint,
} from '@root/modules/campus-map/domain/geometry';
import type { CampusAtlas, Point } from '@root/modules/campus-map/domain/types';
import type {
  CampusNotice,
  NoticePlace,
} from '@root/modules/campus-now/domain/campusNow';
import {
  KIND_TEXT,
  noticeTitle,
  shortPlaceText,
} from '@root/modules/campus-now/presentation/campusNowText';

/** Altura do desenho: o Pavilhão inteiro, o bandejão e os portões perto. */
const HEIGHT = 232;
const PIN = 28;
const LABEL_HEIGHT = 22;
/** Os lugares que enquadram o mapa mesmo sem aviso: o Pavilhão inteiro. */
const FRAME_PLACES = ['bloco-a', 'bloco-f', 'bloco-e', 'ru'];

const Frame = styled.View`
  height: ${HEIGHT}px;
  overflow: hidden;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.campusMap.ground};
`;

const Legend = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  column-gap: ${({ theme }) => theme.spacing.lg}px;
  row-gap: ${({ theme }) => theme.spacing.xs}px;
  margin-top: ${({ theme }) => theme.spacing.sm}px;
`;

const LegendItem = styled.View`
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs + 2}px;
`;

const Swatch = styled.View<{ $color: string; $fill: string; $dashed: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 6px;
  border-width: 2px;
  border-style: ${({ $dashed }) => ($dashed ? 'dashed' : 'solid')};
  border-color: ${({ $color }) => $color};
  background-color: ${({ $fill }) => $fill};
`;

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width + 2 &&
  a.x + a.width + 2 > b.x &&
  a.y < b.y + b.height + 2 &&
  a.y + a.height + 2 > b.y;

/** O ponto do atlas de cada lugar: o bloco, o bandejão ou o portão. */
function placePoint(atlas: CampusAtlas, place: NoticePlace): Point | null {
  const id =
    place.type === 'elevators'
      ? 'bloco-c'
      : place.type === 'ru'
        ? 'ru'
        : place.type === 'gate'
          ? place.gate
          : `bloco-${place.block.toLowerCase()}`;
  return atlas.places.find(item => item.id === id)?.point ?? null;
}

type Tone = 'confirmed' | 'new' | 'mine';
const toneOf = (notice: CampusNotice): Tone =>
  notice.mine ? 'mine' : notice.confirmed ? 'confirmed' : 'new';

/**
 * Os avisos de agora no desenho do Mapa do app (o mesmo atlas, com o norte
 * para cima), sem gestos: um pino por lugar, com o ícone do tipo e um
 * rótulo curto. Confirmado em azul claro, novo tracejado em cinza, o do
 * aluno em azul cheio.
 * Tocar num pino escolhe o aviso na lista.
 */
export function NoticeMap({
  notices,
  selected,
  onSelect,
}: {
  notices: readonly CampusNotice[];
  selected: string | null;
  onSelect: (notice: CampusNotice) => void;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const palette = theme.campusMap;
  const { campusMap } = useAppServices();
  const atlas = campusMap.atlas;
  const [width, setWidth] = useState(0);

  // um pino por lugar: no mesmo lugar, o aviso do aluno, depois o confirmado
  const pins = useMemo(() => {
    const byPoint = new Map<
      string,
      { notice: CampusNotice; point: Point; count: number }
    >();
    const rank = (notice: CampusNotice) =>
      (notice.mine ? 4 : 0) +
      (notice.confirmed ? 2 : 0) +
      (notice.id === selected ? 8 : 0);
    for (const notice of notices) {
      const point = placePoint(atlas, notice.place);
      if (!point) continue;
      const key = point.join(',');
      const current = byPoint.get(key);
      if (!current) byPoint.set(key, { notice, point, count: 1 });
      else
        byPoint.set(key, {
          notice: rank(notice) > rank(current.notice) ? notice : current.notice,
          point,
          count: current.count + 1,
        });
    }
    return [...byPoint.values()];
  }, [atlas, notices, selected]);

  const camera = useMemo(() => {
    if (!width) return null;
    const frame = FRAME_PLACES.map(
      id => atlas.places.find(item => item.id === id)?.point,
    ).filter((point): point is Point => Boolean(point));
    return fitCamera(
      [...frame, ...pins.map(pin => pin.point)],
      width,
      HEIGHT,
      30,
      atlas.north,
    );
  }, [atlas, pins, width]);

  const legend = (
    <Legend>
      <LegendItem>
        <Swatch $color={c.accent} $fill={c.accentSoft} $dashed={false} />
        <Text variant="caption" tone="muted">
          Confirmado
        </Text>
      </LegendItem>
      <LegendItem>
        <Swatch $color={c.inkMuted} $fill={c.surface} $dashed />
        <Text variant="caption" tone="muted">
          Novo
        </Text>
      </LegendItem>
      <LegendItem>
        <Swatch $color={c.fill} $fill={c.fill} $dashed={false} />
        <Text variant="caption" tone="muted">
          Seu aviso
        </Text>
      </LegendItem>
    </Legend>
  );

  const label = notices.length
    ? `Mapa do campus com ${notices.length} ${notices.length === 1 ? 'aviso' : 'avisos'}`
    : 'Mapa do campus, sem avisos agora';

  if (!camera)
    return (
      <View>
        <Frame
          onLayout={event =>
            setWidth(Math.round(event.nativeEvent.layout.width))
          }
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
        />
        {legend}
      </View>
    );

  const unit = camera.width / width;
  const screen = (point: Point): Point => {
    const [x, y] = orientPoint(point, atlas.north);
    return [(x - camera.x) / unit, (y - camera.y) / unit];
  };
  const line = (points: readonly Point[]) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${screen(p).join(' ')}`).join(' ');
  const polygon = (rings: readonly (readonly Point[])[]) =>
    rings.map(ring => `${line(ring)}Z`).join(' ');

  // os rótulos ao lado do pino, sem cobrir outro rótulo nem o norte
  // os pinos primeiro: um rótulo nunca passa por baixo de outro pino
  const half = PIN / 2;
  const spots = pins.map(pin => {
    const [x, y] = screen(pin.point);
    return {
      pin,
      x,
      y,
      box: { x: x - half, y: y - half, width: PIN, height: PIN },
    };
  });
  const placed: Box[] = [
    { x: width - 30, y: 4, width: 26, height: 36 },
    ...spots.map(spot => spot.box),
  ];
  const marks = spots.map(({ pin, x, y }) => {
    const text =
      pin.count > 1
        ? `${KIND_TEXT[pin.notice.kind].label} +${pin.count - 1}`
        : KIND_TEXT[pin.notice.kind].label;
    const labelWidth = text.length * 7.6 + 18;
    const candidates = [
      { x: x + half + 4, y: y - LABEL_HEIGHT / 2 },
      { x: x - half - 4 - labelWidth, y: y - LABEL_HEIGHT / 2 },
      { x: x - labelWidth / 2, y: y + half + 2 },
      { x: x - labelWidth / 2, y: y - half - 2 - LABEL_HEIGHT },
    ].map(spot => ({
      x: Math.max(4, Math.min(width - labelWidth - 4, spot.x)),
      y: Math.max(4, Math.min(HEIGHT - LABEL_HEIGHT - 4, spot.y)),
      width: labelWidth,
      height: LABEL_HEIGHT,
    }));
    const box =
      candidates.find(
        candidate => !placed.some(other => overlaps(candidate, other)),
      ) ?? null;
    if (box) placed.push(box);
    return { pin, x, y, box, text };
  });

  const svgText = {
    fontFamily: theme.fonts.semibold,
    textAnchor: 'middle' as const,
  };

  return (
    <View>
      <Frame
        onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))}
        accessibilityLabel={label}
      >
        <Svg width={width} height={HEIGHT} pointerEvents="none">
          {atlas.streets.flatMap(street =>
            street.lines.map((points, i) => (
              <G key={`${street.name}-${i}`}>
                <Path
                  d={line(points)}
                  fill="none"
                  stroke={palette.streetEdge}
                  strokeWidth={18 / unit + 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={line(points)}
                  fill="none"
                  stroke={palette.street}
                  strokeWidth={18 / unit}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            )),
          )}
          <Path
            d={polygon([atlas.campus])}
            fill={palette.land}
            stroke={palette.outline}
            strokeWidth={1}
          />
          {atlas.paths.map((points, i) => (
            <Path
              key={i}
              d={line(points)}
              stroke={palette.street}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
          ))}
          {atlas.shapes.map(shape => (
            <Path
              key={shape.id}
              d={polygon(shape.rings)}
              fillRule="evenodd"
              fill={
                shape.kind === 'lago'
                  ? palette.water
                  : shape.kind === 'patio'
                    ? palette.land
                    : palette.building
              }
              stroke={palette.outline}
              strokeWidth={0.7}
            />
          ))}
          {atlas.blocks.map(block => {
            const [x, y] = screen(block.point);
            if (x < -12 || y < -12 || x > width + 12 || y > HEIGHT + 12)
              return null;
            return (
              <G key={block.id}>
                <Circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill={c.surface}
                  stroke={c.ruleStrong}
                  strokeWidth={1}
                />
                <SvgText
                  x={x}
                  y={y + 3.5}
                  {...svgText}
                  fontSize={10}
                  fill={c.inkMuted}
                >
                  {block.id}
                </SvgText>
              </G>
            );
          })}
          <G>
            <Path
              d={`M${width - 18} 10L${width - 23} 24L${width - 18} 20L${width - 13} 24Z`}
              fill={c.accent}
            />
            <SvgText
              x={width - 18}
              y={36}
              {...svgText}
              fontSize={10}
              fill={c.inkMuted}
            >
              N
            </SvgText>
          </G>
        </Svg>
        {marks.map(({ box, text }, index) =>
          box ? (
            <View
              key={`label-${marks[index].pin.notice.id}`}
              pointerEvents="none"
              style={[
                styles.label,
                {
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                  backgroundColor: c.surface,
                  borderColor: c.rule,
                  borderRadius: theme.radii.xs,
                },
              ]}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Text variant="caption" numberOfLines={1}>
                {text}
              </Text>
            </View>
          ) : null,
        )}
        {marks.map(({ pin, x, y }) => {
          const tone = toneOf(pin.notice);
          const chosen = pin.notice.id === selected;
          const ring =
            tone === 'mine'
              ? c.fill
              : tone === 'confirmed'
                ? c.accent
                : c.inkMuted;
          const fill =
            tone === 'mine'
              ? c.fill
              : tone === 'confirmed'
                ? c.accentSoft
                : c.surface;
          const ink =
            tone === 'mine'
              ? c.onFill
              : tone === 'confirmed'
                ? c.accent
                : c.inkMuted;
          return (
            <Pressable
              key={pin.notice.id}
              onPress={() => onSelect(pin.notice)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${noticeTitle(pin.notice)}, ${shortPlaceText(pin.notice.place)}${pin.count > 1 ? `, e mais ${pin.count - 1} no mesmo lugar` : ''}${tone === 'new' ? ', novo' : ''}`}
              accessibilityState={{ selected: chosen }}
              style={[
                styles.pin,
                {
                  left: x - PIN / 2,
                  top: y - PIN / 2,
                  backgroundColor: fill,
                  borderColor: ring,
                  borderStyle: tone === 'new' ? 'dashed' : 'solid',
                  borderWidth: chosen ? 3 : 2,
                },
              ]}
            >
              <Icon
                name={KIND_TEXT[pin.notice.kind].icon}
                size={theme.sizes.icon.sm}
                color={ink}
              />
            </Pressable>
          );
        })}
      </Frame>
      {legend}
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    position: 'absolute',
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    borderWidth: 1,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
