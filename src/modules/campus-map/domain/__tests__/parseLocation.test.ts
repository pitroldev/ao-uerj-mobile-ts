import { floorLabel, parseLocation } from '../parseLocation';

describe('portal room notation', () => {
  it.each([
    ['6019 B', '6019', '6', 'B'],
    ['Pav. João Lyra Filho · 6º andar · Sala 6019 B', '6019', '6', 'B'],
    ['11.002 C', '11002', '11', 'C'],
    ['5038 - Bloco F', '5038', '5', 'F'],
    ['T-031 F', 'T031', 'T', 'F'],
    ['SE 025 F', 'SE025', 'SE', 'F'],
    ['10014/1 A', '10014', '10', 'A'],
    ['6145-2 F', '6145', '6', 'F'],
  ])('decodes %s without inventing a door', (input, code, floor, block) => {
    expect(parseLocation(input)).toEqual({
      kind: 'room',
      building: 'pjlf',
      code,
      floor,
      block,
    });
  });
  it('requires a block for ambiguous numbers', () => {
    expect(parseLocation('6019')).toEqual({
      kind: 'room',
      building: 'pjlf',
      code: '6019',
      floor: '6',
      block: undefined,
    });
  });
  it('resolves documented ground-floor and RAV notation', () => {
    expect(parseLocation('T031')).toEqual({
      kind: 'room',
      building: 'pjlf',
      code: 'T031',
      floor: 'T',
      block: 'F',
    });
    expect(parseLocation('RAV-62')).toEqual({
      kind: 'room',
      building: 'pjlf',
      code: 'RAV-62',
      floor: '6',
      block: 'F',
    });
    expect(parseLocation('RAV-82').kind).toBe('unknown');
  });
  it.each([
    '13019 B',
    '6019 Z',
    '6019 B · Bloco E',
    'SE025 D',
    '6º andar · Sala 7019 B',
  ])('rejects conflicting or invalid location %s', input => {
    expect(parseLocation(input).kind).toBe('invalid');
  });
  it.each(['AVA', 'Sala virtual', 'EAD', 'aula remota'])(
    'does not put %s on campus',
    input => {
      expect(parseLocation(input).kind).toBe('virtual');
    },
  );
  it.each(['', '—', 'Não informado', 'Sala não informada', 'a definir'])(
    'handles a missing location %s',
    input => {
      expect(parseLocation(input).kind).toBe('empty');
    },
  );
  it.each([
    'FFP · sala 6019 B',
    'FEBF 4010',
    'CCOT 6019',
    'UERJ Resende 6019 B',
    '999999 B',
  ])('does not misplace %s in the pavilion', input => {
    expect(parseLocation(input).kind).toBe('unknown');
  });
  it('handles the different building notation', () => {
    expect(parseLocation('Haroldinho · Sala 310')).toEqual({
      kind: 'room',
      building: 'haroldinho',
      code: '310',
      floor: '3',
    });
    expect(parseLocation('Haroldinho 602').kind).toBe('invalid');
  });
  it('labels the ground and underground levels', () => {
    expect(floorLabel('T')).toBe('Térreo');
    expect(floorLabel('SE')).toBe('Semienterrado');
    expect(floorLabel('12')).toBe('12º andar');
  });
});
