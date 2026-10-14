import type { Bounds, Point } from './types';

/** A rotation, never a mirror: F at the bottom and A on the right. */
export function mapPoint([x, y]: Point): Point {
  return [228.62 - x, 94.8 - y];
}

/** Rotate the pavilion-aligned drawing to true north for the campus view. */
export function orientPoint(point: Point, rotation: number): Point {
  const [px, py] = mapPoint(point);
  if (!rotation) return [px, py];
  const radians = (rotation * Math.PI) / 180;
  return [
    114.31 +
      (px - 114.31) * Math.cos(radians) -
      (py - 47.4) * Math.sin(radians),
    47.4 + (px - 114.31) * Math.sin(radians) + (py - 47.4) * Math.cos(radians),
  ];
}

export function rectangleRing([x1, y1, x2, y2]: Bounds): Point[] {
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

export type Camera = { x: number; y: number; width: number; height: number };

export function fitCamera(
  points: readonly Point[],
  width: number,
  height: number,
  padding = 20,
  rotation = 0,
): Camera {
  const mapped = points.map(point => orientPoint(point, rotation));
  const xs = mapped.map(p => p[0]),
    ys = mapped.map(p => p[1]);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  const w = Math.max(...xs) - left,
    h = Math.max(...ys) - top;
  const ratio = Math.max(width, 1) / Math.max(height, 1);
  const fw = Math.max(w + padding * 2, (h + padding * 2) * ratio);
  const fh = fw / ratio;
  return {
    x: left + w / 2 - fw / 2,
    y: top + h / 2 - fh / 2,
    width: fw,
    height: fh,
  };
}

export function zoomCamera(camera: Camera, factor: number): Camera {
  const width = Math.max(18, Math.min(1400, camera.width / factor));
  const height = (width * camera.height) / camera.width;
  return {
    x: camera.x + (camera.width - width) / 2,
    y: camera.y + (camera.height - height) / 2,
    width,
    height,
  };
}
