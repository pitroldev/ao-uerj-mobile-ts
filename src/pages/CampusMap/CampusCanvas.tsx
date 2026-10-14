import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from 'styled-components/native';
import { IconButton, Text } from '@components/ui';
import {
  fitCamera,
  orientPoint,
  zoomCamera,
} from '@root/modules/campus-map/domain/geometry';
import type {
  Block,
  CampusAtlas,
  Floor,
  MapOrientation,
  OfficialRoom,
  Place,
  Point,
  RoomLocation,
} from '@root/modules/campus-map/domain/types';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { MapLayer } from './MapLayer';
import { useMapCamera } from './useMapCamera';

type Props = {
  atlas: CampusAtlas;
  place?: Place;
  block?: Block;
  floor?: Floor;
  room?: OfficialRoom;
  pavilion: boolean;
  view?: 'campus' | 'floor';
  destination?: RoomLocation;
  orientation?: MapOrientation;
  onSelect: (place: Place) => void;
};

export function CampusCanvas(props: Props) {
  if (props.view === 'floor' && props.block && props.floor) {
    return (
      <FloorPlanCanvas
        atlas={props.atlas}
        block={props.block}
        floor={props.floor}
        destination={props.destination}
        orientation={props.orientation}
      />
    );
  }
  return <CampusOverview {...props} />;
}

type Label = {
  id: string;
  text: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: Point;
  place?: Place;
  selected?: boolean;
};
type LabelBox = Pick<Label, 'x' | 'y' | 'width' | 'height'>;
const overlaps = (a: LabelBox, b: LabelBox) =>
  a.x < b.x + b.width + 2 &&
  a.x + a.width + 2 > b.x &&
  a.y < b.y + b.height + 2 &&
  a.y + a.height + 2 > b.y;
const essentialPlaces = ['portao-metro', 'portao-sfx', 'metro', 'trem'];
const pinOffsets = Array.from({ length: 17 }, (_, row) =>
  Array.from({ length: 17 }, (_item, col) => [(col - 8) * 12, (row - 8) * 12]),
)
  .flat()
  .sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
const streetLines: Record<string, string[]> = {
  'Av. Rei Pelé (Radial Oeste)': ['Av. Rei Pelé', 'Radial Oeste'],
  'R. Radialista Waldir Amaral': ['R. Radialista', 'Waldir Amaral'],
  'R. São Francisco Xavier': ['R. São Francisco', 'Xavier'],
  'Av. Prof. Manoel de Abreu': ['Av. Prof. Manoel', 'de Abreu'],
};
const poiNames: Record<string, string[]> = {
  trem: ['Trens', 'Maracanã'],
  metro: ['Metrô', 'Maracanã'],
  'portao-metro': ['Portão 1'],
  'portao-sfx': ['Portão 5'],
  ccot: ['Centro Cultural'],
  haroldinho: ['Haroldinho'],
  'teatro-odylo': ['Teatro Odylo'],
  ginasio: ['Ginásio'],
  capela: ['Capela'],
};

