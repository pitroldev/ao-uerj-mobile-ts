import { bundledCampusMap } from '@root/adapters/outbound/campus-map';
import { leeRoom } from '@root/modules/campus-map/domain/labs';
import { orient } from '@root/modules/campus-map/domain/orientation';

const atlas = bundledCampusMap.read();
const room = (number: number) => leeRoom(atlas, number, `LEE ${number}`);
const modelOf = (code: string) => {
  const plan = atlas.floorPlans.find(p => p.block === 'F' && p.floor === '5')!;
  return atlas.roomModels[plan.positions[String(Number(code.slice(1)))]];
};

it('starts the LEE at 5116 F, the door the extension guides give', () => {
  expect(room(1)).toEqual({
    kind: 'room',
    building: 'pjlf',
    code: '5116',
    floor: '5',
    block: 'F',
    name: 'LEE 1',
  });
});

it('walks the corridor toward block E, one room after the other, on both sides', () => {
  const rooms = Array.from({ length: 13 }, (_, i) => room(i + 1)!);
  const models = rooms.map(item => modelOf(item.code));
  // um LEE por sala: nenhuma sala repetida
  expect(new Set(rooms.map(item => item.code)).size).toBe(13);
  // os números das portas sobem com o LEE
  const numbers = rooms.map(item => Number(item.code));
  expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  // os dois lados, alternando depois do LEE 1
  expect(models.slice(1, 5).map(model => model.side)).toEqual([
    'esquerda',
    'direita',
    'esquerda',
    'direita',
  ]);
  // e sempre para o lado do E (x cresce, nunca volta)
  const xs = models.map(model => model.bounds[0]);
  expect(xs.every((x, i) => i === 0 || x >= xs[i - 1])).toBe(true);
});

it('names the room in the directions instead of a door number', () => {
  const lee9 = leeRoom(atlas, 9, 'LEE 09')!;
  const orientation = orient(atlas, lee9)!;
  expect(orientation.room?.code).toBe('LEE 09');
  expect(orientation.confidence).toBe(
    'Pela ordem dos laboratórios · confira a porta',
  );
  expect(orientation.steps.at(-1)?.title).toMatch(/^O LEE 09 é a \dª sala à /);
});

it('has no room past the end of the floor', () => {
  expect(room(0)).toBeUndefined();
  expect(room(60)).toBeUndefined();
});
