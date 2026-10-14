import type { Block, Floor, LocationResult } from './types';

export function normalizeLocation(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
  // An explicit other campus/building must never resolve to Maracanã.
  if (
    /\b(ffp|febf|resende|friburgo|sao goncalo|duque de caxias|ccot)\b|centro cultural|oscar tenorio/.test(
      text,
    )
  )
    return { kind: 'unknown' };
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
  const match =
    /(?:^|[^a-z\d.])((?:se|t)\s*-?\s*\d{2,3}|\d{1,2}\.\d{3}|\d{4,5})(?!\d)(?:\s*(?:\/\s*\d{1,2}|-\d{1,2}))?(?:\s*-?\s*(?:bloco\s*)?([a-z])\b)?/.exec(
      text,
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
  const explicitBlock = /\bbloco\s+([a-z])\b/.exec(text)?.[1].toUpperCase();
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
  const explicitFloor = /\b(\d{1,2})\s*[º°o]?\s*andar/.exec(text)?.[1];
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

export function floorLabel(floor: Floor) {
  return floor === 'T'
    ? 'Térreo'
    : floor === 'SE'
      ? 'Semienterrado'
      : `${floor}º andar`;
}
