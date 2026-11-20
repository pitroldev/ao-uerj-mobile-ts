/*
 * Atualiza data/pontos-onibus.json a partir do GTFS dos ônibus da SMTR.
 *
 *   node scripts/campus-map/import-bus-stops.cjs --gtfs <pasta> --data AAAA-MM-DD
 *
 * <pasta> é o gtfs.zip de https://dados.mobilidade.rio/gtfs/schedule já
 * extraído; --data é a data dos arquivos dele. Para cada ponto da lista
 * (o código da parada e a rua ficam à mão), grava o nome oficial, a posição
 * e as linhas que param ali, com o destino de cada viagem. Viagens que
 * terminam no ponto não contam: ninguém embarca nelas. Depois, rode
 * scripts/generate-campus-map.cjs para o atlas.
 */
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const file = path.join(__dirname, 'data', 'pontos-onibus.json');

function option(name) {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
}

/** Uma linha de CSV com aspas (os nomes do GTFS têm vírgula). */
function cells(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out;
}

async function rows(dir, name, onRow) {
  const input = fs.createReadStream(path.join(dir, name), 'utf8');
  let head;
  for await (const raw of readline.createInterface({
    input,
    crlfDelay: Infinity,
  })) {
    const line = raw.replace(/^\uFEFF/, '');
    if (!line) continue;
    const values = cells(line);
    if (!head) head = values;
    else onRow(Object.fromEntries(head.map((key, i) => [key, values[i]])));
  }
}

/** 232, 363, 2110, depois LECD151, SN363, SV391. */
function byLine(a, b) {
  const plain = code => /^\d+$/.test(code);
  if (plain(a) !== plain(b)) return plain(a) ? -1 : 1;
  return a.localeCompare(b, 'pt', { numeric: true });
}

async function main() {
  const dir = option('--gtfs');
  const date = option('--data');
  if (!dir || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    console.error(
      'Uso: node scripts/campus-map/import-bus-stops.cjs --gtfs <pasta> --data AAAA-MM-DD',
    );
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const wanted = new Set(data.pontos.map(p => p.parada));
  const stops = new Map();
  await rows(dir, 'stops.txt', row => {
    if (wanted.has(row.stop_id)) stops.set(row.stop_id, row);
  });
  const missing = [...wanted].filter(id => !stops.has(id));
  if (missing.length) {
    console.error(`Paradas fora do GTFS: ${missing.join(', ')}`);
    process.exit(1);
  }
  const routes = new Map();
  await rows(dir, 'routes.txt', row =>
    routes.set(row.route_id, row.route_short_name),
  );
  const trips = new Map();
  await rows(dir, 'trips.txt', row =>
    trips.set(row.trip_id, {
      line: routes.get(row.route_id),
      to: row.trip_headsign.trim(),
    }),
  );
  const last = new Map();
  const visits = [];
  await rows(dir, 'stop_times.txt', row => {
    const order = Number(row.stop_sequence);
    if ((last.get(row.trip_id) ?? -1) < order) last.set(row.trip_id, order);
    if (wanted.has(row.stop_id))
      visits.push({ trip: row.trip_id, stop: row.stop_id, order });
  });
  const lines = new Map();
  for (const visit of visits) {
    const trip = trips.get(visit.trip);
    if (!trip?.line || last.get(visit.trip) === visit.order) continue;
    const byCode = lines.get(visit.stop) ?? new Map();
    const destinations = byCode.get(trip.line) ?? new Set();
    if (trip.to) destinations.add(trip.to);
    byCode.set(trip.line, destinations);
    lines.set(visit.stop, byCode);
  }
  data.fontes.linhas.data = date;
  data.pontos = data.pontos.map(point => {
    const stop = stops.get(point.parada);
    const byCode = lines.get(point.parada) ?? new Map();
    return {
      parada: point.parada,
      rua: point.rua,
      nome: stop.stop_name.trim(),
      ll: [Number(stop.stop_lat), Number(stop.stop_lon)],
      linhas: [...byCode.keys()].sort(byLine).map(line => ({
        linha: line,
        destinos: [...byCode.get(line)].sort((a, b) =>
          a.localeCompare(b, 'pt'),
        ),
      })),
    };
  });
  const empty = data.pontos.filter(p => !p.linhas.length);
  if (empty.length) {
    console.error(
      `Pontos sem linhas no GTFS: ${empty.map(p => p.parada).join(', ')}`,
    );
    process.exit(1);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(
    `${data.pontos.length} pontos, ${data.pontos.reduce((n, p) => n + p.linhas.length, 0)} linhas por ponto.`,
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
