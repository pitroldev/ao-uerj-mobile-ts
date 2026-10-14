import type {
  Block,
  Bounds,
  CampusAtlas,
  FloorRoom,
  Point,
} from '@root/modules/campus-map/domain/types';

export type FloorSegment = { x0: number; x1: number; left: number };
export type FloorLayout = {
  segments: FloorSegment[];
  width: number;
  height: number;
  top: number;
  bottom: number;
  gap?: { left: number; right: number; metres: number; y: number };
  key: { x: number; y: number; width: number };
};

/** Sections of the measured atlas: one scale, one orientation, explicit cuts. */
export function floorLayout(
  atlas: CampusAtlas,
  block: Block,
  room?: FloorRoom,
): FloorLayout {
  const bounds = atlas.blocks.find(item => item.id === block)!.bounds;
  let spans: [number, number][];
  let top = 98;
  let bottom = 36;
  let key = { x: 1, y: 1, width: 21 };
  if ('ABDE'.includes(block)) {
    const arm: [number, number] = [
      bounds[0] - 0.8,
      bounds[0] + bounds[2] + 0.8,
    ];
    const right = bounds[0] < 114.43;
    const hall: [number, number] = right ? [91.8, 113.5] : [115.2, 137.1];
    spans = right ? [hall, arm] : [arm, hall];
    key = { x: right ? 1 : arm[1] - arm[0] + 5, y: 1, width: 21 };
  } else if (block === 'F') {
    top = 54.5;
    bottom = -4;
    const x = room?.corridorPoint?.[0] ?? 114.31;
    const hall: [number, number] = [106.1, 122.5];
    if (Math.abs(x - 114.31) < 20) {
      const center = (x + 114.31) / 2;
      spans = [[center - 30, center + 30]];
      key = { x: x < 114.31 ? 35 : 1, y: 1, width: 24 };
    } else {
      const left = Math.max(-0.8, Math.min(193.4, x - 18));
      const local: [number, number] = [left, left + 36];
      spans = x < 114.31 ? [hall, local] : [local, hall];
      key = { x: x < 114.31 ? 22 : 1, y: 1, width: 30 };
    }
  } else {
    top = 90;
    bottom = 36;
    spans = [[91.2, 137.7]];
    key = { x: 1, y: 1, width: 24 };
  }
  let left = 1;
  const segments = spans.map(([x0, x1]) => {
    const segment = { x0, x1, left };
    left += x1 - x0 + 4;
    return segment;
  });
  const gap =
    segments.length === 2
      ? {
          left: segments[0].left + segments[0].x1 - segments[0].x0,
          right: segments[1].left,
          metres: Math.max(0, segments[0].x0 - segments[1].x1),
          y: block === 'F' ? 18.35 : 56.35,
        }
      : undefined;
  return {
    segments,
    width: left - 3,
    height: top - bottom,
    top,
    bottom,
    gap,
    key,
  };
}

export function floorPoint(
  point: Point,
  segment: FloorSegment,
  top: number,
): Point {
  return [segment.left + segment.x1 - point[0], top - point[1]];
}

export function floorPath(
  points: readonly Point[],
  segment: FloorSegment,
  top: number,
  closed = false,
) {
  return (
    points
      .map(
        (point, index) =>
          `${index ? 'L' : 'M'}${floorPoint(point, segment, top).join(' ')}`,
      )
      .join(' ') + (closed ? 'Z' : '')
  );
}

/** Inter glyph widths measured in em, with a bold-width allowance. */
export function floorTextWidth(text: string, fontSize: number) {
  const widths: Record<string, number> = {
    '0': 0.66,
    '1': 0.42,
    '2': 0.62,
    '3': 0.64,
    '4': 0.67,
    '5': 0.61,
    '6': 0.64,
    '7': 0.58,
    '8': 0.64,
    '9': 0.64,
    T: 0.66,
    S: 0.65,
    E: 0.61,
  };
  return (
    text
      .split('')
      .reduce((total, character) => total + (widths[character] ?? 0.66), 0) *
    1.03 *
    fontSize
  );
}

/** Reserve screen-space padding, not metres; small rooms keep their numerals. */
export function roomFontSize(
  code: string,
  bounds: Bounds,
  unit: number,
  rotated: boolean,
) {
  const width = bounds[2] - bounds[0];
  const height = bounds[3] - bounds[1];
  const along = rotated ? height : width;
  const across = rotated ? width : height;
  return Math.max(
    0,
    Math.min(
      12 * unit,
      (along - 3 * unit) / floorTextWidth(code, 1),
      across - 1.5 * unit,
    ),
  );
}
