import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import { CampusMap } from '@root/modules/campus-map/application/CampusMap';
import type { Entrance } from '@root/modules/campus-map/domain/types';

const service = new CampusMap(bundledCampusMap);

function orientation(input: string, entrance?: Entrance) {
  const destination = service.locate(input);
  if (destination.kind !== 'room') throw new Error(`Not a room: ${input}`);
  return service.orientation(destination, entrance)!;
}

it('follows the modeled route to 6019 B, including the flat walkway and the last landmark', () => {
  const result = orientation('6019 B');
  expect(result.endpoint).toBe('modeled-door');
  expect(result.room?.recorded).toBe(true);
  expect(result.room?.bounds).toEqual([72.63, 70.1, 78.12, 76.1]);
  expect(result.route).toEqual([
    [102.43, 48.72],
    [110.9, 48.72],
    [110.9, 56.35],
    [70.73, 56.35],
    [70.73, 71.6],
    [72.03, 71.6],
  ]);
  expect(result.steps.map(step => step.title).join(' ')).toContain(
    'vire à direita e siga cerca de 40 m',
  );
  expect(result.steps.map(step => step.title).join(' ')).toContain(
    'No corredor do B, vire à esquerda e siga cerca de 15 m.',
  );
  expect(result.steps.at(-1)?.title).toBe(
    'A 6019 é a 2ª sala à esquerda, depois da escada e dos sanitários.',
  );
  expect(
    result.steps.some(step => step.detail?.includes('passarela é plana')),
  ).toBe(true);
  expect(result.confidence).toContain('numeração');
});

it('uses the official 9023 D door, and distinguishes it from inferred rooms on the same floor', () => {
  const result = orientation('9023 D');
  expect(result.endpoint).toBe('door');
  expect(result.room?.door).toEqual([159.24, 77.67, 159.84, 78.99]);
  expect(result.route.at(-1)).toEqual([159.24, 78.33]);
  expect(result.steps.at(-1)?.title).toBe(
    'A 9023 é a 3ª sala à esquerda, depois da escada e dos sanitários.',
  );
  expect(
    result.floorPlan?.rooms
      .filter(room => room.certainty === 'official' && room.code)
      .map(room => room.code)
      .sort(),
  ).toEqual(['9023', '9024', '9027', '9031', '9032']);
  expect(
    result.floorPlan?.structures.some(
      structure => structure.kind === 'degrau' && structure.line,
    ),
  ).toBe(true);
  expect(orientation('9019 D').endpoint).toBe('modeled-door');
  for (const code of ['9019', '9020']) {
    expect(
      result.floorPlan?.rooms.find(room => room.code === code),
    ).toMatchObject({
      code,
      certainty: 'modeled',
      recorded: false,
    });
  }
});

it('keeps the unknown demo room useful without claiming its door is surveyed', () => {
  const result = orientation('6037 F');
  expect(result.endpoint).toBe('modeled-door');
  expect(result.room?.recorded).toBe(false);
  expect(result.room?.bounds).toEqual([51.31, 0.75, 57.31, 16.35]);
  expect(result.route.at(-1)).toEqual([55.81, 16.95]);
  expect(
    result.steps.some(step => step.title.includes('suba meio andar')),
  ).toBe(true);
  expect(
    result.steps.some(step => step.detail?.includes('5º andar do F')),
  ).toBe(true);
  expect(
    result.floorPlan?.rooms.filter(room => room.code === '6037'),
  ).toHaveLength(1);
});

it.each(['6113 D', '6009 B', '2014 E', '7011 D', '9030 D', 'RAV-62'])(
  'stops the route at the block when %s has no supported room position',
  input => {
    const result = orientation(input);
    expect(result.endpoint).toBe('block');
    expect(result.room).toBeUndefined();
    expect(result.floorPlan).toBeDefined();
    expect(result.steps.at(-1)?.title).toContain('nas placas');
    expect(result.confidence).toContain('posição da sala indisponível');
  },
);

it('locates the library zone without inventing its entrance', () => {
  const result = orientation('6002 C');
  expect(result.endpoint).toBe('zone');
  expect(result.room?.door).toBeUndefined();
  expect(result.route.at(-1)).toEqual([114.43, 58]);
  expect(result.steps.at(-1)?.detail).toContain('Siga as placas até a entrada');
});

it('changes the entry route and instruction without changing the route on the upper floor', () => {
  const metro = orientation('6019 B', 'metro');
  const sfx = orientation('6019 B', 'sfx');
  expect(metro.steps[0].title).toContain('Portão 1');
  expect(sfx.steps[0].title).toContain('Portão 5');
  expect(sfx.steps[1].detail).toContain('Confirme a ligação no térreo');
  expect(metro.entranceRoute).not.toEqual(sfx.entranceRoute);
  const gate = service.atlas.places.find(place => place.id === 'portao-metro')!;
  expect(
    Math.hypot(
      metro.entranceRoute[0][0] - gate.point[0],
      metro.entranceRoute[0][1] - gate.point[1],
    ),
  ).toBeLessThan(0.1);
  expect(sfx.entranceRoute.at(-1)).toEqual([114.24, 6.05]);
  expect(metro.route).toEqual(sfx.route);
});

it('starts the ground-floor route at the main entrance and never draws an upper walkway on the ground floor', () => {
  const ground = orientation('T031 F');
  expect(ground.routeStart).toBe('entrance');
  expect(ground.route[0]).toEqual([114.24, -3.2]);
  const arm = orientation('T019 B');
  expect(arm.route).toEqual([]);
  expect(arm.room).toBeUndefined();
  expect(
    arm.steps.some(step =>
      step.detail?.includes('Confirme o acesso na portaria'),
    ),
  ).toBe(true);
});

it('provides an unambiguous block route before a particular room is selected', () => {
  const place = service.atlas.places.find(item => item.id === 'bloco-e')!;
  const result = service.orientation({ ...place, floor: '11' })!;
  expect(result.endpoint).toBe('block');
  expect(result.route.at(-1)).toEqual([196.865, 56.35]);
  expect(
    result.steps.some(step => step.detail?.includes('Passe pelo Bloco D')),
  ).toBe(true);
  expect(result.floorPlan?.rooms.length).toBeGreaterThan(0);
});

it('retains the measured street centerlines instead of reducing roads to labels', () => {
  expect(service.atlas.streets).toHaveLength(4);
  expect(
    service.atlas.streets.every(
      street =>
        street.lines.length > 0 && street.lines.every(line => line.length >= 2),
    ),
  ).toBe(true);
  expect(
    service.atlas.internalShapes.some(shape => shape.id === 'hall-elevadores'),
  ).toBe(true);
  expect(
    service.atlas.internalShapes.some(
      shape => shape.id === 'corredor-B' && shape.block === 'B',
    ),
  ).toBe(true);
});
