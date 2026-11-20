import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import {
  fitCamera,
  orientPoint,
} from '@root/modules/campus-map/domain/geometry';
import type { Point } from '@root/modules/campus-map/domain/types';
import { campusGeometry, worldPath } from '../campusGeometry';

const atlas = bundledCampusMap.read();

/** Os pontos de um traçado "M x y L x y …". */
const points = (d: string) =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(
    ([, x, y]) => [Number(x), Number(y)] as Point,
  );

it('builds the campus drawing once per atlas', () => {
  const geometry = campusGeometry(atlas);
  expect(campusGeometry(atlas)).toBe(geometry);
  expect(geometry.streets).toHaveLength(
    atlas.streets.reduce((total, street) => total + street.lines.length, 0),
  );
  expect(geometry.paths).toHaveLength(atlas.paths.length);
  expect(geometry.shapes.map(shape => shape.id)).toEqual(
    atlas.shapes.map(shape => shape.id),
  );
  expect(geometry.campus.endsWith('Z')).toBe(true);
});

it('writes metres with the north up, to the millimetre', () => {
  const ring = atlas.campus;
  const drawn = points(worldPath(ring, atlas.north, true));
  expect(drawn).toHaveLength(ring.length);
  ring.forEach((point, index) => {
    const [x, y] = orientPoint(point, atlas.north);
    expect(Math.abs(drawn[index][0] - x)).toBeLessThanOrEqual(0.0005);
    expect(Math.abs(drawn[index][1] - y)).toBeLessThanOrEqual(0.0005);
  });
  // sem o ruído de ponto flutuante no texto que o nativo lê
  expect(campusGeometry(atlas).campus).not.toMatch(/\.\d{4}/);
});

it('lands on the same screen point as the old per-camera coordinates', () => {
  // a câmera é a transformação do grupo: (x - camera.x) / unit
  for (const [width, height, zoom] of [
    [412, 540, 1],
    [320, 244, 8],
    [390, 430, 0.4],
  ]) {
    const fitted = fitCamera(atlas.campus, width, height, 38, atlas.north);
    const camera = {
      x: fitted.x + 13.7,
      y: fitted.y - 5.2,
      width: fitted.width / zoom,
      height: fitted.height / zoom,
    };
    const unit = camera.width / width;
    const shape = atlas.shapes[0];
    const drawn = points(campusGeometry(atlas).shapes[0].d);
    shape.rings.flat().forEach((point, index) => {
      const [x, y] = orientPoint(point, atlas.north);
      const before = [(x - camera.x) / unit, (y - camera.y) / unit];
      const after = [
        drawn[index][0] / unit - camera.x / unit,
        drawn[index][1] / unit - camera.y / unit,
      ];
      // menos de dois centésimos de dp, mesmo no zoom mais fechado
      expect(Math.abs(after[0] - before[0])).toBeLessThan(0.02);
      expect(Math.abs(after[1] - before[1])).toBeLessThan(0.02);
    });
  }
});
