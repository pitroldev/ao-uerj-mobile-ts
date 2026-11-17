import type { Block, Floor, LocationResult } from './types';

/** O local de uma aula: o texto curto ("Sala 5098 F", "LEE 13") e o que o mapa entende. */
export type ClassLocation = { label: string; result: LocationResult };

export function normalizeLocation(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Campi e prédios fora do mapa do Maracanã, com o nome que o app mostra. */
const AWAY: readonly [RegExp, string][] = [
  [/\bfebf\b|caxias/, 'FEBF (Caxias)'],
  [/\bffp\b|sao goncalo/, 'FFP (São Gonçalo)'],
  [/resende/, 'Resende'],
  [/friburgo|\biprj\b/, 'Nova Friburgo'],
  [/fonseca teles|\d\s*ft\b/, 'Fonseca Teles'],
  [/colegio de aplicacao|\bcap\b/, 'Colégio de Aplicação'],
  [/\bccot\b/, 'CCOT'],
];

/**
 * O local fica em outro campus ou prédio: o nome vem do parêntese do
 * portal ("Prédio da FEBF - Caxias"), ou do campus reconhecido.
 */
function elsewhere(text: string, raw: string): LocationResult | null {
  const hit = AWAY.find(([pattern]) => pattern.test(text));
  if (!hit) return null;
  const named = /\(([^)]+)\)/.exec(raw)?.[1]?.replace(/\s+/g, ' ').trim();
  return {
    kind: 'elsewhere',
    where: named && !/\bpav\b|pavilh/i.test(named) ? named : hit[1],
  };
}

