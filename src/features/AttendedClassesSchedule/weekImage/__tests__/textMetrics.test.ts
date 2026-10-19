import { textWidth, wrapText } from '../textMetrics';

it('measures text with the Inter widths', () => {
  expect(textWidth('mmm', 'Inter-Regular', 20)).toBeGreaterThan(
    textWidth('iii', 'Inter-Regular', 20),
  );
  expect(textWidth('Cálculo', 'Inter-SemiBold', 44)).toBeCloseTo(
    textWidth('Cálculo', 'Inter-SemiBold', 22) * 2,
  );
  // fora da tabela vale a média das letras
  expect(textWidth('ψ', 'Inter-Regular', 10)).toBeGreaterThan(0);
});

it('wraps by words within the width', () => {
  const lines = wrapText(
    'Cálculo Diferencial e Integral II',
    'Inter-SemiBold',
    22,
    143,
    4,
  );
  expect(lines).toEqual(['Cálculo', 'Diferencial e', 'Integral II']);
  lines.forEach(line =>
    expect(textWidth(line, 'Inter-SemiBold', 22)).toBeLessThanOrEqual(143),
  );
});

it('cuts a long word with a hyphen at a syllable', () => {
  expect(wrapText('Teleprocessamento', 'Inter-SemiBold', 22, 143, 3)).toEqual([
    'Teleproces-',
    'samento',
  ]);
});

it('ends the last line with an ellipsis when the text does not fit', () => {
  const lines = wrapText(
    'Algoritmos e Estruturas de Dados I',
    'Inter-SemiBold',
    22,
    143,
    2,
  );
  expect(lines).toHaveLength(2);
  expect(lines[1].endsWith('…')).toBe(true);
  expect(textWidth(lines[1], 'Inter-SemiBold', 22)).toBeLessThanOrEqual(143);
});
