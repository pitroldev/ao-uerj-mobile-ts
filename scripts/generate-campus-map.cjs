/* Rebuild the offline atlas from measured geometry and the room model. */
const fs = require('node:fs');
const path = require('node:path');
const { schematicLake } = require('./campus-map/schematic-lake.cjs');
const {
  Sala,
  floorRoute,
  walkInfo,
  pillarBounds,
} = require('./campus-map/room-model.cjs');
const scheme = require('./campus-map/data/esquema-pavilhao.json');
const rawRooms = require('./campus-map/data/salas-pavilhao.json');
const geo = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'campus-map/data/pavilhao-e-campus.geojson'),
    'utf8',
  ),
);
const catalogue = require('./campus-map/data/places.json');
const root = path.resolve(__dirname, '..');
const official = rawRooms.oficial_D9;
const [a, b, c] = scheme.referencial.para_wgs84.lon;
const [d, e, f] = scheme.referencial.para_wgs84.lat;
const round = n => Math.round(n * 1000) / 1000;
const round2 = n => Math.round(n * 100) / 100;
function local([lon, lat]) {
  return [
    round(((lon - a) * f - (lat - d) * c) / (b * f - e * c)),
    round(((lat - d) * b - (lon - a) * e) / (b * f - e * c)),
  ];
}
const shortNames = {
  pjlf: 'Pavilhão João Lyra Filho',
  haroldinho: 'Haroldinho',
  ccot: 'Centro Cultural',
  ru: 'Restaurante Universitário',
  metro: 'Metrô Maracanã',
  trem: 'Estação Maracanã · trens',
  'teatro-odylo': 'Teatro Odylo Costa Filho',
  concha: 'Concha Acústica',
};
const places = catalogue.places.map(p => ({
  id: p.id,
  name:
    shortNames[p.id] || (p.cat === 'portoes' ? p.name.split(' · ')[0] : p.name),
  category: p.cat,
  building: p.building,
  block: p.block,
  subtitle:
    p.cat === 'portoes'
      ? p.name.split(' · ')[1]
      : p.id === 'ru'
        ? 'Centro Cultural · 1º pavimento'
        : p.id === 'pjlf'
          ? 'Blocos A a F'
          : '',
  aliases: p.aka || '',
  point: local([p.ll[1], p.ll[0]]),
  coordinate: p.ll,
  sources: p.src.map(([title, url]) => ({ title, url })),
}));
for (const u of catalogue.units) {
  const parent = places.find(
    p => p.id === (u.block ? 'bloco-' + u.block.toLowerCase() : u.building),
  );
  if (!parent) continue;
  places.push({
    id: u.id,
    name: u.name,
    category: u.group?.startsWith('bib') ? 'bibliotecas' : 'servicos',
    building: u.building,
    block: u.block,
    floor: u.floor,
    room: u.room,
    subtitle: [
      u.floor === 'T' ? 'Térreo' : u.floor + 'º andar',
      u.block ? 'Bloco ' + u.block : parent.name,
      u.room ? 'Sala ' + u.room : '',
    ]
      .filter(Boolean)
      .join(' · '),
    aliases: u.desc || '',
    point: parent.point,
    coordinate: parent.coordinate,
    sources: u.src.map(([title, url]) => ({ title, url })),
  });
}
const measuredShapes = [
  ...scheme.blocos,
  ...scheme.ligacoes,
  ...scheme.passarela,
  ...scheme.patios,
  ...scheme.agua.map(shape => ({
    ...shape,
    // The lake is an original symbol inside its known courtyard. No traced
    // shoreline or surveyed lake dimensions are stored in the source model.
    poligono: {
      externo: schematicLake(
        scheme.patios.find(patio => patio.id === shape.patio),
      ).ring,
    },
  })),
  ...scheme.vizinhos,
];
const roomModels = [],
  modelIds = new Map();
