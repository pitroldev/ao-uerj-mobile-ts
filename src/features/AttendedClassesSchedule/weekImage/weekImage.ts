/**
 * Imagem da semana para compartilhar: um pôster vertical com a grade horária
 * (uma coluna por dia, a altura de cada aula na escala do relógio), uma cor por
 * disciplina e a legenda com nome, turma, sala e código. É um SVG em texto,
 * desenhado pelo `SvgXml` e capturado em PNG.
 */
import { LIGHT } from '@root/themes';
import {
  AO_LOGO_PATHS,
  AO_LOGO_VIEWBOX,
} from '@components/ui/AoLogo/logoPaths';
import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { subjectKey } from '@root/modules/academics/domain/rules/subjectId';
import { TIME_VALUES } from '@utils/constants/time';

import {
  hasClassTime,
  isCanceled,
  splitLocation,
  WEEKDAY_SHORT,
  weekdayOf,
} from '../scheduleFormat';
import { textWidth, wrapText, type FontName } from './textMetrics';

/** Cores de cada disciplina: fundo do bloco, faixa e texto. */
type SubjectColors = { tint: string; accent: string; ink: string };

/**
 * Tons distintos entre si e com contraste de texto, na ordem em que as
 * disciplinas aparecem na semana (as vizinhas ficam com tons diferentes).
 */
export const SUBJECT_PALETTE: readonly SubjectColors[] = [
  { tint: '#E3EDFB', accent: '#2563C9', ink: '#0F2F66' },
  { tint: '#DDF2EC', accent: '#0E8A74', ink: '#0B4A3F' },
  { tint: '#FBEDD5', accent: '#C2790A', ink: '#5A3905' },
  { tint: '#F5E2EE', accent: '#B4377E', ink: '#5F1A41' },
  { tint: '#E5ECD8', accent: '#5E8A1E', ink: '#2D440F' },
  { tint: '#EAE5F9', accent: '#6D4FC2', ink: '#33246B' },
  { tint: '#FCE4DC', accent: '#D0532E', ink: '#6B2410' },
  { tint: '#DFEFF7', accent: '#1F7EA8', ink: '#0D3D54' },
  { tint: '#EFEBE3', accent: '#7A6A4F', ink: '#3D3527' },
  { tint: '#E8EBF0', accent: '#56627A', ink: '#283042' },
];

/**
 * Sempre o tema claro, qualquer que seja o do app: a imagem sai para
 * conversas, galeria e impressão, onde quem recebe não está no escuro de quem
 * enviou.
 */
const C = {
  background: '#FFFFFF',
  track: LIGHT.colors.surfaceMuted,
  rule: LIGHT.colors.rule,
  ink: LIGHT.colors.ink,
  muted: LIGHT.colors.inkMuted,
  subtle: LIGHT.colors.inkSubtle,
  logo: LIGHT.colors.logo,
};

const W = 1080;
const PAD = 56;
/** Coluna das horas, à esquerda da grade. */
const GUTTER = 64;
const COL_GAP = 10;
const DAY_HEAD = 56;
/** Unidades por minuto: um tempo (50 min) tem 70 de altura. */
const SCALE = 1.4;
/** Espaço entre dois trechos do dia (o vazio entre eles some). */
const SEGMENT_GAP = 40;
/** Um vazio a partir disto, em todos os dias, vira só o espaço entre trechos. */
const COLLAPSE_MINUTES = 120;

const ROOM_NOT_INFORMED = 'Sala não informada';

type Block = {
  item: AttendedClassesSchedule;
  day: number;
  start: number;
  end: number;
  key: string;
};

type Subject = {
  key: string;
  id: string;
  name: string;
  turma: string;
  rooms: string[];
  colors: SubjectColors;
};

type Segment = { start: number; end: number; top: number };

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function text(
  value: string,
  x: number,
  y: number,
  font: FontName,
  size: number,
  fill: string,
  extra = '',
) {
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}"${extra}>${escape(value)}</text>`;
}

function logo(x: number, y: number, width: number, fill: string) {
  const [, , vbWidth] = AO_LOGO_VIEWBOX.split(/\s+/).map(Number);
  const scale = width / vbWidth;
  const paths = AO_LOGO_PATHS.map(d => `<path d="${d}" fill="${fill}"/>`).join(
    '',
  );
  return `<g transform="translate(${x} ${y}) scale(${scale})">${paths}</g>`;
}

