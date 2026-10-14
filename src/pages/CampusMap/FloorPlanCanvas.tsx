import React, { useId, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from 'styled-components/native';
import { IconButton, Text } from '@components/ui';
import {
  rectangleRing,
  type Camera,
} from '@root/modules/campus-map/domain/geometry';
import type {
  Block,
  Bounds,
  CampusAtlas,
  Floor,
  FloorPlan,
  FloorRoom,
  MapOrientation,
  Point,
  RoomLocation,
} from '@root/modules/campus-map/domain/types';
import {
  floorLayout,
  floorPath,
  floorPoint,
  roomFontSize,
  type FloorLayout,
} from './floorGeometry';
import { MapLayer } from './MapLayer';
import { useMapCamera } from './useMapCamera';

type Props = {
  atlas: CampusAtlas;
  orientation?: MapOrientation;
  destination?: RoomLocation;
  block?: Block;
  floor?: Floor;
};

type FloorTextProps = Omit<
  React.ComponentProps<typeof SvgText>,
  'x' | 'y' | 'fontSize' | 'transform'
> & {
  x: number;
  y: number;
  fontSize: number;
  unit: number;
  transform?: string;
};

/** Android measures glyphs before viewBox scaling; keep its font size in pixels. */
function FloorText({
  x,
  y,
  fontSize,
  unit,
  transform,
  children,
  ...props
}: FloorTextProps) {
  return (
    <G transform={transform}>
      <G transform={`translate(${x} ${y}) scale(${unit})`}>
        <SvgText {...props} x={0} y={0} fontSize={fontSize / unit}>
          {children}
        </SvgText>
      </G>
    </G>
  );
}

function zoom(camera: Camera, factor: number): Camera {
  const width = Math.max(12, Math.min(160, camera.width / factor));
  const height = (width * camera.height) / camera.width;
  return {
    x: camera.x + (camera.width - width) / 2,
    y: camera.y + (camera.height - height) / 2,
    width,
    height,
  };
}

const EMPTY_ROUTE: Point[] = [];

type DrawingProps = {
  atlas: CampusAtlas;
  block: Block;
  floor: Floor;
  layout: FloorLayout;
  plan?: FloorPlan;
  selected?: FloorRoom;
  route: readonly Point[];
  unit: number;
};

/** Keep the measured drawing intact while only the viewport moves. */
const FloorPlanDrawing = React.memo(function FloorPlanDrawing({
  atlas,
  block,
  floor,
  layout,
  plan,
  selected,
  route,
  unit,
}: DrawingProps) {
  const theme = useTheme();
  const c = theme.colors;
  const id = useId().replace(/:/g, '');
  const activeBlocks =
    block === 'C' || floor === 'T' || floor === 'SE' ? [block] : [block, 'C'];
  const structures = atlas.internalShapes
    .filter(
      shape =>
        (!shape.block || activeBlocks.includes(shape.block)) &&
        !((floor === 'T' || floor === 'SE') && shape.kind === 'passarela'),
    )
    .sort(
      (a, b) => Number(a.kind !== 'ligacao') - Number(b.kind !== 'ligacao'),
    );
  const rooms = plan?.rooms ?? [];
  const isUpper = floor !== 'T' && floor !== 'SE';
  const baseText = {
    fontFamily: theme.fonts.semibold,
    fill: c.inkMuted,
    textAnchor: 'middle' as const,
  };
  const keyScale = layout.key.width / 228.62;
  const keyPoint = ([x, y]: Point): Point => [
    layout.key.x + (228.62 - x) * keyScale,
    layout.key.y + 3 + (94.8 - y) * keyScale,
  ];
  const keyPath = (points: readonly Point[], closed = true) =>
    points
      .map((point, i) => `${i ? 'L' : 'M'}${keyPoint(point).join(' ')}`)
      .join(' ') + (closed ? 'Z' : '');
  return (
    <>
      <Defs>
        {layout.segments.map((segment, index) => (
          <ClipPath key={index} id={`${id}-${index}`}>
            <Rect
              x={segment.left}
              y={0}
              width={segment.x1 - segment.x0}
              height={layout.height}
            />
          </ClipPath>
        ))}
      </Defs>
      {layout.segments.map((segment, index) => {
        const point = (p: Point) => floorPoint(p, segment, layout.top);
        const path = (points: readonly Point[], closed = false) =>
          floorPath(points, segment, layout.top, closed);
        const rectPath = (bounds: Bounds) => path(rectangleRing(bounds), true);
        return (
          <G key={index} clipPath={`url(#${id}-${index})`}>
            {atlas.shapes
              .filter(shape =>
                activeBlocks.some(letter => shape.id === `bloco-${letter}`),
              )
              .map(shape => (
                <Path
                  key={shape.id}
                  d={shape.rings.map(ring => path(ring, true)).join(' ')}
                  fill={c.fieldBorder}
                  stroke={c.inkMuted}
                  strokeWidth={1.1 * unit}
                />
              ))}
            {activeBlocks.includes('C') ? (
              <>
                <Path
                  d={rectPath([92.33, 58, 136.53, 70.8])}
                  fill={c.surface}
                />
                {(
                  [
                    [92.33, 54.65, 136.53, 58],
                    [96.43, 45.22, 108.43, 52.22],
                    [120.43, 45.22, 132.43, 52.22],
                  ] as Bounds[]
                ).map((bounds, n) => (
                  <Path
                    key={`lobby-${n}`}
                    d={rectPath(bounds)}
                    fill={c.accentSoft}
                  />
                ))}
              </>
            ) : null}
            {structures
              .filter(shape => shape.kind !== 'pillar' && shape.kind !== 'wall')
              .map(shape => {
                const boundary = shape.rings[0];
                const bounds: Bounds = [
                  Math.min(...boundary.map(p => p[0])),
                  Math.min(...boundary.map(p => p[1])),
                  Math.max(...boundary.map(p => p[0])),
                  Math.max(...boundary.map(p => p[1])),
                ];
                return (
                  <G key={shape.id}>
                    <Path
                      d={shape.rings.map(ring => path(ring, true)).join(' ')}
                      fill={
                        /elevador/.test(shape.kind)
                          ? c.ink
                          : /escada|sanitario/.test(shape.kind)
                            ? c.surfaceStrong
                            : c.accentSoft
                      }
                      stroke={c.fieldBorder}
                      strokeWidth={0.6 * unit}
                    />
                    {shape.kind === 'escada' ? (
                      <Path
                        d={Array.from(
                          {
                            length: Math.floor((bounds[3] - bounds[1]) / 0.6),
                          },
                          (_, step) =>
                            path([
                              [bounds[0], bounds[1] + (step + 1) * 0.6],
                              [bounds[2], bounds[1] + (step + 1) * 0.6],
                            ]),
                        ).join(' ')}
                        fill="none"
                        stroke={c.fieldBorder}
                        strokeWidth={0.6 * unit}
                      />
                    ) : null}
                    {shape.kind === 'rampa' ? (
                      <Path
                        d={`${path([
                          [bounds[0], bounds[1]],
                          [bounds[2], bounds[3]],
                        ])} ${path([
                          [bounds[2], bounds[1]],
                          [bounds[0], bounds[3]],
                        ])}`}
                        fill="none"
                        stroke={c.fieldBorder}
                        strokeWidth={0.6 * unit}
                      />
                    ) : null}
                  </G>
                );
              })}
            {rooms.map(room => (
              <Path
                key={`${room.code}:${room.bounds.join(',')}`}
                d={
                  room.polygon
                    ? path(room.polygon, true)
                    : rectPath(room.bounds)
                }
                fill={room.code === selected?.code ? c.fill : c.surface}
                stroke={room.certainty === 'official' ? c.ink : c.fieldBorder}
                strokeWidth={(room.certainty === 'official' ? 1.3 : 0.7) * unit}
                strokeDasharray={
                  room.certainty === 'official'
                    ? undefined
                    : `${2.5 * unit} ${2.5 * unit}`
                }
              />
            ))}
            {plan?.structures.map((structure, n) => {
              const bounds = structure.bounds;
              const isStair = /escada/.test(structure.kind);
              const isRamp = /rampa/.test(structure.kind);
              const [x, y] = point([
                (bounds[0] + bounds[2]) / 2,
                (bounds[1] + bounds[3]) / 2,
              ]);
              return (
                <G key={`structure-${n}`}>
                  <Path
                    d={
                      structure.line
                        ? path(structure.line)
                        : structure.polygon
                          ? path(structure.polygon, true)
                          : rectPath(bounds)
                    }
                    fill={
                      structure.line
                        ? 'none'
                        : /nicho|pilar/.test(structure.kind)
                          ? c.inkMuted
                          : /passarela|ligacao|rampa/.test(structure.kind)
                            ? c.accentSoft
                            : c.surfaceStrong
                    }
                    stroke={c.fieldBorder}
                    strokeWidth={0.6 * unit}
                  />
                  {isStair ? (
                    <Path
                      d={Array.from(
                        {
                          length: Math.max(
                            1,
                            Math.floor((bounds[3] - bounds[1]) / 0.6),
                          ),
                        },
                        (_, step) =>
                          path([
                            [bounds[0], bounds[1] + step * 0.6],
                            [bounds[2], bounds[1] + step * 0.6],
                          ]),
                      ).join(' ')}
                      fill="none"
                      stroke={c.fieldBorder}
                      strokeWidth={0.6 * unit}
                    />
                  ) : null}
                  {isRamp ? (
                    <Path
                      d={`${path([
                        [bounds[0], bounds[1]],
                        [bounds[2], bounds[3]],
                      ])} ${path([
                        [bounds[2], bounds[1]],
                        [bounds[0], bounds[3]],
                      ])}`}
                      stroke={c.fieldBorder}
                      strokeWidth={0.6 * unit}
                    />
                  ) : null}
                  {/sanitario/.test(structure.kind) ? (
                    <FloorText
                      unit={unit}
                      x={x}
                      y={y + 3 * unit}
                      {...baseText}
                      fontSize={10 * unit}
                    >
                      WC
                    </FloorText>
                  ) : null}
                </G>
              );
            })}
            {isUpper && activeBlocks.includes('C')
              ? [96.43, 120.43].map(start => (
                  <G key={start}>
                    {[43.22, 52.22].map(y =>
                      Array.from({ length: 5 }, (_, cabin) => (
                        <Path
                          key={`${y}-${cabin}`}
                          d={rectPath([
                            start + cabin * 2.4 + 0.12,
                            y,
                            start + (cabin + 1) * 2.4 - 0.12,
                            y + 2,
                          ])}
                          fill={y === 43.22 ? c.ink : c.fieldBorder}
                        />
                      )),
                    )}
                    {start + 6 > segment.x0 + 5 &&
                    start + 6 < segment.x1 - 5 ? (
                      <FloorText
                        unit={unit}
                        x={point([start + 6, 50.8])[0]}
                        y={point([start + 6, 50.8])[1]}
                        {...baseText}
                        fontSize={Math.min(10 * unit, 1.8)}
                      >
                        Elevadores
                      </FloorText>
                    ) : null}
                  </G>
                ))
              : null}
            {block === 'F' && isUpper ? (
              <FloorText
                unit={unit}
                x={point([114.31, 51])[0]}
                y={point([114.31, 51])[1]}
                {...baseText}
                fontSize={9.5 * unit}
              >
                Elevadores
              </FloorText>
            ) : null}
            {isUpper
              ? structures
                  .filter(
                    shape => shape.kind === 'pillar' || shape.kind === 'wall',
                  )
                  .map(shape => (
                    <Path
                      key={shape.id}
                      d={shape.rings.map(ring => path(ring, true)).join(' ')}
                      fill={c.inkMuted}
                    />
                  ))
              : null}
            {rooms
              .filter(room => room.door)
              .map(room => (
                <Path
                  key={`door-${room.code}:${room.bounds.join(',')}`}
                  d={rectPath(room.door!)}
                  fill={room.code === selected?.code ? c.fill : c.inkMuted}
                />
              ))}
            {route.length > 1 ? (
              <>
                <Path
                  d={path(route)}
                  fill="none"
                  stroke={c.surface}
                  strokeWidth={5 * unit}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={path(route)}
                  fill="none"
                  stroke={c.accent}
                  strokeWidth={2.5 * unit}
                  strokeDasharray={`${5 * unit} ${3 * unit}`}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle
                  cx={point(route[0])[0]}
                  cy={point(route[0])[1]}
                  r={4 * unit}
                  fill={c.surface}
                  stroke={c.accent}
                  strokeWidth={2 * unit}
                />
                <Circle
                  cx={point(route[route.length - 1])[0]}
                  cy={point(route[route.length - 1])[1]}
                  r={3 * unit}
                  fill={c.accent}
                  stroke={c.surface}
                  strokeWidth={1.5 * unit}
                />
              </>
            ) : null}
            {rooms.map(room => {
              if (
                !room.code ||
                room.bounds[0] < segment.x0 ||
                room.bounds[2] > segment.x1
              )
                return null;
              const shortCode = room.code.replace(/\s?[A-F]$/, '');
              const rotated = block === 'F';
              const fs = roomFontSize(shortCode, room.bounds, unit, rotated);
              if (fs / unit < 8 && room.code !== selected?.code) return null;
              const [x, y] = point(
                room.labelPoint ?? [
                  (room.bounds[0] + room.bounds[2]) / 2,
                  (room.bounds[1] + room.bounds[3]) / 2,
                ],
              );
              return (
                <FloorText
                  unit={unit}
                  key={`label-${room.code}`}
                  {...baseText}
                  x={x}
                  y={y + fs * 0.34}
                  fontFamily={
                    room.recorded ? theme.fonts.semibold : theme.fonts.regular
                  }
                  fontSize={fs}
                  fill={
                    room.code === selected?.code
                      ? c.onFill
                      : room.recorded
                        ? c.ink
                        : c.inkMuted
                  }
                  transform={rotated ? `rotate(-90 ${x} ${y})` : undefined}
                >
                  {shortCode}
                </FloorText>
              );
            })}
            {'ABDE'.includes(block) ? (
              <>
                <FloorText
                  unit={unit}
                  x={
                    point([
                      atlas.blocks.find(b => b.id === block)!.point[0],
                      96.4,
                    ])[0]
                  }
                  y={2.8}
                  {...baseText}
                  fontSize={Math.min(
                    11 * unit,
                    (segment.x1 - segment.x0) / 4.8,
                  )}
                  fill={c.accent}
                >
                  {`Bloco ${block}`}
                </FloorText>
                <FloorText
                  unit={unit}
                  x={
                    point([
                      atlas.blocks.find(b => b.id === block)!.point[0],
                      38,
                    ])[0]
                  }
                  y={point([0, 38])[1]}
                  {...baseText}
                  fontSize={9.5 * unit}
                >
                  Rampa ao F
                </FloorText>
                <FloorText
                  unit={unit}
                  x={point([segment.x0 + (segment.x1 - segment.x0) / 2, 64])[0]}
                  y={point([0, 64])[1]}
                  {...baseText}
                  fontSize={11 * unit}
                >
                  {segment.x0 > 90 && segment.x1 < 139 ? 'Bloco C' : ''}
                </FloorText>
              </>
            ) : null}
          </G>
        );
      })}
      {layout.gap
        ? (() => {
            const gap = layout.gap;
            const y = layout.top - gap.y;
            const x = (gap.left + gap.right) / 2;
            const upper = block === 'F' ? layout.top - 28.68 : y - 1.65;
            const lower = block === 'F' ? layout.top - 8.2 : y + 1.65;
            return (
              <G>
                <Rect
                  x={gap.left}
                  y={upper}
                  width={gap.right - gap.left}
                  height={lower - upper}
                  fill={c.accentSoft}
                />
                <Path
                  d={`M${gap.left} ${upper}H${gap.right}M${gap.left} ${lower}H${gap.right}`}
                  stroke={c.fieldBorder}
                  strokeWidth={unit}
                />
                {route.length > 1 ? (
                  <Path
                    d={`M${gap.left} ${y}H${gap.right}`}
                    stroke={c.accent}
                    strokeWidth={2.5 * unit}
                    strokeDasharray={`${5 * unit} ${3 * unit}`}
                  />
                ) : null}
                <Path
                  d={`M${x - 0.35} ${upper - 0.8}l-0.6 ${(lower - upper) / 3}l1.2 ${(lower - upper) / 3}l-1.2 ${(lower - upper) / 3}l0.6 0.8`}
                  fill="none"
                  stroke={c.surfaceMuted}
                  strokeWidth={3 * unit}
                />
                <Path
                  d={`M${x - 0.35} ${upper - 0.8}l-0.6 ${(lower - upper) / 3}l1.2 ${(lower - upper) / 3}l-1.2 ${(lower - upper) / 3}l0.6 0.8`}
                  fill="none"
                  stroke={c.inkMuted}
                  strokeWidth={0.8 * unit}
                />
                <FloorText
                  unit={unit}
                  x={
                    block === 'F'
                      ? x
                      : block === 'A' || block === 'B'
                        ? gap.left - 0.4
                        : gap.right + 0.4
                  }
                  y={block === 'F' ? lower + 2.5 : upper - 1.5}
                  {...baseText}
                  textAnchor={
                    block === 'F'
                      ? 'middle'
                      : block === 'A' || block === 'B'
                        ? 'end'
                        : 'start'
                  }
                  fontSize={10 * unit}
                >
                  {`${Math.round(gap.metres)} m`}
                </FloorText>
              </G>
            );
          })()
        : null}
      <G>
        <Rect
          x={layout.key.x - 0.8}
          y={layout.key.y - 0.5}
          width={layout.key.width + 1.6}
          height={4 + 94.8 * keyScale}
          rx={0.7}
          fill={c.surfaceMuted}
        />
        {atlas.shapes
          .filter(
            shape =>
              shape.kind === 'bloco' ||
              shape.kind === 'lig' ||
              (isUpper && shape.kind === 'pas'),
          )
          .map(shape => (
            <Path
              key={`key-${shape.id}`}
              d={shape.rings.map(ring => keyPath(ring)).join(' ')}
              fill={
                shape.id === `bloco-${block}` ? c.selection : c.surfaceStrong
              }
              stroke={shape.id === `bloco-${block}` ? c.accent : c.fieldBorder}
              strokeWidth={0.6 * unit}
            />
          ))}
        {atlas.blocks.map(item => {
          const [x, y] = keyPoint(
            item.id === 'F'
              ? [220, 10]
              : item.id === 'C'
                ? [101, 64]
                : [item.point[0], 102],
          );
          return (
            <FloorText
              unit={unit}
              key={item.id}
              {...baseText}
              x={x}
              y={y + 0.6}
              fontSize={10 * unit}
              fill={item.id === block ? c.accent : c.inkMuted}
            >
              {item.id}
            </FloorText>
          );
        })}
        {route.length > 1 ? (
          <Path
            d={keyPath(route, false)}
            fill="none"
            stroke={c.accent}
            strokeWidth={unit}
          />
        ) : null}
        {selected?.doorPoint ? (
          <Circle
            cx={keyPoint(selected.doorPoint)[0]}
            cy={keyPoint(selected.doorPoint)[1]}
            r={2 * unit}
            fill={c.accent}
          />
        ) : null}
      </G>
      {block === 'F' ? (
        <FloorText
          unit={unit}
          x={layout.width / 2}
          y={layout.height - 0.5}
          {...baseText}
          fontSize={10 * unit}
        >
          Rua São Francisco Xavier
        </FloorText>
      ) : null}
    </>
  );
});

/** Measured atlas sections, with the omitted span marked. */
export function FloorPlanCanvas({
  atlas,
  orientation,
  destination,
  block = 'C',
  floor = 'T',
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [size, setSize] = useState({ width: 360, height: 380 });
  const plan = orientation?.floorPlan;
  const selected = orientation?.room;
  const route = orientation?.route ?? EMPTY_ROUTE;
  const layout = useMemo(
    () => floorLayout(atlas, block, selected),
    [atlas, block, selected],
  );
  const key = `${block}:${floor}:${destination?.code ?? ''}`;
  const ratio = size.width / size.height;
  const width = Math.max(layout.width + 2, (layout.height + 2) * ratio);
  const height = width / ratio;
  const initial = {
    x: (layout.width - width) / 2,
    y: (layout.height - height) / 2,
    width,
    height,
  };
  const { camera, gesture, animatedStyle, setCamera, reset } = useMapCamera({
    initialCamera: initial,
    width: size.width,
    height: size.height,
    resetKey: `${key}:${size.width}:${size.height}`,
    minWidth: 12,
    maxWidth: 160,
    refreshOnPanEnd: false,
  });
  const unit = camera.width / size.width;
  const scale = [20, 10, 5, 2, 1].find(metres => metres / unit < 54) ?? 1;
  return (
    <View
      style={[styles.canvas, { backgroundColor: c.surfaceMuted }]}
      testID="floor-plan-canvas"
    >
      <GestureHandlerRootView
        style={styles.plot}
        onLayout={event => {
          const next = event.nativeEvent.layout;
          if (
            next.width &&
            next.height &&
            (next.width !== size.width || next.height !== size.height)
          ) {
            setSize({ width: next.width, height: next.height });
          }
        }}
      >
        <GestureDetector gesture={gesture}>
          <View
            collapsable={false}
            style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
          >
            <MapLayer
              camera={camera}
              width={size.width}
              height={size.height}
              animatedStyle={animatedStyle}
              projection="world"
              accessibilityLabel={`Planta do Bloco ${block}, ${floor === 'T' ? 'térreo' : floor === 'SE' ? 'semienterrado' : `${floor}º andar`}${destination?.code ? `, caminho até a sala ${destination.code}` : ''}`}
            >
              <FloorPlanDrawing
                atlas={atlas}
                block={block}
                floor={floor}
                layout={layout}
                plan={plan}
                selected={selected}
                route={route}
                unit={unit}
              />
            </MapLayer>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
      <View style={[styles.toolbar, { backgroundColor: c.surface }]}>
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={[styles.routeKey, { borderColor: c.accent }]} />
            <Text variant="caption">Trajeto</Text>
          </View>
          <View style={styles.legendRow}>
            <Svg width={scale / unit} height={6}>
              <Path
                d={`M0 0V5H${scale / unit}V0`}
                fill="none"
                stroke={c.inkMuted}
              />
            </Svg>
            <Text variant="caption">{`${scale} m`}</Text>
          </View>
        </View>
        <View style={styles.zoom}>
          <IconButton
            icon="add"
            accessibilityLabel="Ampliar planta"
            onPress={() => setCamera(current => zoom(current, 1.5))}
          />
          <IconButton
            icon="remove"
            accessibilityLabel="Reduzir planta"
            onPress={() => setCamera(current => zoom(current, 1 / 1.5))}
          />
          <IconButton
            icon="refresh"
            accessibilityLabel="Reenquadrar planta"
            onPress={reset}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, minHeight: 120, overflow: 'hidden' },
  plot: { flex: 1, overflow: 'hidden' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  legend: { flex: 1, gap: 4 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  routeKey: { width: 13, borderTopWidth: 2, borderStyle: 'dashed' },
  zoom: { flexDirection: 'row' },
});