/** Decode the portal's notation; never guess a block from a room number. */
export function parseLocation(
  input: string | null | undefined,
): LocationResult {
  const text = normalizeLocation(input ?? '');
  if (
    !text ||
    /^[-—–]+$/.test(text) ||
    /nao informad|a definir|sem local/.test(text)
  )
    return { kind: 'empty' };
  if (/\b(ava|ead|online|remot[oa])\b|sala virtual|a distancia/.test(text))
    return { kind: 'virtual' };
  // Outro campus ou prédio fora do mapa do Maracanã: nunca vira sala daqui.
  const away = elsewhere(text, input ?? '');
  if (away) return away;
  // O Laboratório de Diagnóstico por DNA: térreo do Haroldinho (Guia de
  // Ramais 2024, "PHLC Térreo"), sem número de sala.
  if (/diagnostico (por )?dna|\bldd\b/.test(text))
    return {
      kind: 'place',
      id: 'ldd',
      label: 'Lab. de Diagnóstico por DNA',
      building: 'haroldinho',
      floor: 'T',
    };
  if (/haroldinho|haroldo lisboa|\bphlc\b/.test(text)) {
    const match = /\b([1-6]\d{2})(?:[- ]?[a-z])?\b/.exec(text);
    if (!match) return { kind: 'unknown' };
    if (match[1][0] === '6')
      return {
        kind: 'invalid',
        message: 'Confira o andar da sala no Haroldinho.',
      };
    return {
      kind: 'room',
      building: 'haroldinho',
      code: match[1],
      floor: match[1][0] as Floor,
    };
  }
  // A COART (Coordenadoria de Artes) fica no 2º andar do Centro Cultural; o
  // portal escreve "COART 3 (Prédio não definido)" para a sala 3 dela.
  const coart = /\bcoart\b(?:\s*(\d{1,2}))?/.exec(text);
  if (coart)
    return {
      kind: 'place',
      id: 'coart',
      label: coart[1] ? `COART ${coart[1]}` : 'COART',
      building: 'ccot',
      floor: '2',
    };
  // No campus, mas fora do pavilhão e sem planta: o mapa não inventa a sala.
  if (/centro cultural|oscar tenorio/.test(text)) return { kind: 'unknown' };
  // As salas do Direito usadas pelo Instituto de Letras ("DIR01" a "DIR06"):
  // o 7º andar do F, mas nenhuma fonte diz qual DIR é qual sala
  const law = /^dir\s*0*(\d{1,2})\b/.exec(text);
  if (law)
    return {
      kind: 'place',
      id: 'direito',
      label: `DIR${law[1].padStart(2, '0')}`,
      area: true,
      building: 'pjlf',
      floor: '7',
      block: 'F',
    };
  // O Laboratório Minato, do Setor de Japonês: a 11.010 F (o portal escreve
  // "MINATO - 11.014", número que nenhuma fonte confirma)
  if (/\bminato\b/.test(text))
    return {
      kind: 'place',
      id: 'minato',
      label: 'Laboratório Minato',
      building: 'pjlf',
      floor: '11',
      block: 'F',
    };
  // As salas de Letras no 11º andar do D: "Sala 04 - Bloco D" é a 11.004 D
  // (os quadros de horários do Instituto de Letras usam as duas formas)
  const letters = /^sala\s+0*(\d{1,2})\s*-\s*(?:bloco|bl\.?)\s*d\b/.exec(text);
  if (letters)
    return {
      kind: 'room',
      building: 'pjlf',
      code: `11${letters[1].padStart(3, '0')}`,
      floor: '11',
      block: 'D',
    };
  // Unidades que o portal escreve pelo nome, sem sala: o mapa leva à
  // secretaria delas (Guia de Ramais 2024).
  if (/^faoc\b|faculdade de oceanografia/.test(text))
    return {
      kind: 'place',
      id: 'sec-oceano',
      label: 'Oceanografia (FAOC)',
      building: 'pjlf',
      floor: '4',
      block: 'E',
    };
  if (/^instituto de artes\b/.test(text))
    return {
      kind: 'place',
      id: 'sec-artes',
      label: 'Instituto de Artes',
      building: 'pjlf',
      floor: '11',
      block: 'E',
    };
  // Os Laboratórios de Engenharia Elétrica: no pavilhão, salas numeradas no
  // 5º andar do F (a outra parte fica no Complexo Fonseca Teles, recusado
  // acima). A letra ("LEE 11J", "LEE 11C") não tem fonte: fica no rótulo, e
  // a sala é a do número (ver labs.ts).
  const lee = /\blee\b(?:\s*-?\s*(\d{1,2})\s*([a-z])?\b)?/.exec(text);
  if (lee)
    return {
      kind: 'place',
      id: 'lee',
      label: ['LEE', lee[1] && `${lee[1]}${(lee[2] ?? '').toUpperCase()}`]
        .filter(Boolean)
        .join(' '),
      ...(lee[1] ? { number: Number(lee[1]) } : {}),
      building: 'pjlf',
      floor: '5',
      block: 'F',
    };
  const rav = /\brav[ -]?(62|64)\b/.exec(text);
  if (rav) {
    const statedBlock = /\bbloco\s+([a-z])\b/.exec(text)?.[1];
    const statedFloor = /\b(\d{1,2})\s*[º°o]?\s*andar/.exec(text)?.[1];
    if (
      (statedBlock && statedBlock !== 'f') ||
      (statedFloor && statedFloor !== '6')
    )
      return {
        kind: 'invalid',
        message: 'As salas RAV-62 e RAV-64 ficam no 6º andar do Bloco F.',
      };
    return {
      kind: 'room',
      building: 'pjlf',
      code: `RAV-${rav[1]}`,
      floor: '6',
      block: 'F',
    };
  }
  // "5001-C/F": a sala 5001, parte C, no Bloco F (a letra depois da barra é
  // o bloco); "Bl. F" e "2º and." são as abreviações do portal
  const notation = text
    .replace(/(\d)\s*-\s*[a-z]\s*\/\s*([a-z])\b/g, '$1/$2')
    .replace(/\bbl\.?\s+([a-z])\b/g, 'bloco $1')
    .replace(/\band\.(?=\s|$)/g, 'andar');
  const match =
    /(?:^|[^a-z\d.])((?:se|t)\s*-?\s*\d{2,3}|\d{1,2}\.\d{3}|\d{4,5})(?!\d)(?:\s*(?:\/\s*\d{1,2}|-\d{1,2}))?(?:\s*[-/]?\s*(?:bloco\s*)?([a-z])\b)?/.exec(
      notation,
    );
  if (!match) return { kind: 'unknown' };
  const code = match[1].replace(/[\s.-]/g, '').toUpperCase();
  const floor = (
    code.startsWith('SE')
      ? 'SE'
      : code.startsWith('T')
        ? 'T'
        : String(Number(code.slice(0, -3)))
  ) as Floor;
  const letter = match[2]?.toUpperCase();
  const explicitBlock = /\bbloco\s+([a-z])\b/.exec(notation)?.[1].toUpperCase();
  if (letter && explicitBlock && letter !== explicitBlock)
    return {
      kind: 'invalid',
      message: 'Há dois blocos diferentes no local. Confira a letra.',
    };
  const block =
    explicitBlock ??
    letter ??
    (floor === 'T' || floor === 'SE' ? 'F' : undefined);
  if (block && !/^[A-F]$/.test(block))
    return { kind: 'invalid', message: 'Os blocos do pavilhão vão de A a F.' };
  if (
    floor !== 'SE' &&
    floor !== 'T' &&
    (Number(floor) < 1 || Number(floor) > 12)
  )
    return {
      kind: 'invalid',
      message: 'O pavilhão tem térreo e andares de 1 a 12.',
    };
  if (floor === 'SE' && block && block !== 'F')
    return { kind: 'invalid', message: 'O semienterrado fica no Bloco F.' };
  const explicitFloor = /\b(\d{1,2})\s*[º°o]?\s*andar/.exec(notation)?.[1];
  if (explicitFloor && String(Number(explicitFloor)) !== floor)
    return {
      kind: 'invalid',
      message: 'O andar escrito difere do número da sala. Confira o local.',
    };
  return {
    kind: 'room',
    building: 'pjlf',
    code,
    floor,
    block: block as Block | undefined,
  };
}