function internModel(room, destination) {
  const position = Sala.pos(destination);
  const resolved = position?.sala === room || position?.sala?.i === room.i;
  const walk = resolved ? walkInfo(destination, position) : {};
  const model = {
    // Unnumbered rooms in the official plan retain the model's inferred label;
    // recorded/ certainty distinguish those labels from the five printed IDs.
    index: room.i,
    bounds: room.r,
    ...(room.p ? { polygon: room.p } : {}),
    ...(room.porta ? { door: room.porta } : {}),
    ...(resolved && position.doorPt
      ? { doorPoint: position.doorPt, corridorPoint: position.corrPt }
      : {}),
    ...(room.lab ? { labelPoint: room.lab } : {}),
    recorded: Boolean(room.conhecida),
    certainty:
      room.oficial && !room.semNumero
        ? 'official'
        : room.zona
          ? 'zone'
          : 'modeled',
    route: resolved ? (floorRoute(destination, position)?.pts ?? []) : [],
    ...(walk.turn ? { turn: walk.turn } : {}),
    ...(walk.side ? { side: walk.side } : {}),
    ...(walk.ord ? { ordinal: walk.ord } : {}),
    ...(walk.mark ? { landmark: walk.mark } : {}),
    ...(walk.dist != null ? { distance: round(walk.dist) } : {}),
    ...(walk.tip != null ? { towardTip: walk.tip } : {}),
    ...(walk.atJunction != null ? { atJunction: walk.atJunction } : {}),
    ...(walk.toNO != null ? { towardCultural: walk.toNO } : {}),
    ...(position?.alts?.length ? { alternatives: position.alts.length } : {}),
  };
  const key = JSON.stringify(model, (_, value) =>
    typeof value === 'number' ? round(value) : value,
  );
  if (!modelIds.has(key)) {
    modelIds.set(key, roomModels.length);
    roomModels.push(JSON.parse(key));
  }
  return modelIds.get(key);
}
const floorPlans = scheme.blocos.flatMap(({ letra: block, pavimentos }) =>
  pavimentos.map(floor => {
    const base = Sala.andar(block, floor),
      destination = { building: 'pjlf', block, floor };
    const code = index => `${floor}${String(index).padStart(3, '0')}`;
    const rooms = base.salas.map(room =>
      internModel(room, { ...destination, room: code(room.i) }),
    );
    const positions = {};
    const maximum = block === 'F' ? 152 : block === 'C' ? 14 : 34;
    for (let index = 1; index <= maximum; index++) {
      const target = { ...destination, room: code(index) },
        position = Sala.pos(target);
      if (position?.sala && position?.poly)
        positions[index] = internModel(position.sala, target);
    }
    const structures = base.estr.map(item => ({
      kind: item.t,
      bounds: item.r,
      ...(item.p ? { polygon: item.p } : {}),
    }));
    if (block === 'D' && floor === '9') {
      structures.push(
        ...official.nichos.map(item => ({ kind: 'nicho', bounds: item.r })),
      );
      const auditorium = official.salas.find(room => room.numero === '9032');
      const { auditorio, vestibulo_9024: vestibule } = official;
      structures.push({
        kind: 'palco',
        bounds: [
          auditorium.r[0] + 0.25,
          auditorio.palco_y[0],
          auditorium.r[2] - 0.25,
          auditorio.palco_y[1],
        ],
      });
      for (let i = 0; i < auditorio.degraus; i++) {
        const y =
          auditorio.arquibancada_y[0] +
          (i * (auditorio.arquibancada_y[1] - auditorio.arquibancada_y[0])) /
            (auditorio.degraus - 1);
        structures.push({
          kind: 'degrau',
          bounds: [auditorium.r[0] + 0.25, y, auditorium.r[2] - 0.25, y],
          line: [
            [auditorium.r[0] + 0.25, y],
            [auditorium.r[2] - 0.25, y],
          ],
        });
      }
      structures.push({ kind: 'sala-de-som', bounds: vestibule.sala_de_som });
      for (let i = 0; i <= 4; i++) {
        const y = vestibule.degraus[1] + i * 0.25;
        structures.push({
          kind: 'degrau',
          bounds: [vestibule.degraus[0], y, vestibule.degraus[2], y],
          line: [
            [vestibule.degraus[0], y],
            [vestibule.degraus[2], y],
          ],
        });
      }
    }
    return {
      block,
      floor,
      rooms,
      positions,
      structures,
    };
  }),
);
const internalShapes = [
  ...scheme.corredores,
  ...scheme.circulacao_vertical.elevadores.filter(
    item => item.id === 'hall-elevadores' || item.id.endsWith('-frente'),
  ),
  ...scheme.circulacao_vertical.escadas,
  ...scheme.sanitarios,
  ...scheme.passarela,
  ...scheme.ligacoes,
]
  .filter(
    (item, index, items) =>
      item.poligono && items.findIndex(other => other.id === item.id) === index,
  )
  .map(item => ({
    id: item.id,
    kind: item.tipo,
    ...(item.letra ? { block: item.letra } : {}),
    rings: [item.poligono.externo, ...(item.poligono.furos || [])],
  }));
