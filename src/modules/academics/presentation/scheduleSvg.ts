import { TIME_VALUES } from '@utils/constants/time';
import { LIGHT } from '@root/themes';
import { AttendedClassesSchedule } from '@root/modules/academics/domain/models';

/** Cores da imagem da semana, vindas do tema (`theme.colors` e `theme.shift`). */
export type SvgThemeColors = {
  /** Fundo da imagem. */
  background: string;
  /** Fundo do card de cada dia. */
  card: string;
  /** Fio dos cards e dos blocos de aula. */
  rule: string;
  /** Texto. */
  ink: string;
  /** Faixa do topo. */
  brand: string;
  /** Texto sobre a faixa do topo. */
  onBrand: string;
  /** Fundo dos blocos por turno. */
  morning: string;
  afternoon: string;
  night: string;
};

/**
 * A imagem compartilhada usa sempre o tema claro, qualquer que seja o tema do
 * app: ela sai para conversas, galeria e impressão, onde quem recebe não está
 * no escuro de quem enviou, e o claro é o mesmo "documento" para todos.
 */
export const SHARE_IMAGE_COLORS: SvgThemeColors = {
  background: LIGHT.colors.surface,
  card: LIGHT.colors.surface,
  rule: LIGHT.colors.fieldBorder,
  ink: LIGHT.colors.ink,
  brand: LIGHT.colors.brand,
  onBrand: LIGHT.colors.onBrand,
  morning: LIGHT.shift.morning.bg,
  afternoon: LIGHT.shift.afternoon.bg,
  night: LIGHT.shift.night.bg,
};

const sanitize = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const getBoxColorKey = (start: number): 'morning' | 'afternoon' | 'night' => {
  if (start < 740) {
    return 'morning';
  }
  if (start < 1070) {
    return 'afternoon';
  }
  return 'night';
};