/** "Sala 5098 F", "LEE 13"; sem leitura, o texto como veio. */
function shortLabel(result: LocationResult, text: string) {
  if (result.kind === 'place') return result.label;
  if (result.kind === 'room')
    return `Sala ${result.code}${result.block ? ` ${result.block}` : ''}`;
  return text;
}

const located = (result: LocationResult) =>
  result.kind === 'room' || result.kind === 'place';

/** Um trecho que é um lugar de verdade, no mapa ou em outro campus. */
const meaningful = (result: LocationResult) =>
  located(result) || result.kind === 'elsewhere';

/**
 * Os locais de uma aula. Cada um vem com o prédio entre parênteses, e o
 * portal os junta com " / " na grade em curso ("Sala 5.098/F (Pav. João
 * Lira Filho) / LEE 09 (Pav. João Lira Filho)") ou colados na página da
 * disciplina ("SALA 5092/F (Pav. João Lira Filho)LEE 09 (…)"). Só separa
 * quando dois ou mais trechos são lugares; senão, o texto é um local só.
 */
export function parseClassLocations(
  input: string | null | undefined,
): ClassLocation[] {
  const text = (input ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const one = (part: string): ClassLocation => {
    const result = parseLocation(part);
    const plain = part.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || part;
    return { label: shortLabel(result, plain), result };
  };
  const parts = text
    .replace(/\)\s*(?=[^\s/)])/g, ') / ')
    .split(/\s+\/\s+/)
    .map(one);
  if (parts.filter(part => meaningful(part.result)).length > 1) return parts;
  return [one(text)];
}

/** Algum local da aula aparece no mapa. */
export function hasMapLocation(input: string | null | undefined) {
  return parseClassLocations(input).some(part => located(part.result));
}

export function floorLabel(floor: Floor) {
  return floor === 'T'
    ? 'Térreo'
    : floor === 'SE'
      ? 'Semienterrado'
      : `${floor}º andar`;
}
