import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import type { AnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from 'styled-components/native';
import { IconButton, OUTLINED_GLYPHS, Text } from '@components/ui';
import {
  fitCamera,
  orientPoint,
  zoomCamera,
  type Camera,
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
import { campusGeometry, worldPath } from './campusGeometry';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { MapLayer } from './MapLayer';
import { useMapCamera } from './useMapCamera';
import { usePlotSize } from './usePlotSize';

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
  /**
   * Muda com a seleção: a câmera volta ao enquadramento inicial, e o desenho
   * é atualizado no lugar (com `key`, cada toque desmontava e recriava
   * centenas de views nativas).
   */
  resetKey?: string;
};

export const CampusCanvas = React.memo(function CampusCanvas(props: Props) {
  if (props.view === 'floor' && props.block && props.floor) {
    return (
      <FloorPlanCanvas
        atlas={props.atlas}
        block={props.block}
        floor={props.floor}
        destination={props.destination}
        orientation={props.orientation}
        resetKey={props.resetKey}
      />
    );
  }
  return <CampusOverview {...props} />;
});

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
/** Lado do marcador de ponto de ônibus, em dp. */
const STOP_SIZE = 15;
/** Antes da primeira medida, só para a câmera ter um formato. */
const UNMEASURED = { width: 390, height: 430 };
const NO_ROUTE: Point[] = [];
/** O nome da rua em linhas de até 9 letras ("R. São", "Francisco", "Xavier"). */
function narrowStreet(lines: string[]) {
  const out: string[] = [];
  for (const word of lines.join(' ').split(' ')) {
    const last = out.at(-1);
    if (last && `${last} ${word}`.length <= 9)
      out[out.length - 1] += ` ${word}`;
    else out.push(word);
  }
  return out;
}
/** Deslocamentos do nome da rua ao longo dela: 0, -16, 16… até ±112 dp. */
const ALONG_ROAD = [
  0,
  ...Array.from({ length: 7 }, (_, i) => (i + 1) * 16),
].flatMap(step => (step ? [-step, step] : [0]));
/**
 * O rótulo do ponto no mapa, sem o "Ponto" (o marcador já diz) e em linhas
 * curtas: "Ponto Radialista Waldir Amaral" vira "Radialista" e "Waldir
 * Amaral"; o "BRS 5, 6" fica numa linha só dele.
 */
function stopLabel(name: string) {
  const [stop, ...rest] = name.replace(/^Ponto /, '').split(' · ');
  const lines: string[] = [];
  for (const word of stop.split(' ')) {
    const last = lines.at(-1);
    if (last && `${last} ${word}`.length <= 16)
      lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return [...lines, ...rest];
}
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

function CampusOverview({
  atlas,
  place,
  block,
  orientation,
  onSelect,
  resetKey = '',
}: Props) {
  const theme = useTheme(),
    c = theme.colors;
  const palette = theme.campusMap;
  const [plotRef, plotSize, onPlotLayout] = usePlotSize();
  const size = plotSize ?? UNMEASURED;
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
    resetKey: `${resetKey}|${size.width}:${size.height}`,
    minWidth: 18,
    maxWidth: 1400,
    positionLimit: 900,
  });
  const unit = camera.width / size.width;
  const scale = [100, 50, 20, 10, 5, 2, 1].find(n => n / unit <= 58) ?? 1;

  return (
    <View
      style={[styles.canvas, { backgroundColor: palette.ground }]}
      testID="campus-canvas"
    >
      <GestureHandlerRootView
        style={styles.plot}
        testID="campus-map-plot"
        onLayout={onPlotLayout}
      >
        <GestureDetector gesture={gesture}>
          <View
            ref={plotRef}
            style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
            collapsable={false}
          >
            {plotSize ? (
              <CampusDrawing
                atlas={atlas}
                place={place}
                block={block}
                orientation={orientation}
                onSelect={onSelect}
                camera={camera}
                width={size.width}
                height={size.height}
                animatedStyle={animatedStyle}
              />
            ) : null}
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

type GeometryProps = {
  atlas: CampusAtlas;
  /** Metros por dp: só os traços (em dp na tela) dependem do zoom. */
  unit: number;
  block?: Block;
  building?: string;
  route: readonly Point[];
};

/**
 * Ruas, terreno, caminhos, prédios e o trajeto de entrada, em metros. A
 * câmera é a transformação do grupo em volta: um pan não muda nenhuma prop
 * daqui (o React nem compara os ~85 caminhos), e o nativo guarda os
 * contornos já calculados. O zoom troca só as espessuras.
 */
const CampusGeometryLayer = React.memo(function CampusGeometryLayer({
  atlas,
  unit,
  block,
  building,
  route,
}: GeometryProps) {
  const theme = useTheme(),
    c = theme.colors;
  const palette = theme.campusMap;
  const geometry = campusGeometry(atlas);
  const routePath =
    route.length > 1 ? worldPath(route, atlas.north) : undefined;
  const start = route.length > 1 ? orientPoint(route[0], atlas.north) : null;
  return (
    <>
      {geometry.streets.map(street => (
        <React.Fragment key={street.key}>
          <Path
            d={street.d}
            fill="none"
            stroke={palette.streetEdge}
            strokeWidth={18 + 2 * unit}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={street.d}
            fill="none"
            stroke={palette.street}
            strokeWidth={18}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </React.Fragment>
      ))}
      <Path
        d={geometry.campus}
        fill={palette.land}
        stroke={palette.outline}
        strokeWidth={unit}
      />
      {geometry.paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={palette.street}
          strokeWidth={4 * unit}
          fill="none"
          strokeLinecap="round"
        />
      ))}
      {geometry.shapes.map(shape => {
        const selected =
          shape.id === `bloco-${block}` ||
          (!!building && shape.id === building);
        return (
          <Path
            key={shape.id}
            d={shape.d}
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
            strokeWidth={(selected ? 1.8 : 0.7) * unit}
          />
        );
      })}
      {routePath && start ? (
        <>
          <Path
            d={routePath}
            fill="none"
            stroke={c.surface}
            strokeWidth={6 * unit}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Path
            d={routePath}
            fill="none"
            stroke={c.accent}
            strokeWidth={3 * unit}
            strokeDasharray={`${5 * unit} ${4 * unit}`}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Circle
            cx={start[0]}
            cy={start[1]}
            r={4.5 * unit}
            fill={c.surface}
            stroke={c.accent}
            strokeWidth={2 * unit}
          />
        </>
      ) : null}
    </>
  );
});