/** SVG da semana, desenhado direto pelo `SvgXml` na captura do PNG. */
export const buildWeekSvg = (
  data: AttendedClassesSchedule[] = [],
  colors: SvgThemeColors,
) => {
  const safeData = data ?? [];

  const weekDays: { number: number; name: string }[] = [];
  safeData.forEach(c => {
    if (!weekDays.some(w => w.number === c.dayNumber)) {
      weekDays.push({ number: c.dayNumber, name: c.dayAlias });
    }
  });

  const sortedDays = [...weekDays].sort((a, b) => a.number - b.number);
  const width = 768;
  const marginX = 40;
  const sectionSpacing = 24;
  const headerHeight = 64; // height for each day card's header area
  const paddingTop = 16;
  const paddingBottom = 24;
  const radius = 16;
  const boxHeight = 68;
  const itemSpacing = 12;
  const containerWidth = width - marginX * 2;
  const bg = colors.background;
  const cardFill = colors.card;
  const cardStroke = colors.rule;
  const textPrimary = colors.ink;
  const primary = colors.brand;
  const textOnPrimary = colors.onBrand;

  // Branded header
  const appHeaderHeight = 84;

  let yOffset = appHeaderHeight + 16;
  const sections: string[] = [];

  sortedDays.forEach(d => {
    const classesInThisDay = safeData.filter(c => c.dayAlias === d.name);
    const contentHeight =
      headerHeight +
      paddingTop +
      classesInThisDay.length * boxHeight +
      Math.max(0, classesInThisDay.length - 1) * itemSpacing +
      paddingBottom;

    // Card container
    sections.push(`
        <rect x="${marginX}" y="${yOffset}" rx="${radius}" ry="${radius}" width="${containerWidth}" height="${contentHeight}" fill="${cardFill}" stroke="${cardStroke}" stroke-width="1" />
      `);

    // Day title (left-aligned inside the card)
    sections.push(`
        <text
          x="${marginX + 20}"
          y="${yOffset + 48}"
          font-size="28"
          font-weight="600"
          fill="${textPrimary}"
          font-family="Roboto, Arial, sans-serif"
        >
          ${sanitize(d.name)}
        </text>
      `);

    // Rows
    classesInThisDay.forEach((item, idx) => {
      const y =
        yOffset + headerHeight + paddingTop + idx * (boxHeight + itemSpacing);
      const yMid = y + boxHeight / 2;
      const baselineYNudge = 6;
      const baselineXNudge = 30;
      const leftColWidth = 120;
      const leftTextX = marginX + baselineXNudge;
      const rightTextX = marginX + baselineXNudge + leftColWidth;
      const { start_time_in_minutes, end_time_in_minutes } = item;
      const { periodAlias: startPeriod, startTimeAlias } =
        TIME_VALUES.find(
          t => start_time_in_minutes === t.start_time_in_minutes,
        ) ?? ({ periodAlias: '??', startTimeAlias: '??' } as any);
      const { periodAlias: endPeriod, endTimeAlias } =
        TIME_VALUES.find(t => t.end_time_in_minutes === end_time_in_minutes) ??
        ({ periodAlias: '??', endTimeAlias: '??' } as any);
      const fill = colors[getBoxColorKey(start_time_in_minutes)];
      sections.push(`
          <rect
            x="${marginX + 12}"
            y="${y}"
            rx="${radius}"
            ry="${radius}"
            width="${containerWidth - 24}"
            height="${boxHeight}"
            fill="${fill}"
            stroke="${cardStroke}"
            stroke-width="1"
          />
          <text
            x="${leftTextX}"
            y="${yMid - 10 + baselineYNudge}"
            dominant-baseline="middle"
            font-size="18"
            font-weight="500"
            fill="${textPrimary}"
            font-family="Roboto, Arial, sans-serif"
          >
            ${startPeriod} - ${endPeriod}
          </text>
          <text
            x="${leftTextX}"
            y="${yMid + 10 + baselineYNudge}"
            dominant-baseline="middle"
            font-size="16"
            font-style="italic"
            fill="${textPrimary}"
            font-family="Roboto, Arial, sans-serif"
          >
            ${startTimeAlias} - ${endTimeAlias}
          </text>
          <text
            x="${rightTextX}"
            y="${yMid - 10 + baselineYNudge}"
            dominant-baseline="middle"
            font-size="20"
            fill="${textPrimary}"
            font-family="Roboto, Arial, sans-serif"
          >
            ${sanitize(item.class.name)}
          </text>
          <text
            x="${rightTextX}"
            y="${yMid + 10 + baselineYNudge}"
            dominant-baseline="middle"
            font-size="16"
            fill="${textPrimary}"
            font-family="Roboto, Arial, sans-serif"
          >
            Turma: ${sanitize(item.class.class)}
          </text>
        `);
    });

    yOffset += contentHeight + sectionSpacing;
  });

  const height = yOffset + 8;
  const header = `
      <rect x="0" y="0" width="100%" height="${appHeaderHeight}" fill="${primary}" />
      <text
        x="${width / 2}"
        y="${appHeaderHeight / 2 + 8}"
        font-size="32"
        font-weight="700"
        text-anchor="middle"
        fill="${textOnPrimary}"
        font-family="Roboto, Arial, sans-serif"
      >
        Gerado pelo app AO UERJ
      </text>
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect x="0" y="0" width="100%" height="100%" fill="${bg}" />
        ${header}
        ${sections.join('\n')}
      </svg>`;
};

// O Hermes (RN 0.74+) tem estes globais, mas os tipos do React Native não os
// declaram.
declare const TextEncoder: new () => { encode(input: string): Uint8Array };
declare function btoa(data: string): string;

// Múltiplo de 3: o base64 de cada bloco emenda no seguinte sem padding.
const BASE64_CHUNK_SIZE = 3 * 4096;

/** Data URI do SVG, compartilhado quando a captura em PNG falha. */
export const toSvgDataUri = (svg: string) => {
  const bytes = new TextEncoder().encode(svg);
  let base64 = '';
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(start, start + BASE64_CHUNK_SIZE);
    base64 += btoa(String.fromCharCode(...chunk));
  }
  return `data:image/svg+xml;base64,${base64}`;
};
