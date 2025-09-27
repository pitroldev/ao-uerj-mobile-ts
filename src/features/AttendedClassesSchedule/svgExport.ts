import {Buffer} from 'buffer';
import {TIME_VALUES} from '@utils/constants/time';
import {AttendedClassesSchedule} from '@features/AttendedClassesSchedule/types';

export type SvgThemeColors = {
  BACKGROUND: string;
  BACKGROUND_400?: string;
  TEXT_PRIMARY: string;
  TEXT_SECONDARY?: string;
  PRIMARY: string;
  MORNING: string;
  AFTERNOON: string;
  NIGHT: string;
};

const sanitize = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const getBoxColorKey = (start: number): keyof SvgThemeColors => {
  if (start < 740) {
    return 'MORNING';
  }
  if (start < 1070) {
    return 'AFTERNOON';
  }
  return 'NIGHT';
};

export const buildWeekSvgDataUri = (
  data: AttendedClassesSchedule[] = [],
  colors: SvgThemeColors,
) => {
  const safeData = data ?? [];

  const weekDays: {number: number; name: string}[] = [];
  safeData.forEach(c => {
    if (!weekDays.some(w => w.number === c.dayNumber)) {
      weekDays.push({number: c.dayNumber, name: c.dayAlias});
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
  const bg = colors.BACKGROUND;
  const cardFill = '#ffffff';
  const cardStroke = colors.BACKGROUND_400 || '#bbb';
  const textPrimary = colors.TEXT_PRIMARY;
  const primary = colors.PRIMARY;
  const textOnPrimary = colors.TEXT_SECONDARY || '#ffffff';

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
      const {start_time_in_minutes, end_time_in_minutes} = item;
      const {periodAlias: startPeriod, startTimeAlias} =
        TIME_VALUES.find(
          t => start_time_in_minutes === t.start_time_in_minutes,
        ) ?? ({periodAlias: '??', startTimeAlias: '??'} as any);
      const {periodAlias: endPeriod, endTimeAlias} =
        TIME_VALUES.find(t => t.end_time_in_minutes === end_time_in_minutes) ??
        ({periodAlias: '??', endTimeAlias: '??'} as any);
      const fill = colors[getBoxColorKey(start_time_in_minutes)] as string;
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

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect x="0" y="0" width="100%" height="100%" fill="${bg}" />
        ${header}
        ${sections.join('\n')}
      </svg>`;

  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
};
