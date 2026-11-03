import React, { useMemo, useState } from 'react';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import styled, { useTheme } from 'styled-components/native';

import { useAppServices } from '@root/app/providers/AppServicesProvider';
import {
  fitCamera,
  orientPoint,
} from '@root/modules/campus-map/domain/geometry';
import type { Point } from '@root/modules/campus-map/domain/types';
import type { MeetingPin } from './meetingPoints';

/** Altura do desenho: o bastante para o encontro e a saída, sem empurrar o resto. */
const HEIGHT = 196;
const PIN_RADIUS = 10;
const LABEL_FONT = 12;
const LABEL_HEIGHT = 22;

const Frame = styled.View`
  height: ${HEIGHT}px;
  overflow: hidden;
  border-width: ${({ theme }) => theme.borders.hairline}px;
  border-color: ${({ theme }) => theme.colors.rule};
  border-radius: ${({ theme }) => theme.radii.xl}px;
  border-top-right-radius: 0px;
  background-color: ${({ theme }) => theme.campusMap.ground};
`;

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width + 2 &&
  a.x + a.width + 2 > b.x &&
  a.y < b.y + b.height + 2 &&
  a.y + a.height + 2 > b.y;

/**
 * O ponto de encontro no desenho do Mapa do app (o mesmo atlas, com o norte
 * para cima), sem gestos: o encontro e, na volta, a saída e o destino, com
 * os números dos passos. Para explorar, "Ver no Mapa" abre o Mapa.
 */
export function MeetingMap({
  pins,
  accessibilityLabel,
}: {
  pins: readonly MeetingPin[];
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const palette = theme.campusMap;
  const { campusMap } = useAppServices();
  const atlas = campusMap.atlas;
  const [width, setWidth] = useState(0);

  const camera = useMemo(
    () =>
      width && pins.length
        ? fitCamera(
            pins.map(pin => pin.point),
            width,
            HEIGHT,
            // um pino só: o bastante em volta para reconhecer o lugar
            pins.length > 1 ? 34 : 70,
            atlas.north,
          )
        : null,
    [atlas.north, pins, width],
  );

  if (!camera)
    return (
      <Frame
        onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      />
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

  // os rótulos à direita do pino, ou à esquerda, sem cobrir outro rótulo nem
  // o norte, no canto de cima à direita
  const placed: Box[] = [{ x: width - 30, y: 4, width: 26, height: 36 }];
  const labels = pins.map(pin => {
    const [x, y] = screen(pin.point);
    const labelWidth = pin.label.length * 6.6 + 14;
    const candidates = [
      { x: x + PIN_RADIUS + 6, y: y - LABEL_HEIGHT / 2 },
      { x: x - PIN_RADIUS - 6 - labelWidth, y: y - LABEL_HEIGHT / 2 },
      { x: x + PIN_RADIUS + 6, y: y - LABEL_HEIGHT / 2 - 24 },
      { x: x - PIN_RADIUS - 6 - labelWidth, y: y - LABEL_HEIGHT / 2 + 24 },
    ].map(spot => ({
      x: Math.max(4, Math.min(width - labelWidth - 4, spot.x)),
      y: Math.max(4, Math.min(HEIGHT - LABEL_HEIGHT - 4, spot.y)),
      width: labelWidth,
      height: LABEL_HEIGHT,
    }));
    const pinBox = {
      x: x - PIN_RADIUS,
      y: y - PIN_RADIUS,
      width: PIN_RADIUS * 2,
      height: PIN_RADIUS * 2,
    };
    const box =
      candidates.find(
        candidate =>
          !overlaps(candidate, pinBox) &&
          !placed.some(other => overlaps(candidate, other)),
      ) ?? candidates[0];
    placed.push(box, pinBox);
    return { pin, x, y, box };
  });

  const text = {
    fontFamily: theme.fonts.semibold,
    fontSize: LABEL_FONT,
    textAnchor: 'middle' as const,
  };

  return (
    <Frame
      onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
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
                r={9}
                fill={c.surface}
                stroke={c.ruleStrong}
                strokeWidth={1}
              />
              <SvgText x={x} y={y + 4} {...text} fontSize={11} fill={c.accent}>
                {block.id}
              </SvgText>
            </G>
          );
        })}
        {pins.length > 1 ? (
          <Path
            d={labels
              .map(({ x, y }, i) => `${i ? 'L' : 'M'}${x} ${y}`)
              .join(' ')}
            fill="none"
            stroke={c.accent}
            strokeWidth={2.5}
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {labels.map(({ pin, x, y, box }) => (
          <G key={pin.key}>
            <Rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx={4}
              fill={c.surface}
              fillOpacity={0.94}
              stroke={c.rule}
              strokeWidth={1}
            />
            <SvgText
              x={box.x + box.width / 2}
              y={box.y + 15}
              {...text}
              fill={c.ink}
            >
              {pin.label}
            </SvgText>
            <Circle
              cx={x}
              cy={y}
              r={PIN_RADIUS}
              fill={c.fill}
              stroke={c.surface}
              strokeWidth={2}
            />
            {pin.number ? (
              <SvgText x={x} y={y + 4} {...text} fontSize={11} fill={c.onFill}>
                {pin.number}
              </SvgText>
            ) : (
              <Circle cx={x} cy={y} r={3.5} fill={c.onFill} />
            )}
          </G>
        ))}
        <G>
          <Path
            d={`M${width - 18} 10L${width - 23} 24L${width - 18} 20L${width - 13} 24Z`}
            fill={c.accent}
          />
          <SvgText
            x={width - 18}
            y={36}
            {...text}
            fontSize={10}
            fill={c.inkMuted}
          >
            N
          </SvgText>
        </G>
      </Svg>
    </Frame>
  );
}