for (const block of ['A', 'B', 'D', 'E', 'F']) {
  pillarBounds(block).forEach((bounds, index) => {
    const [x1, y1, x2, y2] = bounds.map(round);
    internalShapes.push({
      id: `pillar-${block}-${index}`,
      kind: 'pillar',
      block,
      rings: [
        [
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2],
        ],
      ],
    });
  });
}
const atlas = {
  version: scheme.versao,
  north: scheme.referencial.azimute_verdadeiro_y_graus,
  campus: scheme.campus.contorno.externo,
  shapes: catalogue.shapes.map(p => ({
    id: p.id,
    kind: p.kind,
    rings: (() => {
      const measured = measuredShapes.find(s => s.id === p.id)?.poligono;
      return measured
        ? [measured.externo, ...(measured.furos || [])]
        : geo.features
            .find(item => item.properties.id === p.sourceId)
            .geometry.coordinates.map(ring => {
              const points = ring.map(point =>
                point.map(value => Number(value.toFixed(6))),
              );
              if (
                points[0][0] !== points.at(-1)[0] ||
                points[0][1] !== points.at(-1)[1]
              )
                points.push(points[0]);
              return points.map(local);
            });
    })(),
  })),
  blocks: scheme.blocos.map(block => ({
    id: block.letra,
    point: [block.rotulo.x, block.rotulo.y].map(round2),
    bounds: [
      block.retangulo.x,
      block.retangulo.y,
      block.retangulo.w,
      block.retangulo.h,
    ].map(round2),
    floors: block.pavimentos,
  })),
  streets: scheme.ruas.map(street => ({
    name: street.nome.replace(' (antiga Turf Club)', ''),
    point: [street.rotulo.x, street.rotulo.y],
    angle: street.rotulo.angulo_graus_svg,
    lines: street.linhas,
  })),
  paths: geo.features
    .filter(
      p => p.properties.tipo === 'caminho' && p.geometry.type === 'LineString',
    )
    .map(p => p.geometry.coordinates.map(local)),
  places,
  rooms: Object.fromEntries(
    Object.entries(rawRooms.salas).map(([block, floors]) => [
      block,
      Object.fromEntries(
        Object.entries(floors).map(([floor, rooms]) => [
          floor,
          rooms.map(r => r[0]),
        ]),
      ),
    ]),
  ),
  officialRooms: official.salas
    .filter(r => r.numero)
    .map(r => ({
      code: r.numero,
      block: 'D',
      floor: '9',
      bounds: r.r,
      door: official.portas.find(p => p.rotulo === r.numero + 'D').r,
    })),
  roomModels,
  floorPlans,
  internalShapes,
};
const dest = path.join(root, 'src/adapters/outbound/campus-map/atlas.json');
const output = JSON.stringify(atlas) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== output) {
    console.error(
      'Atlas desatualizado. Execute node scripts/generate-campus-map.cjs.',
    );
    process.exitCode = 1;
  }
} else {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, output);
}
console.log(
  `Atlas: ${atlas.shapes.length} formas, ${places.length} lugares, ${Buffer.byteLength(output)} bytes.`,
);
