import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import { calculateCraProgression } from '@root/modules/academics/domain/rules/progress';
import {
  crChartPoints,
  crScale,
  formatCr,
  labelStride,
  numberWidth,
  valueLabelX,
} from '../crChartModel';

const course = (fields: Partial<SubjectsTaken> = {}): SubjectsTaken => ({
  id: 'IME01-12345',
  name: 'Álgebra',
  period: '2024.1',
  credits: 4,
  workload: 60,
  type: 'MANDATORY',
  frequency: 100,
  grade: 8,
  status: 'APPROVED',
  ...fields,
});

describe('crChartPoints', () => {
  it('pairs the cumulative CR with the average of each period', () => {
    const subjects = [
      course({ id: 'A', period: '2024.1', grade: 8 }),
      course({ id: 'B', period: '2024.2', grade: 6, credits: 2 }),
      course({ id: 'C', period: '2024.2', grade: 9, credits: 2 }),
    ];
    const { pointsOverTime } = calculateCraProgression(subjects);
    expect(crChartPoints(pointsOverTime, subjects)).toEqual([
      { label: '2024.1', cra: 8, periodAverage: 8 },
      { label: '2024.2', cra: 7.75, periodAverage: 7.5 },
    ]);
  });

  it('leaves out the period in progress, which has no grades yet', () => {
    const subjects = [
      course({ id: 'A', period: '2024.1' }),
      course({ id: 'B', period: '2024.2', grade: null, status: 'IN_PROGRESS' }),
    ];
    const { pointsOverTime } = calculateCraProgression(subjects);
    expect(pointsOverTime).toHaveLength(2);
    expect(crChartPoints(pointsOverTime, subjects).map(p => p.label)).toEqual([
      '2024.1',
    ]);
  });
});

describe('crScale', () => {
  it('wraps the values in whole grades with room below the lowest point', () => {
    expect(crScale([8.25, 7, 7.77, 5.74, 8.5])).toEqual({
      lo: 5,
      hi: 9,
      ticks: [5, 6, 7, 8, 9],
    });
  });

  it('keeps at least two grades of range and stays within 0–10', () => {
    expect(crScale([10, 10])).toEqual({ lo: 8, hi: 10, ticks: [8, 9, 10] });
    expect(crScale([0])).toEqual({ lo: 0, hi: 2, ticks: [0, 1, 2] });
  });

  it('spaces grid lines by two when the range is wide', () => {
    expect(crScale([2.4, 9.1]).ticks).toEqual([0, 2, 4, 6, 8, 10]);
  });
});

describe('labels', () => {
  it('skips period labels only when they would collide', () => {
    expect(labelStride(7, 50, 46)).toBe(1);
    expect(labelStride(12, 27, 46)).toBe(2);
  });

  it('formats the CR with two decimals and a comma', () => {
    expect(formatCr(7.7666)).toBe('7,77');
    expect(formatCr(8)).toBe('8,00');
  });
});

describe('valueLabelX', () => {
  // geometria do CrChart com a escala 5–9 e o 1º ponto em 8,25
  const geometry = (fs: number) => {
    const font = 12 * fs;
    const L = Math.round(30 * fs);
    const T = Math.round(24 * fs);
    const B = Math.round(30 * fs);
    const H = Math.round(200 + (fs - 1) * 40);
    const y = (v: number) => T + ((9 - v) * (H - T - B)) / 4;
    return {
      font,
      x: L,
      axisRight: L - 10,
      axisBaselines: [5, 6, 7, 8, 9].map(v => y(v) + font / 3),
      baseline: y(8.25) - 10,
    };
  };

  it('keeps the value centred on the point with the default font', () => {
    const g = geometry(1);
    expect(valueLabelX({ ...g, text: '8,25' })).toBe(g.x);
  });

  it('moves the value right, clear of the Y axis labels, with a large font', () => {
    const g = geometry(1.3);
    const x = valueLabelX({ ...g, text: '8,25' });
    expect(x).toBeGreaterThan(g.x);
    // a borda esquerda do valor fica a 3 px da coluna do eixo
    expect(x - numberWidth('8,25', g.font) / 2).toBeCloseTo(g.axisRight + 3);
  });

  it('leaves values away from the axis labels alone', () => {
    const g = geometry(1.3);
    // longe da coluna do eixo
    expect(valueLabelX({ ...g, x: 120, text: '7,00' })).toBe(120);
    // perto da coluna, mas entre duas linhas de grade
    const between = (g.axisBaselines[2] + g.axisBaselines[3]) / 2;
    expect(valueLabelX({ ...g, baseline: between, text: '7,50' })).toBe(g.x);
  });
});
