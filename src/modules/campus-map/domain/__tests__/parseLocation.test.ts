import {
  floorLabel,
  hasMapLocation,
  parseClassLocations,
  parseLocation,
} from '../parseLocation';

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
    ['FFP · sala 6019 B', 'FFP (São Gonçalo)'],
    ['FEBF 4010', 'FEBF (Caxias)'],
    ['CCOT 6019', 'CCOT'],
    ['UERJ Resende 6019 B', 'Resende'],
    ['Sala 107 (Prédio da FEBF - Caxias)', 'Prédio da FEBF - Caxias'],
    ['Sala 911FT (Ed. Fonseca Teles)', 'Ed. Fonseca Teles'],
    ['CAP (Prédio do Colégio de Aplicação)', 'Prédio do Colégio de Aplicação'],
  ])('does not misplace %s in the pavilion', (input, where) => {
    expect(parseLocation(input)).toEqual({ kind: 'elsewhere', where });
  });
  it('does not invent a room for an unreadable number', () => {
    expect(parseLocation('999999 B').kind).toBe('unknown');
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

// os locais como o portal escreve na grade em curso (17/11/2026)
const CIRCUITS =
  'Sala 5.098/F         (Pav. João Lira Filho) / LEE 09               (Pav. João Lira Filho)';
const ELECTRONICS =
  'LEE 13               (Pav. João Lira Filho) / LEE 11J              (Pav. João Lira Filho) / LEE 11C              (Pav. João Lira Filho)';

describe('locations of a class', () => {
  it('reads the block after a slash', () => {
    expect(parseLocation('Sala 5.098/F (Pav. João Lira Filho)')).toEqual({
      kind: 'room',
      building: 'pjlf',
      code: '5098',
      floor: '5',
      block: 'F',
    });
  });

  it('reads each electrical engineering lab, on the 5th floor of F', () => {
    expect(parseLocation('LEE 11J (Pav. João Lira Filho)')).toEqual({
      kind: 'place',
      id: 'lee',
      label: 'LEE 11J',
      number: 11,
      building: 'pjlf',
      floor: '5',
      block: 'F',
    });
    expect(parseLocation('LEE')).toMatchObject({ kind: 'place', label: 'LEE' });
    // a outra parte do LEE fica no Complexo Fonseca Teles, fora do mapa
    expect(parseLocation('LEE 02 (Complexo Fonseca Teles)')).toEqual({
      kind: 'elsewhere',
      where: 'Complexo Fonseca Teles',
    });
  });

  it('splits the places the portal joins with a slash', () => {
    expect(parseClassLocations(CIRCUITS)).toEqual([
      {
        label: 'Sala 5098 F',
        result: expect.objectContaining({ kind: 'room', code: '5098' }),
      },
      {
        label: 'LEE 09',
        result: expect.objectContaining({ kind: 'place', id: 'lee' }),
      },
    ]);
    expect(parseClassLocations(ELECTRONICS).map(item => item.label)).toEqual([
      'LEE 13',
      'LEE 11J',
      'LEE 11C',
    ]);
    expect(hasMapLocation(ELECTRONICS)).toBe(true);
  });

  it('keeps a single place when only one part is a location', () => {
    expect(parseClassLocations('6019 / 12')).toEqual([
      {
        label: 'Sala 6019',
        result: expect.objectContaining({ code: '6019' }),
      },
    ]);
    expect(parseClassLocations('Sala virtual (AVA)')).toEqual([
      { label: 'Sala virtual', result: { kind: 'virtual' } },
    ]);
    expect(parseClassLocations('  ')).toEqual([]);
    expect(hasMapLocation('Não informado')).toBe(false);
  });
});

// formatos achados numa varredura das turmas do portal (17/11/2026)
describe('portal notation seen across the classes', () => {
  it.each([
    ['Sala 11.054 - Bl. F (Pav. João Lira Filho)', '11054', '11', 'F'],
    ['2º and. Bl. F - 2034 (Pav. João Lira Filho)', '2034', '2', 'F'],
    // a letra antes da barra é a parte da sala; o bloco vem depois dela
    ['Sala 5001-C/F (Pav. João Lira Filho)', '5001', '5', 'F'],
    ['SALA 5029/F/01 (Pav. João Lira Filho)', '5029', '5', 'F'],
    ['3029F(2)-Lab.Eletric (Pav. João Lira Filho)', '3029', '3', 'F'],
  ])('reads %s', (input, code, floor, block) => {
    expect(parseLocation(input)).toEqual({
      kind: 'room',
      building: 'pjlf',
      code,
      floor,
      block,
    });
  });

  it('splits places the subject page glues together', () => {
    expect(
      parseClassLocations(
        'SALA 5092/F (Pav. João Lira Filho)LEE 09 (Pav. João Lira Filho)LEE 01 (Pav. João Lira Filho)',
      ).map(part => part.label),
    ).toEqual(['Sala 5092 F', 'LEE 09', 'LEE 01']);
    expect(
      parseClassLocations(
        'Sala 213 (Prédio da FEBF - Caxias)Sala 201 (Prédio da FEBF - Caxias)',
      ),
    ).toEqual([
      {
        label: 'Sala 213',
        result: { kind: 'elsewhere', where: 'Prédio da FEBF - Caxias' },
      },
      {
        label: 'Sala 201',
        result: { kind: 'elsewhere', where: 'Prédio da FEBF - Caxias' },
      },
    ]);
  });

  it('reads the Letters, Law, Japanese and Arts codes', () => {
    // "Sala 04 - Bloco D" é a 11.004 D (quadros de horários do ILE)
    expect(parseLocation('Sala 04 - Bloco D (Pav. João Lira Filho)')).toEqual({
      kind: 'room',
      building: 'pjlf',
      code: '11004',
      floor: '11',
      block: 'D',
    });
    // DIR01 a DIR06: uma das salas do Direito, sem dizer qual
    expect(parseLocation('DIR3 (Pav. João Lira Filho)')).toEqual({
      kind: 'place',
      id: 'direito',
      label: 'DIR03',
      area: true,
      building: 'pjlf',
      floor: '7',
      block: 'F',
    });
    expect(
      parseLocation('MINATO - 11.014 (Pav. João Lira Filho)'),
    ).toMatchObject({ kind: 'place', id: 'minato', floor: '11', block: 'F' });
    expect(parseLocation('COART 3 (Prédio não definido)')).toEqual({
      kind: 'place',
      id: 'coart',
      label: 'COART 3',
      building: 'ccot',
      floor: '2',
    });
  });

  it('takes units written by name to their place', () => {
    expect(parseLocation('faoc (Pav. João Lira Filho)')).toMatchObject({
      kind: 'place',
      id: 'sec-oceano',
      floor: '4',
      block: 'E',
    });
    expect(
      parseLocation('Instituto de Artes (Pav. João Lira Filho)'),
    ).toMatchObject({ kind: 'place', id: 'sec-artes', floor: '11' });
    expect(
      parseLocation('Lab Diagnostico DNA (Pav. Haroldo Lisboa da Cunha)'),
    ).toEqual({
      kind: 'place',
      id: 'ldd',
      label: 'Lab. de Diagnóstico por DNA',
      building: 'haroldinho',
      floor: 'T',
    });
  });
});
