import { floorLabel } from './parseLocation';
import type {
  Block,
  CampusAtlas,
  Entrance,
  Floor,
  FloorPlan,
  FloorRoom,
  MapOrientation,
  Place,
  Point,
  RoomLocation,
  RoomModel,
} from './types';

const HALL: Point = [114.43, 48.72];
const ENTRY: Point = [114.24, 6.05];
const PASSAGE_Y = 56.35;
const AXES: Partial<Record<Block, number>> = {
  A: 31.65,
  B: 70.73,
  D: 157.935,
  E: 196.865,
};

function roomCode(floor: Floor, index: number | null) {
  return index == null ? '' : `${floor}${String(index).padStart(3, '0')}`;
}

function planRoom(model: RoomModel, code: string): FloorRoom {
  return {
    code,
    bounds: model.bounds,
    polygon: model.polygon,
    door: model.door,
    doorPoint: model.doorPoint,
    corridorPoint: model.corridorPoint,
    labelPoint: model.labelPoint,
    recorded: model.recorded,
    certainty: model.certainty,
  };
}

function distance(metres: number) {
  return metres < 8
    ? 'poucos metros'
    : `cerca de ${Math.round(metres / (metres < 30 ? 5 : 10)) * (metres < 30 ? 5 : 10)} m`;
}

function blockRoute(block: Block, floor?: Floor): Point[] {
  if (!floor || floor === 'T' || floor === 'SE') return [];
  if (block === 'C') return [HALL, [HALL[0], PASSAGE_Y]];
  if (block === 'F') return [HALL, [114.31, HALL[1]], [114.31, 18.35]];
  const x = AXES[block]!;
  const right = x < HALL[0];
  const turn = right ? 110.9 : 117.95;
  return [
    [right ? 102.43 : 126.43, HALL[1]],
    [turn, HALL[1]],
    [turn, PASSAGE_Y],
    [x, PASSAGE_Y],
  ];
}

/** The exterior portion ends at the entrance: it is not a surveyed indoor route. */
function entranceRoute(atlas: CampusAtlas, entrance: Entrance): Point[] {
  const gate = atlas.places.find(
    p => p.id === (entrance === 'metro' ? 'portao-metro' : 'portao-sfx'),
  );
  if (!gate) return [];
  if (entrance === 'sfx') return [gate.point, ENTRY];
  const passage = atlas.paths.find(points =>
    points.some(
      p => Math.hypot(p[0] - gate.point[0], p[1] - gate.point[1]) < 2,
    ),
  );
  if (!passage) return [];
  const end = passage.findIndex(
    p => Math.hypot(p[0] - gate.point[0], p[1] - gate.point[1]) < 2,
  );
  return passage.slice(0, end + 1).reverse();
}

function confidence(model?: RoomModel, hasRoom = false): string {
  if (!model)
    return hasRoom
      ? 'Trajeto até o bloco · posição da sala indisponível'
      : 'Corredores e passarelas do pavilhão';
  if (model.certainty === 'official') return 'Sala e porta · DAENG 2024';
  if (model.certainty === 'zone') return 'Área da biblioteca · siga as placas';
  if (model.alternatives)
    return model.alternatives > 1
      ? 'Pela numeração · confira também as portas vizinhas'
      : 'Pela numeração · a porta pode estar 3 m antes';
  return 'Posição pela numeração · confira a porta';
}

