import { orientPoint } from '@root/modules/campus-map/domain/geometry';
import type { CampusAtlas, Point } from '@root/modules/campus-map/domain/types';

/** Milímetros: menos de dois centésimos de dp no zoom máximo. */
const mm = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Um traçado do atlas em metros, com o norte para cima: o desenho do campus
 * não depende da câmera, que entra como a transformação do grupo.
 */
export function worldPath(
  points: readonly Point[],
  north: number,
  closed = false,
) {
  return (
    points
      .map((point, index) => {
        const [x, y] = orientPoint(point, north);
        return `${index ? 'L' : 'M'}${mm(x)} ${mm(y)}`;
      })
      .join(' ') + (closed ? 'Z' : '')
  );
}

export type CampusGeometry = {
  /** Cada pista de rua: a borda e o leito usam o mesmo traçado. */
  streets: { key: string; d: string }[];
  campus: string;
  paths: string[];
  shapes: { id: string; kind: string; d: string }[];
};

const cache = new WeakMap<CampusAtlas, CampusGeometry>();

/**
 * Os traçados da vista do campus, calculados uma vez por atlas. Antes, cada
 * pan, zoom ou seleção reescrevia os ~600 pontos em coordenadas de tela, e o
 * nativo relia e recalculava cada caminho.
 */
export function campusGeometry(atlas: CampusAtlas): CampusGeometry {
  const cached = cache.get(atlas);
  if (cached) return cached;
  const polygon = (rings: readonly (readonly Point[])[]) =>
    rings.map(ring => worldPath(ring, atlas.north, true)).join(' ');
  const geometry: CampusGeometry = {
    streets: atlas.streets.flatMap(street =>
      street.lines.map((points, index) => ({
        key: `${street.name}-${index}`,
        d: worldPath(points, atlas.north),
      })),
    ),
    campus: polygon([atlas.campus]),
    paths: atlas.paths.map(points => worldPath(points, atlas.north)),
    shapes: atlas.shapes.map(shape => ({
      id: shape.id,
      kind: shape.kind,
      d: polygon(shape.rings),
    })),
  };
  cache.set(atlas, geometry);
  return geometry;
}
