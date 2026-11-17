import type { CampusAtlas, RoomLocation } from './types';

/** A porta do LEE nos Guias de Ramais de 2018 a 2024 ("LEE · Sala 5116 F"). */
const LEE_FIRST = 116;

/**
 * A sala do LEE `number` (Laboratórios de Engenharia Elétrica). Cada LEE é
 * uma sala; o LEE 1 é a 5116 F, e os seguintes vêm pelo corredor do 5º
 * andar do F, rumo ao Bloco E, alternando os lados, uma sala depois da
 * outra (regra contada por um aluno em 17/11/2026). A porta de cada LEE não
 * tem fonte pública: a posição é a do modelo do andar, e o mapa diz isso.
 */
export function leeRoom(
  atlas: CampusAtlas,
  number: number,
  name: string,
): RoomLocation | undefined {
  const plan = atlas.floorPlans.find(p => p.block === 'F' && p.floor === '5');
  if (!plan || !Number.isInteger(number) || number < 1) return undefined;
  // uma entrada por sala física: o modelo dá dois números à mesma sala (as
  // portas de um lado do módulo) e salas sobrepostas perto da rampa do E
  const rooms = new Map<string, { index: number; x: number; left: boolean }>();
  const numbered = Object.entries(plan.positions)
    .map(([index, id]) => [Number(index), id] as const)
    .filter(([index]) => index >= LEE_FIRST)
    .sort((a, b) => a[0] - b[0]);
  for (const [index, id] of numbered) {
    const model = atlas.roomModels[id];
    if (!model) continue;
    const x = Math.round(model.bounds[0]);
    const left = model.side === 'esquerda';
    const key = `${left}:${x}`;
    if (!rooms.has(key)) rooms.set(key, { index, x, left });
  }
  // pelo corredor: módulo a módulo, a sala da esquerda e depois a da direita
  const ordered = [...rooms.values()].sort(
    (a, b) => a.x - b.x || Number(b.left) - Number(a.left),
  );
  const room = ordered[number - 1];
  if (!room) return undefined;
  return {
    kind: 'room',
    building: 'pjlf',
    code: `5${String(room.index).padStart(3, '0')}`,
    floor: '5',
    block: 'F',
    name,
  };
}
