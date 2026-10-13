import React, { useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';
import styled, { useTheme } from 'styled-components/native';

import {
  crScale,
  formatCr,
  labelStride,
  valueLabelX,
  type CrPoint,
} from './crChartModel';

type Props = {
  points: CrPoint[];
  /** Altura do desenho com fonte padrão. */
  height?: number;
};

const Box = styled.View<{ $h: number }>`
  width: 100%;
  height: ${({ $h }) => $h}px;
`;

/** Rótulo acessível do gráfico (o desenho em si é decorativo). */
function crChartLabel(points: CrPoint[]) {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length === 1) {
    return `CR acumulado em ${first.label}: ${formatCr(first.cra)}`;
  }
  return `CR acumulado de ${first.label} a ${last.label}: de ${formatCr(
    first.cra,
  )} para ${formatCr(last.cra)}`;
}

/**
 * "Evolução do CR": CR acumulado em linha cheia de acento com pontos e
 * valores, média de cada período tracejada e grade horizontal com fios.
 * Desenho próprio em SVG, medido pela largura do card.
 */
export function CrChart({ points, height = 200 }: Props) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);

  // os textos do SVG não escalam sozinhos: acompanham a fonte do sistema
  const fs = Math.min(Math.max(fontScale || 1, 1), 1.4);
  const font = theme.typography.caption.fontSize * fs;
  const H = Math.round(height + (fs - 1) * 40);
  const L = Math.round(30 * fs);
  const R = 24;
  const T = Math.round(24 * fs);
  const B = Math.round(30 * fs);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(Math.round(e.nativeEvent.layout.width));

  const label = crChartLabel(points);
  const c = theme.colors;
  const n = points.length;

  let drawing: React.ReactNode = null;
  if (width > 0 && n > 0) {
    const { lo, hi, ticks } = crScale(
      points.flatMap(p => [p.cra, p.periodAverage]),
    );
    const plotW = width - L - R;
    const spacing = n > 1 ? plotW / (n - 1) : plotW;
    const x = (i: number) => (n > 1 ? L + i * spacing : L + plotW / 2);
    const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    const stride = labelStride(n, spacing, 46 * fs);
    // rótulos do eixo Y: alinhados à direita nesta borda, um por linha de grade
    const axisRight = L - 10;
    const axisBaseline = (v: number) => y(v) + font / 3;
    const axisBaselines = ticks.map(axisBaseline);
    // muitos períodos: só o primeiro e o último ganham o valor escrito
    const dense = n > 8;
    const line = (key: 'cra' | 'periodAverage') =>
      points
        .map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
        .join(' ');

    drawing = (
      <Svg width={width} height={H}>
        <G>
          {ticks.map(v => (
            <G key={`grid-${v}`}>
              <Line
                x1={L}
                x2={width - R + 6}
                y1={y(v)}
                y2={y(v)}
                stroke={c.rule}
                strokeWidth={1}
              />
              <SvgText
                x={axisRight}
                y={axisBaseline(v)}
                fontSize={font}
                fontFamily={theme.fonts.regular}
                fill={c.inkMuted}
                textAnchor="end"
              >
                {String(v)}
              </SvgText>
            </G>
          ))}
        </G>
        {n > 1 ? (
          <Polyline
            points={line('periodAverage')}
            fill="none"
            stroke={c.inkSubtle}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        ) : null}
        {points.map((p, i) => (
          <Circle
            key={`avg-${p.label}`}
            cx={x(i)}
            cy={y(p.periodAverage)}
            r={2.5}
            fill={c.inkSubtle}
          />
        ))}
        {n > 1 ? (
          <Polyline
            points={line('cra')}
            fill="none"
            stroke={c.accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((p, i) => {
          const prev = points[i - 1];
          const next = points[i + 1];
          const valley =
            Boolean(prev && next) && prev.cra > p.cra && next.cra > p.cra;
          const below = valley || p.periodAverage > p.cra + 0.05;
          const last = i === n - 1;
          const showValue = !dense || i === 0 || last;
          const value = formatCr(p.cra);
          const baseline = below ? y(p.cra) + 7 + font : y(p.cra) - 10;
          // com fonte grande, o valor do 1º ponto pode cruzar um rótulo do eixo
          const valueX = valueLabelX({
            x: valley ? x(i) + 12 : x(i),
            baseline,
            text: value,
            font,
            axisRight,
            axisBaselines,
          });
          return (
            <G key={`cra-${p.label}`}>
              <Circle
                cx={x(i)}
                cy={y(p.cra)}
                r={4}
                fill={last ? c.accent : c.surface}
                stroke={c.accent}
                strokeWidth={2}
              />
              {showValue ? (
                <SvgText
                  x={valueX}
                  y={baseline}
                  fontSize={font}
                  fontFamily={theme.fonts.semibold}
                  fill={c.ink}
                  textAnchor="middle"
                >
                  {value}
                </SvgText>
              ) : null}
            </G>
          );
        })}
        {points.map((p, i) =>
          (n - 1 - i) % stride === 0 ? (
            <SvgText
              key={`x-${p.label}`}
              x={x(i)}
              y={H - 6}
              fontSize={font}
              fontFamily={theme.fonts.regular}
              fill={c.inkMuted}
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    );
  }

  return (
    <Box
      $h={H}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {drawing}
    </Box>
  );
}