const logoHeight = (width: number) => {
  const [, , vbWidth, vbHeight] = AO_LOGO_VIEWBOX.split(/\s+/).map(Number);
  return (width * vbHeight) / vbWidth;
};

/** "7:00–8:40". */
const hours = (item: AttendedClassesSchedule) =>
  `${item.startTimeAlias}–${item.endTimeAlias}`;

/** Tempos da aula, pela tabela da UERJ ("M1–M2" são 2). */
const slotsOf = (block: Block) =>
  Math.max(
    1,
    TIME_VALUES.filter(
      slot =>
        slot.start_time_in_minutes >= block.start &&
        slot.end_time_in_minutes <= block.end,
    ).length,
  );

/** A sala sem o resto do endereço; nada quando o portal não informa. */
function roomOf(item: AttendedClassesSchedule): string | null {
  const { room } = splitLocation(item.class?.uerjLocation);
  return room === ROOM_NOT_INFORMED ? null : room;
}

/**
 * Trechos do dia com aula: os vazios longos, iguais em todos os dias, somem
 * (quem tem aula de manhã e à noite não vê a tarde em branco). Cada trecho
 * começa e termina em hora cheia.
 */
function segmentsOf(blocks: readonly Block[], top: number): Segment[] {
  const intervals = blocks
    .map(block => [block.start, block.end] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const joined: [number, number][] = [];
  for (const [start, end] of intervals) {
    const last = joined[joined.length - 1];
    if (last && start - last[1] < COLLAPSE_MINUTES) {
      last[1] = Math.max(last[1], end);
    } else joined.push([start, end]);
  }
  const padded: [number, number][] = [];
  for (const [start, end] of joined) {
    const from = Math.floor(start / 60) * 60;
    const to = Math.ceil(end / 60) * 60;
    const last = padded[padded.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else padded.push([from, to]);
  }
  let y = top;
  return padded.map(([start, end]) => {
    const segment = { start, end, top: y };
    y += (end - start) * SCALE + SEGMENT_GAP;
    return segment;
  });
}

const segmentHeight = (segment: Segment) =>
  (segment.end - segment.start) * SCALE;

function yOf(segments: readonly Segment[], minutes: number) {
  const segment =
    segments.find(item => minutes >= item.start && minutes <= item.end) ??
    segments[segments.length - 1];
  return segment.top + (minutes - segment.start) * SCALE;
}

/**
 * O bloco de uma aula: fundo da disciplina, faixa à esquerda e o texto. O
 * recorte da faixa vai para o `<defs>`.
 */
function blockSvg(
  block: Block,
  subject: Subject,
  x: number,
  y: number,
  width: number,
  height: number,
  id: number,
) {
  const { colors } = subject;
  const padY = height < 90 ? 9 : 13;
  const textX = x + 18;
  const textWidthMax = width - 18 - 10;
  const NAME = { font: 'Inter-SemiBold' as const, size: 22, line: 27 };
  const META = { size: 19, line: 24 };
  const room = roomOf(block.item);
  const available = height - padY * 2;

  // o que cabe: o nome em quantas linhas der, o horário e a sala
  let showRoom = Boolean(room);
  let showTime = true;
  const nameLinesFor = () =>
    Math.floor(
      (available -
        (showTime ? META.line : 0) -
        (showRoom ? META.line : 0) -
        (NAME.size - NAME.line + 4)) /
        NAME.line,
    );
  if (nameLinesFor() < 1) showRoom = false;
  if (nameLinesFor() < 1) showTime = false;
  const name = wrapText(
    subject.name,
    NAME.font,
    NAME.size,
    textWidthMax,
    Math.max(1, Math.min(4, nameLinesFor())),
  );

  const clip = `<clipPath id="b${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14"/></clipPath>`;
  const parts: string[] = [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${colors.tint}"/>`,
    `<rect x="${x}" y="${y}" width="6" height="${height}" fill="${colors.accent}" clip-path="url(#b${id})"/>`,
  ];
  let baseline = y + padY + NAME.size - 2;
  for (const line of name) {
    parts.push(text(line, textX, baseline, NAME.font, NAME.size, colors.ink));
    baseline += NAME.line;
  }
  baseline += META.line - NAME.line + 2;
  if (showTime) {
    parts.push(
      text(
        hours(block.item),
        textX,
        baseline,
        'Inter-Medium',
        META.size,
        colors.ink,
        ' fill-opacity="0.78"',
      ),
    );
    baseline += META.line;
  }
  if (showRoom && room) {
    const [line] = wrapText(room, 'Inter-Regular', META.size, textWidthMax, 1);
    parts.push(
      text(
        line,
        textX,
        baseline,
        'Inter-Regular',
        META.size,
        colors.ink,
        ' fill-opacity="0.78"',
      ),
    );
  }
  return { clip, body: parts.join('') };
}

export type WeekImageOptions = {
  /** "2026.1"; sem ele, o subtítulo fica só com os números da semana. */
  period?: string | null;
  /** Professores de cada disciplina (por `subjectKey`), na legenda. */
  teachers?: ReadonlyMap<string, readonly string[]>;
};

/** SVG da semana (1080 de largura; a altura acompanha a grade e a legenda). */
export function buildWeekImage(
  data: readonly AttendedClassesSchedule[] = [],
  { period, teachers }: WeekImageOptions = {},
): string {
  const blocks: Block[] = data
    .filter(item => hasClassTime(item) && !isCanceled(item))
    .map(item => ({
      item,
      day: weekdayOf(item),
      start: item.start_time_in_minutes,
      end: item.end_time_in_minutes,
      key: subjectKey(item.class?.id ?? item.subject_id),
    }))
    .filter(block => block.day >= 1 && block.day <= 6)
    .sort((a, b) => a.day - b.day || a.start - b.start);

  // as disciplinas na ordem em que aparecem na semana, cada uma com sua cor
  const subjects = new Map<string, Subject>();
  for (const block of blocks) {
    const room = roomOf(block.item);
    const known = subjects.get(block.key);
    if (known) {
      if (room && !known.rooms.includes(room)) known.rooms.push(room);
      continue;
    }
    subjects.set(block.key, {
      key: block.key,
      id: block.item.class?.id ?? block.item.subject_id,
      name: block.item.class?.name ?? block.item.subject_id,
      turma: String(block.item.class?.class ?? '').trim(),
      rooms: room ? [room] : [],
      colors: SUBJECT_PALETTE[subjects.size % SUBJECT_PALETTE.length],
    });
  }

  const parts: string[] = [];
  const clips: string[] = [];

  // cabeçalho: título, resumo da semana e o logo
  const logoWidth = 112;
  parts.push(logo(W - PAD - logoWidth, 62, logoWidth, C.logo));
  parts.push(text('Minha grade', PAD, 124, 'InterDisplay-SemiBold', 68, C.ink));
  const slots = blocks.reduce((sum, block) => sum + slotsOf(block), 0);
  const summary = [
    period,
    subjects.size ? plural(subjects.size, 'disciplina', 'disciplinas') : null,
    slots ? plural(slots, 'tempo por semana', 'tempos por semana') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  if (summary) {
    parts.push(text(summary, PAD, 176, 'Inter-Regular', 30, C.muted));
  }

  let y = 236;
  if (!blocks.length) {
    parts.push(
      text(
        'Sem aulas com horário nesta semana.',
        PAD,
        y + 60,
        'Inter-Regular',
        30,
        C.muted,
      ),
    );
    y += 120;
  } else {
    // dias: segunda a sexta sempre; sábado, se houver aula
    const lastDay = Math.max(5, ...blocks.map(block => block.day));
    const days = Array.from({ length: lastDay }, (_, i) => i + 1);
    const gridLeft = PAD + GUTTER;
    const gridWidth = W - PAD - gridLeft;
    const colWidth = (gridWidth - COL_GAP * (days.length - 1)) / days.length;
    const colX = (index: number) => gridLeft + index * (colWidth + COL_GAP);

    days.forEach((day, index) => {
      parts.push(
        text(
          WEEKDAY_SHORT[day].toUpperCase(),
          colX(index) + colWidth / 2,
          y + 30,
          'Inter-SemiBold',
          22,
          C.muted,
          ' text-anchor="middle" letter-spacing="1.5"',
        ),
      );
    });

    const segments = segmentsOf(blocks, y + DAY_HEAD);
    for (const segment of segments) {
      const height = segmentHeight(segment);
      days.forEach((_, index) => {
        parts.push(
          `<rect x="${colX(index)}" y="${segment.top}" width="${colWidth}" height="${height}" rx="16" fill="${C.track}"/>`,
        );
      });
      for (let minutes = segment.start; minutes <= segment.end; minutes += 60) {
        const lineY = segment.top + (minutes - segment.start) * SCALE;
        if (minutes > segment.start && minutes < segment.end) {
          parts.push(
            `<line x1="${gridLeft}" x2="${W - PAD}" y1="${lineY}" y2="${lineY}" stroke="${C.rule}" stroke-width="1.5"/>`,
          );
        }
        parts.push(
          text(
            `${minutes / 60}h`,
            gridLeft - 14,
            lineY + 7,
            'Inter-Medium',
            20,
            C.subtle,
            ' text-anchor="end"',
          ),
        );
      }
    }

    blocks.forEach((block, i) => {
      const subject = subjects.get(block.key) as Subject;
      const index = days.indexOf(block.day);
      const top = yOf(segments, block.start) + 2;
      const bottom = yOf(segments, block.end) - 2;
      const { clip, body } = blockSvg(
        block,
        subject,
        colX(index),
        top,
        colWidth,
        bottom - top,
        i,
      );
      clips.push(clip);
      parts.push(body);
    });

    const last = segments[segments.length - 1];
    y = last.top + segmentHeight(last);

    // legenda: o nome inteiro e o que não coube nos blocos
    y += 64;
    parts.push(
      text(
        'DISCIPLINAS',
        PAD,
        y,
        'Inter-SemiBold',
        22,
        C.subtle,
        ' letter-spacing="1.5"',
      ),
    );
    y += 28;
    const nameX = PAD + 46;
    const nameWidth = W - PAD - nameX;
    for (const subject of subjects.values()) {
      const nameLines = wrapText(
        subject.name,
        'Inter-SemiBold',
        28,
        nameWidth,
        2,
      );
      // a turma com quem dá a aula; depois, onde e o código. Vírgula entre os
      // professores: um "e" se confundiria com o de "Castro e Silva".
      const people = [
        subject.turma ? `Turma ${subject.turma}` : null,
        teachers?.get(subject.key)?.join(', ') || null,
      ]
        .filter(Boolean)
        .join(' · ');
      const place = [subject.rooms.join(' / ') || null, subject.id]
        .filter(Boolean)
        .join(' · ');
      const metaLines = [
        ...(people ? wrapText(people, 'Inter-Regular', 23, nameWidth, 2) : []),
        ...wrapText(place, 'Inter-Regular', 23, nameWidth, 2),
      ];
      parts.push(
        `<rect x="${PAD}" y="${y + 12}" width="26" height="26" rx="7" fill="${subject.colors.accent}"/>`,
      );
      let baseline = y + 34;
      for (const line of nameLines) {
        parts.push(text(line, nameX, baseline, 'Inter-SemiBold', 28, C.ink));
        baseline += 34;
      }
      baseline -= 3;
      for (const line of metaLines) {
        parts.push(text(line, nameX, baseline, 'Inter-Regular', 23, C.muted));
        baseline += 30;
      }
      y = baseline + 8;
    }
  }

  // rodapé discreto: o logo e o nome do app
  y += 24;
  parts.push(
    `<line x1="${PAD}" x2="${W - PAD}" y1="${y}" y2="${y}" stroke="${C.rule}" stroke-width="1.5"/>`,
  );
  const footer = 'Feito com o app AO UERJ';
  const footerLogo = 50;
  const footerWidth = footerLogo + 14 + textWidth(footer, 'Inter-Medium', 22);
  const footerX = (W - footerWidth) / 2;
  parts.push(
    logo(footerX, y + 34, footerLogo, C.logo),
    text(
      footer,
      footerX + footerLogo + 14,
      y + 34 + logoHeight(footerLogo) / 2 + 8,
      'Inter-Medium',
      22,
      C.subtle,
    ),
  );
  const height = Math.ceil(y + 34 + logoHeight(footerLogo) + 40);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}"><defs>${clips.join('')}</defs><rect width="${W}" height="${height}" fill="${C.background}"/>${parts.join('')}</svg>`;
}