/** Orientation uses the generated atlas and preserves each source's limits. */
export function orient(
  atlas: CampusAtlas,
  destination: RoomLocation | Place,
  entrance: Entrance = 'metro',
): MapOrientation | undefined {
  if (destination.building !== 'pjlf') return undefined;
  const { block, floor } = destination;
  const code = 'code' in destination ? destination.code : destination.room;
  const plan =
    block && floor
      ? atlas.floorPlans.find(p => p.block === block && p.floor === floor)
      : undefined;
  const index =
    code && /^(?:SE|T|\d{1,2})\d{3}$/.test(code)
      ? Number(code.slice(-3))
      : undefined;
  const modelId = index == null ? undefined : plan?.positions[String(index)];
  const model = modelId == null ? undefined : atlas.roomModels[modelId];
  const room = model && code ? planRoom(model, code) : undefined;
  const floorPlan: FloorPlan | undefined = plan
    ? {
        block: plan.block,
        floor: plan.floor,
        rooms: plan.rooms.map(id => {
          const item = atlas.roomModels[id];
          return planRoom(item, roomCode(plan.floor, item.index));
        }),
        structures: plan.structures,
      }
    : undefined;
  if (room && floorPlan) {
    // Unknown room numbers can subdivide the atlas's modeled room bay.
    // Replace the intersecting model instead of stacking two labels/polygons.
    floorPlan.rooms = floorPlan.rooms.filter(
      other =>
        Math.min(other.bounds[2], room.bounds[2]) -
          Math.max(other.bounds[0], room.bounds[0]) <
          0.05 ||
        Math.min(other.bounds[3], room.bounds[3]) -
          Math.max(other.bounds[1], room.bounds[1]) <
          0.05,
    );
    floorPlan.rooms.push(room);
  }
  const result: MapOrientation = {
    steps: [],
    route: model?.route ?? (block ? blockRoute(block, floor) : []),
    routeStart:
      floor === 'T' ? 'entrance' : floor === 'SE' ? 'stairs' : 'elevators',
    endpoint: !model
      ? 'block'
      : model.certainty === 'official'
        ? 'door'
        : model.certainty === 'zone'
          ? 'zone'
          : 'modeled-door',
    confidence: confidence(model, Boolean(code)),
    floorPlan,
    room,
    entranceRoute: entranceRoute(atlas, entrance),
  };
  const steps = result.steps;
  steps.push(
    entrance === 'metro'
      ? {
          title: 'Entre pelo Portão 1, na Av. Rei Pelé.',
          detail:
            'Siga a passarela coberta (110 m) até o hall dos elevadores do Bloco C.',
        }
      : {
          title: 'Entre pelo Portão 5, na São Francisco Xavier, 524.',
          detail: 'A porta principal do F fica em frente.',
        },
  );
  const upper = floor && floor !== 'T' && floor !== 'SE';
  if (entrance === 'sfx' && (upper || block !== 'F')) {
    steps.push({
      title: 'Siga até o hall dos elevadores do Bloco C.',
      detail:
        'O C fica meio andar abaixo do F. Confirme a ligação no térreo na portaria.',
    });
  } else if (
    entrance === 'metro' &&
    (floor === 'T' || floor === 'SE') &&
    block === 'F'
  ) {
    steps.push({
      title: 'Do hall do C, suba meio andar até o térreo do F.',
      detail:
        'Confirme essa ligação na portaria. Pelo Portão 5, a entrada do F fica em frente.',
    });
  }
  if (upper)
    steps.push({
      title: `No hall do C, pegue o elevador até o ${floorLabel(floor).toLowerCase()}.`,
    });
  if (!block) {
    steps.push({ title: 'Confira a letra do bloco no horário da aula.' });
    return result;
  }
  if (!floor) {
    steps.push({
      title:
        block === 'C'
          ? 'O Bloco C é o hall central dos elevadores.'
          : block === 'F'
            ? 'O Bloco F é a barra voltada para a São Francisco Xavier.'
            : `O Bloco ${block} fica ${block === 'A' || block === 'E' ? 'na ponta' : 'ao lado do C'}, do lado do ${block === 'A' || block === 'B' ? 'Haroldinho' : 'Centro Cultural'}.`,
      detail: 'Escolha o andar para ver a planta e o trajeto.',
    });
    return result;
  }
  if (floor === 'SE') {
    steps.push({
      title: 'Desça ao semienterrado pela escada do hall do F.',
      detail: 'A escada fica à direita de quem entra pela porta principal.',
    });
  }
  if (!upper && block !== 'F') {
    steps.push({
      title: `Siga as placas para o térreo do Bloco ${block}.`,
      detail:
        block === 'C'
          ? 'O destino fica no nível do hall dos elevadores.'
          : 'Os braços ficam meio andar abaixo do térreo do F. Confirme o acesso na portaria.',
    });
    if (code)
      steps.push({ title: `Procure a sala ${code} nas placas do bloco.` });
    return result;
  }
  if (upper && block === 'F') {
    steps.push({
      title: 'Do hall do C, suba meio andar pela ligação com o F.',
      detail: `Use a rampa ou a escada. A rampa que desce leva ao ${Number(floor) === 1 ? 'térreo' : `${Number(floor) - 1}º andar`} do F.`,
    });
  } else if (upper && block === 'C') {
    steps.push(
      model?.certainty === 'zone'
        ? {
            title: 'Atravesse a passarela até o fundo do próprio Bloco C.',
            detail:
              'A biblioteca fica depois da passarela. Siga as placas até a entrada.',
          }
        : {
            title: code
              ? `No próprio Bloco C, procure a sala ${code} nas placas.`
              : 'O destino fica no próprio Bloco C.',
          },
    );
    return result;
  } else if (upper) {
    const right = block === 'A' || block === 'B';
    const far = block === 'A' || block === 'E';
    const metres = Math.abs(AXES[block]! - (right ? 110.9 : 117.95));
    steps.push({
      title: `Saia do hall para a passarela, vire à ${right ? 'direita' : 'esquerda'} e siga ${distance(metres)} até o Bloco ${block}.`,
      detail: `${far ? `Passe pelo Bloco ${right ? 'B' : 'D'}: ${block} é o último braço` : 'É o primeiro braço'}, do lado do ${right ? 'Haroldinho' : 'Centro Cultural'}. A passarela é plana; as rampas levam ao F.`,
    });
  }
  if (!model || !code) {
    if (code)
      steps.push({
        title: `No corredor do Bloco ${block}, procure a sala ${code} nas placas.`,
      });
    return result;
  }
  if (model.atJunction) {
    steps.push({
      title: `A sala ${code} fica logo na chegada da passarela, do outro lado do corredor.`,
    });
    return result;
  }
  if (model.turn && model.distance != null) {
    steps.push({
      title: `No corredor do ${block}, vire à ${model.turn} e siga ${distance(model.distance)}.`,
      detail:
        block === 'F'
          ? `Siga para o lado do ${model.towardCultural ? 'Centro Cultural' : 'Haroldinho'}.`
          : model.towardTip
            ? 'Siga para a ponta do bloco.'
            : 'Siga para o lado do F.',
    });
  }
  if (model.side && model.ordinal) {
    const mark = model.landmark
      ?.split(' e ')
      .map(part => part.replace(/^(a|o|as|os) /, 'd$1 '))
      .join(' e ');
    steps.push({
      title: `A ${code} é a ${model.ordinal}ª sala à ${model.side}${mark ? `, depois ${mark}` : ''}.`,
    });
  }
  return result;
}