type DrawingProps = Pick<
  Props,
  'atlas' | 'place' | 'block' | 'orientation' | 'onSelect'
> & {
  camera: Camera;
  width: number;
  height: number;
  animatedStyle: AnimatedStyle<ViewStyle>;
};

/** O desenho do campus: só existe depois de a área ter medida. */
function CampusDrawing({
  atlas,
  place,
  block,
  orientation,
  onSelect,
  camera,
  width,
  height,
  animatedStyle,
}: DrawingProps) {
  const theme = useTheme(),
    c = theme.colors;
  const palette = theme.campusMap;
  const unit = camera.width / width;
  const screenPoint = (point: Point): Point => {
    const [x, y] = orientPoint(point, atlas.north);
    return [(x - camera.x) / unit, (y - camera.y) / unit];
  };
  const visible = ([x, y]: Point, margin = 0) =>
    x >= margin && y >= margin && x <= width - margin && y <= height - margin;
  const textStyle = {
    fontFamily: theme.fonts.semibold,
    fontSize: 11,
    textAnchor: 'middle' as const,
    fill: c.inkMuted,
  };

  const occupied: LabelBox[] = [];
  const streetBoxes = new Set<LabelBox>();
  // Os marcadores entram antes dos nomes das ruas, que desviam deles.
  const essentialMarkers = atlas.places.filter(p =>
    essentialPlaces.includes(p.id),
  );
  for (const p of essentialMarkers) {
    const [x, y] = screenPoint(p.point);
    occupied.push({ x: x - 6, y: y - 6, width: 12, height: 12 });
  }
  // Pontos de ônibus: o marcador com o ônibus, sem rótulo (só o escolhido)
  const stops = atlas.places
    .filter(p => p.busStop)
    .map(p => ({ p, screen: screenPoint(p.point) }))
    .filter(({ screen }) => visible(screen, -STOP_SIZE));
  for (const { screen } of stops)
    occupied.push({
      x: screen[0] - STOP_SIZE / 2,
      y: screen[1] - STOP_SIZE / 2,
      width: STOP_SIZE,
      height: STOP_SIZE,
    });
  const streetLabels = atlas.streets.flatMap(street => {
    const [px, py] = screenPoint(street.point);
    if (!visible([px, py])) return [];
    const raw = street.angle + atlas.north;
    const angle = raw > 90 ? raw - 180 : raw < -90 ? raw + 180 : raw;
    const wide = streetLines[street.name] ?? [street.name];
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians),
      sin = Math.sin(radians);
    // Move along the road before using a small perpendicular offset. The
    // bus stops sit on the roads: between them, a narrower name in more
    // lines; only then beside the road.
    const attempts: [string[], number[]][] = [
      [wide, [0, -14, 14]],
      [narrowStreet(wide), [0, -14, 14]],
      [wide, [-28, 28]],
    ];
    for (const [text, normals] of attempts) {
      const textWidth = Math.max(...text.map(t => t.length)) * 5.3;
      const textHeight = text.length * 12;
      const bx =
        (Math.abs(textWidth * cos) + Math.abs(textHeight * sin)) / 2 + 4;
      const by =
        (Math.abs(textWidth * sin) + Math.abs(textHeight * cos)) / 2 + 4;
      for (const normal of normals) {
        for (const along of ALONG_ROAD) {
          const x = px + cos * along - sin * normal;
          const y = py + sin * along + cos * normal;
          if (
            x - bx < 4 ||
            y - by < 4 ||
            x + bx > width - 4 ||
            y + by > height - 4
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
          for (const box of boxes) streetBoxes.add(box);
          occupied.push(...boxes);
          return [{ name: street.name, text, angle, x, y }];
        }
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
  const route = orientation?.entranceRoute ?? NO_ROUTE;
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
    let text = poiNames[p.id] ?? (p.busStop ? stopLabel(p.name) : [p.name]);
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
    // the chosen place may cover a street name, never a marker or a block
    const passes =
      p.id === place?.id
        ? [occupied, occupied.filter(r => !streetBoxes.has(r))]
        : [occupied];
    for (const blocking of passes) {
      for (const variant of variants) {
        const labelWidth = Math.max(...variant.map(t => t.length)) * 5.9 + 12;
        const labelHeight = variant.length * 14 + 8;
        for (const [dx, dy] of offsets) {
          const next = {
            x: Math.max(
              6,
              Math.min(width - labelWidth - 6, anchor[0] + dx - labelWidth / 2),
            ),
            y: Math.max(
              6,
              Math.min(
                height - labelHeight - 6,
                anchor[1] + dy - labelHeight / 2,
              ),
            ),
            width: labelWidth,
            height: labelHeight,
          };
          if (!blocking.some(r => overlaps(next, r))) {
            rect = next;
            text = variant;
            break;
          }
        }
        if (rect) break;
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
  const labelled = new Set(labels.map(label => label.id));
  const targets = [
    // os pontos ficam por baixo: o bloco e os rótulos ganham o toque
    ...stops
      .filter(({ p }) => !labelled.has(p.id))
      .map(({ p, screen }) => ({ p, screen, width: 32 })),
    ...blockTargets.map(p => ({ p, screen: screenPoint(p.point), width: 48 })),
    ...labels.map(label => ({
      p: label.place!,
      screen: [label.x + label.width / 2, label.y + label.height / 2] as Point,
      width: Math.max(48, label.width),
    })),
  ].filter(t => visible(t.screen));
  const glyph = STOP_SIZE - 5;

  return (
    <MapLayer
      camera={camera}
      width={width}
      height={height}
      projection="screen"
      animatedStyle={animatedStyle}
      accessibilityLabel="Campus Maracanã, norte para cima, ruas e entradas"
      targets={targets.map(({ p, screen: [x, y], width: targetWidth }) => (
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
                Math.min(width - targetWidth, x - targetWidth / 2),
              ),
              top: Math.max(0, Math.min(height - 48, y - 24)),
              width: targetWidth,
            },
          ]}
        />
      ))}
    >
      <G
        transform={`matrix(${1 / unit} 0 0 ${1 / unit} ${-camera.x / unit} ${-camera.y / unit})`}
      >
        <CampusGeometryLayer
          atlas={atlas}
          unit={unit}
          block={block}
          building={place?.building}
          route={route}
        />
      </G>
      {blocks.map(b => (
        <React.Fragment key={b.id}>
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
        </React.Fragment>
      ))}
      {streetLabels.map(({ name, text, angle, x, y }) => {
        return (
          <G key={name} transform={`rotate(${angle} ${x} ${y})`}>
            {text.map((part, index) => (
              <React.Fragment key={part}>
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
              </React.Fragment>
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
      {stops.map(({ p, screen: [x, y] }) => {
        const selected = p.id === place?.id;
        return (
          <React.Fragment key={`stop-${p.id}`}>
            <Rect
              x={x - STOP_SIZE / 2}
              y={y - STOP_SIZE / 2}
              width={STOP_SIZE}
              height={STOP_SIZE}
              rx={3.5}
              fill={selected ? c.fill : c.surface}
              stroke={selected ? c.onFill : c.accent}
              strokeWidth={1.2}
            />
            <Path
              d={OUTLINED_GLYPHS.directions_bus}
              fill={selected ? c.onFill : c.accent}
              transform={`translate(${x - glyph / 2} ${y + glyph / 2}) scale(${glyph / 960})`}
            />
          </React.Fragment>
        );
      })}
      {labels.map(label => (
        <React.Fragment key={label.id}>
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
          !label.place?.busStop &&
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
        </React.Fragment>
      ))}
    </MapLayer>
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
