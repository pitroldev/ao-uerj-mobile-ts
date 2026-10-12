import type { SubjectsTaken } from '@root/modules/academics/domain/models';
import { calculateCumulativeAverage } from '@root/modules/academics/domain/rules/progress';

/** Ponto do gráfico "Evolução do CR". */
export type CrPoint = {
  /** Período ("2025.1"). */
  label: string;
  /** CR acumulado até o período (regra do app, aproximado). */
  cra: number;
  /** Média só do período (mesma regra, aplicada às disciplinas dele). */
  periodAverage: number;
};

/** Mesmo critério de tentativa com nota do CR aproximado do domínio. */
function hasGrade(subject: SubjectsTaken) {
  return (
    subject.status !== 'IN_PROGRESS' &&
    subject.grade !== null &&
    Number.isFinite(subject.grade) &&
    subject.credits !== null &&
    Number.isFinite(subject.credits) &&
    subject.credits > 0
  );
}

/**
 * Pontos do gráfico: os períodos encerrados (com alguma nota), cada um com o
 * CR acumulado do domínio e a média só do período, calculada com a mesma
 * regra de média ponderada. O período em curso, ainda sem notas, fica de fora
 * para não aparecer como um CR "do período" que não existe.
 */
export function crChartPoints(
  points: readonly { label: string; cra: number }[],
  subjects: readonly SubjectsTaken[],
): CrPoint[] {
  const result: CrPoint[] = [];
  for (const point of points) {
    const inPeriod = subjects.filter(s => s.period === point.label);
    if (!inPeriod.some(hasGrade)) continue;
    result.push({
      label: point.label,
      cra: point.cra,
      periodAverage: calculateCumulativeAverage(inPeriod),
    });
  }
  return result;
}

/**
 * Escala vertical do gráfico: inteiros de 0 a 10 que envolvem os valores com
 * folga embaixo (para o rótulo de um vale não encostar nos períodos), no
 * mínimo 2 pontos de amplitude e linhas de grade de 1 em 1 (ou de 2 em 2
 * quando a amplitude passa de 5).
 */
export function crScale(values: readonly number[]) {
  const finite = values.filter(v => Number.isFinite(v));
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 10;
  let lo = Math.max(0, Math.floor(min - 0.5));
  let hi = Math.min(10, Math.max(lo, Math.ceil(max)));
  while (hi - lo < 2) {
    if (hi < 10) hi += 1;
    else lo -= 1;
  }
  const step = hi - lo > 5 ? 2 : 1;
  lo = Math.floor(lo / step) * step;
  hi = Math.min(10, Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

/**
 * Quais períodos ganham rótulo no eixo: todos quando cabem; senão de N em N,
 * contando a partir do último (o período atual sempre aparece).
 */
export function labelStride(count: number, spacing: number, minGap: number) {
  if (count < 2 || spacing <= 0) return 1;
  return Math.max(1, Math.ceil(minGap / spacing));
}

/** "7,77": duas casas e vírgula, como o app mostra o CR. */
export function formatCr(value: number) {
  return value.toFixed(2).replace('.', ',');
}

// medidas aproximadas (com folga) do Inter para números, em em
const DIGIT_EM = 0.62;
const MARK_EM = 0.3;
const CAP_EM = 0.73;
/** A vírgula desce um pouco abaixo da linha de base. */
const DESCENT_EM = 0.15;

/** Largura aproximada de um número escrito em Inter ("8,25"). */
export function numberWidth(text: string, font: number) {
  let em = 0;
  for (const ch of text) em += ch >= '0' && ch <= '9' ? DIGIT_EM : MARK_EM;
  return em * font;
}

/**
 * Centro horizontal do valor escrito de um ponto (texto centrado) sem invadir
 * a coluna de rótulos do eixo Y, que termina em `axisRight`. Quando o valor
 * cruza a altura de algum rótulo do eixo (fonte do sistema grande e ponto
 * perto do topo, por exemplo), anda para a direita só o necessário; nos
 * outros casos fica centrado no ponto, como no desenho.
 */
export function valueLabelX({
  x,
  baseline,
  text,
  font,
  axisRight,
  axisBaselines,
  gap = 3,
}: {
  x: number;
  baseline: number;
  text: string;
  font: number;
  axisRight: number;
  axisBaselines: readonly number[];
  gap?: number;
}) {
  const half = numberWidth(text, font) / 2;
  const minX = axisRight + gap + half;
  if (x >= minX) return x;
  const top = baseline - CAP_EM * font;
  const bottom = baseline + DESCENT_EM * font;
  const crossesAxisLabel = axisBaselines.some(
    b => top < b + gap && bottom > b - CAP_EM * font - gap,
  );
  return crossesAxisLabel ? minX : x;
}
