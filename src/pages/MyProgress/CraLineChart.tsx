import React, { useState } from 'react';
import Svg, { Circle, G, Text as SvgText, Line } from 'react-native-svg';
import styled from 'styled-components/native';

type Point = { label: string; cra: number };

type CraLineChartProps = {
  data: Point[];
  width?: number;
  height?: number;
};

const Wrapper = styled.View`
  align-items: center;
`;

const ChartBox = styled.View`
  width: 100%;
`;

export default function CraLineChart({
  data,
  width,
  height,
}: CraLineChartProps) {
  const [cw, setCw] = useState<number | null>(null);
  if (!data || data.length === 0) {
    return null;
  }
  const W = (typeof width === 'number' ? width : cw) || 0;
  const H =
    typeof height === 'number'
      ? height
      : W > 0
      ? Math.max(180, Math.round(W * 0.6))
      : 200;

  if (!width && !cw) {
    return (
      <Wrapper>
        <ChartBox
          onLayout={e => setCw(e.nativeEvent.layout.width)}
          style={{ height: H }}
        />
      </Wrapper>
    );
  }

  const padding = 16;
  const bottomExtra = 14;
  const innerW = W - padding * 2;
  const innerH = H - (padding * 2 + bottomExtra);
  const axisY = H - (padding + bottomExtra);

  const values = data.map(d => d.cra);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 10);
  const range = Math.max(max - min, 1);

  const xFor = (i: number) =>
    (i / Math.max(data.length - 1, 1)) * innerW + padding;
  const yFor = (v: number) => padding + (1 - (v - min) / range) * innerH;

  // Smooth color interpolation
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  const rgbToHex = (r: number, g: number, b: number) =>
    `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  const parseHex = (c: string) => ({
    r: parseInt(c.slice(1, 3), 16),
    g: parseInt(c.slice(3, 5), 16),
    b: parseInt(c.slice(5, 7), 16),
  });
  const interp = (c1: string, c2: string, t: number) => {
    const a = parseHex(c1);
    const b = parseHex(c2);
    return rgbToHex(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
  };
  const colorFor = (cra: number) => {
    const red = '#c62828';
    const amber = '#f9a825';
    const green = '#2e7d32';
    if (cra <= 6) {
      return interp(red, amber, Math.max(0, Math.min(1, cra / 6)));
    }
    return interp(amber, green, Math.max(0, Math.min(1, (cra - 6) / 4)));
  };

  const yTicks = [min, min + range / 2, max];

  return (
    <Wrapper>
      <ChartBox onLayout={e => setCw(e.nativeEvent.layout.width)}>
        <Svg width={W} height={H}>
          <G>
            <Line
              x1={padding}
              y1={padding}
              x2={padding}
              y2={axisY}
              stroke="#ccc"
              strokeWidth={1}
            />
            <Line
              x1={padding}
              y1={axisY}
              x2={W - padding}
              y2={axisY}
              stroke="#ccc"
              strokeWidth={1}
            />

            {yTicks.map((t, idx) => (
              <G key={`yt-${idx}`}>
                <Line
                  x1={padding - 4}
                  y1={yFor(t)}
                  x2={W - padding}
                  y2={yFor(t)}
                  stroke="#eee"
                  strokeWidth={1}
                />
                <SvgText x={8} y={yFor(t) + 4} fontSize={10} fill="#666">
                  {Math.round(t).toString()}
                </SvgText>
              </G>
            ))}

            {data.map((d, i) => {
              if (i === data.length - 1) {
                return null;
              }
              const x1 = xFor(i);
              const y1 = yFor(d.cra);
              const x2 = xFor(i + 1);
              const y2 = yFor(data[i + 1].cra);
              const stroke = colorFor((d.cra + data[i + 1].cra) / 2);
              return (
                <Line
                  key={`seg-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={stroke}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                />
              );
            })}

            {data.map((d, i) => (
              <G key={`p-${i}`}>
                <Circle
                  cx={xFor(i)}
                  cy={yFor(d.cra)}
                  r={3.5}
                  fill={colorFor(d.cra)}
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                <SvgText
                  x={xFor(i)}
                  y={axisY + 12}
                  fontSize={8}
                  fill="#666"
                  textAnchor="end"
                  transform={`rotate(-30 ${xFor(i)} ${axisY + 12})`}
                >
                  {d.label}
                </SvgText>
              </G>
            ))}
          </G>
        </Svg>
      </ChartBox>
    </Wrapper>
  );
}
