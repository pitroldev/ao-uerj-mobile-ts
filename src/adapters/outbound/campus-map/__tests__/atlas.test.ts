import source from '../../../../../scripts/campus-map/data/esquema-pavilhao.json';
import rooms from '../../../../../scripts/campus-map/data/salas-pavilhao.json';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import {
  mapPoint,
  orientPoint,
  fitCamera,
  zoomCamera,
} from '@root/modules/campus-map/domain/geometry';
import { bundledCampusMap } from '../index';

const service = new CampusMap(bundledCampusMap);
const atlas = service.atlas;

it('retains the measured building dimensions and handedness', () => {
  expect(atlas.blocks.find(b => b.id === 'F')?.bounds).toEqual([
    0, 0, 228.62, 28.68,
  ]);
  const a = atlas.blocks.find(b => b.id === 'A')!;
  const e = atlas.blocks.find(b => b.id === 'E')!;
  expect(mapPoint(a.point)[0]).toBeGreaterThan(mapPoint(e.point)[0]);
  expect(mapPoint([0, 0])[1]).toBeGreaterThan(mapPoint(a.point)[1]);
  expect(atlas.north).toBe(26.04);
});

it('preserves all block outlines from the source, within the 1 mm rounding', () => {
  for (const block of source.blocos) {
    const shape = atlas.shapes.find(s => s.id === block.id)!;
    expect(shape).toBeDefined();
    for (const [x, y] of block.poligono.externo) {
      expect(
        shape.rings[0].some(p => Math.hypot(p[0] - x, p[1] - y) < 0.02),
      ).toBe(true);
    }
  }
});

it('uses an original schematic lake symbol inside the known courtyard', () => {
  const lake = source.agua.find(item => item.id === 'lago-dos-peixinhos')!;
  expect(lake.representacao).toBe('simbolo-esquematico');
  expect(lake).not.toHaveProperty('poligono');
  expect(lake).not.toHaveProperty('dimensoes');
  expect(lake.confianca).toContain('aproximada');

  const courtyard = source.patios.find(item => item.id === lake.patio)!;
  const ring = atlas.shapes.find(item => item.id === lake.id)!.rings[0];
  expect(ring).toHaveLength(8);
  const xs = courtyard.poligono.externo.map(point => point[0]);
  const ys = courtyard.poligono.externo.map(point => point[1]);
  const center = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
  const radii = ring.map(point =>
    Math.hypot(point[0] - center[0], point[1] - center[1]),
  );
  // Equal radii and a convex octagon characterize a generic symbol, not the
  // removed shoreline. Keep it away from the courtyard's surrounding blocks.
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.002);
  for (const [x, y] of ring) {
    expect(x).toBeGreaterThan(39.8);
    expect(x).toBeLessThan(62.69);
    expect(y).toBeGreaterThan(28.68);
    expect(y).toBeLessThan(54.8);
  }
});

it('uses exactly the published rooms and door extents', () => {
  expect(atlas.officialRooms).toHaveLength(5);
  for (const room of atlas.officialRooms) {
    expect(room.bounds).toEqual(
      rooms.oficial_D9.salas.find(r => r.numero === room.code)?.r,
    );
    expect(room.door).toEqual(
      rooms.oficial_D9.portas.find(r => r.rotulo === room.code + 'D')?.r,
    );
    expect(
      service.roomPlan({
        kind: 'room',
        building: 'pjlf',
        code: room.code,
        floor: '9',
        block: 'D',
      }),
    ).toEqual(room);
  }
});

it('never invents a precise room for inferred or conflicting locations', () => {
  for (const input of [
    '6019 B',
    '6113 D',
    '6009 B',
    '7011 D',
    '2014 E',
    '11033 E',
    '9023 B',
  ]) {
    const location = service.locate(input);
    expect(location.kind).toBe('room');
    if (location.kind !== 'room') throw new Error('Expected a room location');
    expect(service.roomPlan(location)).toBeUndefined();
  }
});

it('finds libraries, aliases and categories offline', () => {
  expect(service.search('CTC/A')[0].room).toBe('6002');
  expect(service.search('restaurante')[0].id).toBe('ru');
  expect(service.search('joao lyra')[0].id).toBe('pjlf');
  expect(service.search('', 'portoes').map(p => p.name)).not.toContain(
    'Portão 2',
  );
  expect(service.search('sem-resultado')).toEqual([]);
  expect(
    atlas.places.every(p => p.sources.length && p.point.every(Number.isFinite)),
  ).toBe(true);
});

it('fits geometry at phone sizes without stretching it, and bounds zoom', () => {
  for (const width of [320, 360, 390]) {
    const camera = fitCamera(atlas.campus, width, 300);
    expect(camera.width / camera.height).toBeCloseTo(width / 300);
    for (const point of atlas.campus.map(mapPoint)) {
      expect(point[0]).toBeGreaterThanOrEqual(camera.x);
      expect(point[0]).toBeLessThanOrEqual(camera.x + camera.width);
      expect(point[1]).toBeGreaterThanOrEqual(camera.y);
      expect(point[1]).toBeLessThanOrEqual(camera.y + camera.height);
    }
    expect(zoomCamera(camera, 1000).width).toBe(18);
    expect(zoomCamera(camera, 0.001).width).toBe(1400);
  }
});

it('keeps streets and stations in the north-up campus frame without changing distances', () => {
  const points = [
    ...atlas.campus,
    ...atlas.streets.map(s => s.point),
    ...atlas.places.filter(p => p.category === 'transporte').map(p => p.point),
  ];
  for (const [width, height] of [
    [320, 300],
    [390, 360],
  ]) {
    const camera = fitCamera(points, width, height, 38, atlas.north);
    for (const point of points) {
      const [x, y] = orientPoint(point, atlas.north);
      expect(x).toBeGreaterThan(camera.x);
      expect(x).toBeLessThan(camera.x + camera.width);
      expect(y).toBeGreaterThan(camera.y);
      expect(y).toBeLessThan(camera.y + camera.height);
    }
  }
  const origin = orientPoint([0, 0], atlas.north);
  const east = orientPoint([100, 0], atlas.north);
  expect(Math.hypot(east[0] - origin[0], east[1] - origin[1])).toBeCloseTo(100);
});