function CampusOverview({ atlas, place, block, orientation, onSelect }: Props) {
  const theme = useTheme(),
    c = theme.colors;
  const dark = theme.name === 'dark';
  const palette = {
    land: dark ? '#25352F' : '#EAF0E9',
    building: dark ? '#374C61' : '#DCE5EE',
    outline: dark ? '#8298AC' : '#8C9FB1',
    street: dark ? '#34414D' : '#FFFFFF',
    streetEdge: dark ? '#4F5E6B' : '#CDD5DC',
    ground: dark ? '#1C2833' : '#F3F5F7',
    water: dark ? '#294F65' : '#D4EAF4',
  };
  const [size, setSize] = useState({ width: 390, height: 430 });
  // Retain the streets and stations when a room is selected.
  const initialCamera = useMemo(
    () =>
      fitCamera(
        [
          ...atlas.campus,
          ...atlas.places
            .filter(p => p.id === 'metro' || p.id === 'trem')
            .map(p => p.point),
        ],
        size.width,
        size.height,
        38,
        atlas.north,
      ),
    [atlas, size.width, size.height],
  );
  const { camera, gesture, animatedStyle, setCamera, reset } = useMapCamera({
    initialCamera,
    width: size.width,
    height: size.height,
    resetKey: `${size.width}:${size.height}`,
    minWidth: 18,
    maxWidth: 1400,
    positionLimit: 900,
  });
  const unit = camera.width / size.width;
  const screenPoint = (point: Point): Point => {
    const [x, y] = orientPoint(point, atlas.north);
    return [(x - camera.x) / unit, (y - camera.y) / unit];
  };
  const line = (points: readonly Point[]) =>
    points
      .map((p, i) => `${i ? 'L' : 'M'}${screenPoint(p).join(' ')}`)
      .join(' ');
  const polygon = (rings: readonly (readonly Point[])[]) =>
    rings.map(r => line(r) + 'Z').join(' ');
  const scale = [100, 50, 20, 10, 5, 2, 1].find(n => n / unit <= 58) ?? 1;
  const visible = ([x, y]: Point, margin = 0) =>
    x >= margin &&
    y >= margin &&
    x <= size.width - margin &&
    y <= size.height - margin;
  const textStyle = {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    textAnchor: 'middle' as const,
    fill: c.inkMuted,
  };

  const occupied: LabelBox[] = [];
  const streetLabels = atlas.streets.flatMap(street => {
    const [px, py] = screenPoint(street.point);
    if (!visible([px, py])) return [];
    const raw = street.angle + atlas.north;
    const angle = raw > 90 ? raw - 180 : raw < -90 ? raw + 180 : raw;
    const text = streetLines[street.name] ?? [street.name];
    const width = Math.max(...text.map(t => t.length)) * 5.3;
    const height = text.length * 12;
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians),
      sin = Math.sin(radians);
    const bx = (Math.abs(width * cos) + Math.abs(height * sin)) / 2 + 4;
    const by = (Math.abs(width * sin) + Math.abs(height * cos)) / 2 + 4;
    // Move along the road before using a small perpendicular offset.
    for (const normal of [0, -14, 14]) {
      for (const along of [0, -16, 16, -32, 32, -48, 48, -64, 64]) {
        const x = px + cos * along - sin * normal;
        const y = py + sin * along + cos * normal;
        if (
          x - bx < 4 ||
          y - by < 4 ||
          x + bx > size.width - 4 ||
          y + by > size.height - 4
        )
          continue;
        const boxes = text.flatMap((t, row) => {
          const count = Math.ceil((t.length * 5.3) / 12);
          return Array.from({ length: count }, (_, i) => {
            const offset =
              ((i + 0.5) * t.length * 5.3) / count - (t.length * 5.3) / 2;
            const perpendicular = (row - (text.length - 1) / 2) * 12;
            return {
              x: x + cos * offset - sin * perpendicular - 7,
              y: y + sin * offset + cos * perpendicular - 7,
              width: 14,
              height: 14,
            };
          });
        });
        if (boxes.some(b => occupied.some(o => overlaps(b, o)))) continue;
        occupied.push(...boxes);
        return [{ name: street.name, text, angle, x, y }];
      }
    }
    return [];
  });
  const blocks = atlas.blocks.map(b => ({
    ...b,
    screen: screenPoint(b.point),
  }));
  for (const b of blocks)
    occupied.push({
      x: b.screen[0] - 12,
      y: b.screen[1] - 12,
      width: 24,
      height: 24,
    });
  const route = orientation?.entranceRoute ?? [];
  // Labels cannot cover the route or any essential geographic marker.
  for (let i = 1; i < route.length; i++) {
    const a = screenPoint(route[i - 1]),
      b = screenPoint(route[i]);
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8);
    for (let j = 0; j <= count; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / Math.max(1, count);
      const y = a[1] + ((b[1] - a[1]) * j) / Math.max(1, count);
      if (!visible([x, y], -10)) continue;
      occupied.push({
        x: x - 5,
        y: y - 5,
        width: 10,
        height: 10,
      });
    }
  }
  const essentialMarkers = atlas.places.filter(p =>
    essentialPlaces.includes(p.id),
  );
  for (const p of essentialMarkers) {
    const [x, y] = screenPoint(p.point);
    occupied.push({ x: x - 6, y: y - 6, width: 12, height: 12 });
  }
  const labels: Label[] = [];
  const labelPlaces = [
    ...essentialPlaces.map(id => atlas.places.find(p => p.id === id)!),
    ...(place && !place.block && place.id !== 'pjlf' ? [place] : []),
    ...Object.keys(poiNames)
      .map(id => atlas.places.find(p => p.id === id)!)
      .filter(Boolean),
  ].filter((p, i, all) => all.findIndex(other => other.id === p.id) === i);
  for (const p of labelPlaces) {
    const anchor = screenPoint(p.point);
    if (!visible(anchor, 5)) continue;
    let text = poiNames[p.id] ?? [p.name];
    const pin =
      p.category === 'portoes' ||
      p.category === 'transporte' ||
      p.id === place?.id;
    const offsets = pin
      ? pinOffsets
      : [
          [0, 0],
          [0, 21],
          [0, -21],
          [-28, 0],
          [28, 0],
          [-55, 0],
          [55, 0],
          [0, -42],
          [0, 42],
          [-55, -28],
          [-55, 28],
        ];
    let rect: LabelBox | undefined;
    const variants =
      p.id === 'metro' || p.id === 'trem' ? [text, [text[0]]] : [text];
    for (const variant of variants) {
      const width = Math.max(...variant.map(t => t.length)) * 5.9 + 12;
      const height = variant.length * 14 + 8;
      for (const [dx, dy] of offsets) {
        const next = {
          x: Math.max(
            6,
            Math.min(size.width - width - 6, anchor[0] + dx - width / 2),
          ),
          y: Math.max(
            6,
            Math.min(size.height - height - 6, anchor[1] + dy - height / 2),
          ),
          width,
          height,
        };
        if (!occupied.some(r => overlaps(next, r))) {
          rect = next;
          text = variant;
          break;
        }
      }
      if (rect) break;
    }
    if (!rect) continue;
    occupied.push(rect);
    labels.push({
      id: p.id,
      text,
      ...rect,
      anchor,
      place: p,
      selected: p.id === place?.id,
    });
  }
  const clustered = blocks.some((b, i) =>
    blocks.some(
      (other, j) =>
        i !== j &&
        Math.abs(b.screen[0] - other.screen[0]) < 48 &&
        Math.abs(b.screen[1] - other.screen[1]) < 48,
    ),
  );
  const blockTargets = clustered
    ? [atlas.places.find(p => p.id === 'pjlf')!]
    : atlas.blocks.map(b =>
        atlas.places.find(p => p.id === `bloco-${b.id.toLowerCase()}`)!,
      );
  const targets = [
    ...blockTargets.map(p => ({ p, screen: screenPoint(p.point), width: 48 })),
    ...labels.map(label => ({
      p: label.place!,
      screen: [label.x + label.width / 2, label.y + label.height / 2] as Point,
      width: Math.max(48, label.width),
    })),
  ].filter(t => visible(t.screen));

  return (
    <View
      style={[styles.canvas, { backgroundColor: palette.ground }]}
      testID="campus-canvas"
    >
      <GestureHandlerRootView
        style={styles.plot}
        testID="campus-map-plot"
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          if (
            width &&
            height &&
            (width !== size.width || height !== size.height)
          ) {
            setSize({ width, height });
          }
        }}
      >
        <GestureDetector gesture={gesture}>
          <View
            style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
            collapsable={false}
          >
            <MapLayer
              key={`${size.width}-${size.height}`}
              camera={camera}
              width={size.width}
              height={size.height}
              projection="screen"
              animatedStyle={animatedStyle}
              accessibilityLabel="Campus Maracanã, norte para cima, ruas e entradas"
              targets={targets.map(({ p, screen: [x, y], width }) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`No mapa: ${p.name}`}
                  onPress={() => onSelect(p)}
                  style={[
                    styles.target,
                    {
                      left: Math.max(
                        0,
                        Math.min(size.width - width, x - width / 2),
                      ),
                      top: Math.max(0, Math.min(size.height - 48, y - 24)),
                      width,
                    },
                  ]}
                />
              ))}
            >
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
              {atlas.shapes.map(shape => {
                const selected =
                  shape.id === `bloco-${block}` ||
                  (!!place?.building && shape.id === place.building);
                return (
                  <Path
                    key={shape.id}
                    d={polygon(shape.rings)}
                    fillRule="evenodd"
                    fill={
                      selected
                        ? c.selection
                        : shape.kind === 'lago'
                          ? palette.water
                          : shape.kind === 'patio'
                            ? palette.land
                            : palette.building
                    }
                    stroke={selected ? c.accent : palette.outline}
                    strokeWidth={selected ? 1.8 : 0.7}
                  />
                );
              })}
              {route.length > 1 ? (
                <G>
                  <Path
                    d={line(route)}
                    fill="none"
                    stroke={c.surface}
                    strokeWidth={6}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <Path
                    d={line(route)}
                    fill="none"
                    stroke={c.accent}
                    strokeWidth={3}
                    strokeDasharray="5 4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <Circle
                    cx={screenPoint(route[0])[0]}
                    cy={screenPoint(route[0])[1]}
                    r={4.5}
                    fill={c.surface}
                    stroke={c.accent}
                    strokeWidth={2}
                  />
                </G>
              ) : null}
              {blocks.map(b => (
                <G key={b.id}>
                  <Circle
                    cx={b.screen[0]}
                    cy={b.screen[1]}
                    r={10}
                    fill={block === b.id ? c.fill : c.surface}
                    stroke={block === b.id ? c.onFill : c.ruleStrong}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={b.screen[0]}
                    y={b.screen[1] + 4}
                    {...textStyle}
                    fontSize={12}
                    fill={block === b.id ? c.onFill : c.accent}
                  >
                    {b.id}
                  </SvgText>
                </G>
              ))}
              {streetLabels.map(({ name, text, angle, x, y }) => {
                return (
                  <G key={name} transform={`rotate(${angle} ${x} ${y})`}>
                    {text.map((part, index) => (
                      <G key={part}>
                        <SvgText
                          x={x}
                          y={y + (index - (text.length - 1) / 2) * 12 + 3}
                          {...textStyle}
                          fontSize={10}
                          stroke={palette.ground}
                          strokeWidth={3}
                          strokeLinejoin="round"
                        >
                          {part}
                        </SvgText>
                        <SvgText
                          x={x}
                          y={y + (index - (text.length - 1) / 2) * 12 + 3}
                          {...textStyle}
                          fontSize={10}
                        >
                          {part}
                        </SvgText>
                      </G>
                    ))}
                  </G>
                );
              })}
              {essentialMarkers.map(p => {
                const [x, y] = screenPoint(p.point);
                return (
                  <Circle
                    key={`marker-${p.id}`}
                    cx={x}
                    cy={y}
                    r={3.8}
                    fill={c.inkMuted}
                    stroke={c.surface}
                    strokeWidth={1.5}
                  />
                );
              })}
              {labels.map(label => (
                <G key={label.id}>
                  {Math.hypot(
                    label.x + label.width / 2 - label.anchor[0],
                    label.y + label.height / 2 - label.anchor[1],
                  ) > 18 ? (
                    <Path
                      d={`M${label.anchor.join(' ')}L${label.x + label.width / 2} ${label.y + label.height / 2}`}
                      stroke={c.fieldBorder}
                      strokeWidth={1}
                    />
                  ) : null}
                  {!essentialPlaces.includes(label.id) &&
                  (label.place?.category === 'portoes' ||
                    label.place?.category === 'transporte' ||
                    label.selected) ? (
                    <Circle
                      cx={label.anchor[0]}
                      cy={label.anchor[1]}
                      r={3.8}
                      fill={label.selected ? c.fill : c.inkMuted}
                      stroke={c.surface}
                      strokeWidth={1.5}
                    />
                  ) : null}
                  <Rect
                    x={label.x}
                    y={label.y}
                    width={label.width}
                    height={label.height}
                    rx={3}
                    fill={label.selected ? c.fill : c.surface}
                    fillOpacity={label.selected ? 1 : 0.9}
                  />
                  {label.text.map((t, i) => (
                    <SvgText
                      key={t}
                      x={label.x + label.width / 2}
                      y={label.y + 14 + i * 14}
                      {...textStyle}
                      fill={label.selected ? c.onFill : c.ink}
                    >
                      {t}
                    </SvgText>
                  ))}
                </G>
              ))}
            </MapLayer>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
      <View
        style={[
          styles.toolbar,
          { backgroundColor: c.surface, borderTopColor: c.rule },
        ]}
      >
        <View style={styles.north} pointerEvents="none">
          <Svg width={18} height={24}>
            <Path d="M9 2L3 21L9 16L15 21Z" fill={c.accent} />
          </Svg>
          <Text variant="caption">N</Text>
        </View>
        <View pointerEvents="none" style={styles.scale}>
          <Text variant="caption">{scale} m</Text>
          <Svg width={scale / unit} height={6}>
            <Path
              d={`M0 0V5H${scale / unit}V0`}
              stroke={c.inkMuted}
              strokeWidth={1}
              fill="none"
            />
          </Svg>
        </View>
        <View style={styles.zoom}>
          <IconButton
            icon="add"
            accessibilityLabel="Ampliar mapa"
            onPress={() => setCamera(current => zoomCamera(current, 1.5))}
          />
          <IconButton
            icon="remove"
            accessibilityLabel="Reduzir mapa"
            onPress={() => setCamera(current => zoomCamera(current, 1 / 1.5))}
          />
          <IconButton
            icon="refresh"
            accessibilityLabel="Reenquadrar mapa"
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
  target: { position: 'absolute', width: 48, height: 48 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  north: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scale: { width: 58, gap: 2 },
  zoom: { marginLeft: 'auto', flexDirection: 'row' },
});
