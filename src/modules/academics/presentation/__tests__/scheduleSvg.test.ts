import type { AttendedClassesSchedule } from '@root/modules/academics/domain/models';
import { LIGHT } from '@root/themes';
import {
  buildWeekSvg,
  SHARE_IMAGE_COLORS,
  toSvgDataUri,
  type SvgThemeColors,
} from '../scheduleSvg';

declare const TextDecoder: new () => { decode(bytes: Uint8Array): string };
declare function atob(data: string): string;

const PREFIX = 'data:image/svg+xml;base64,';

const colors: SvgThemeColors = {
  background: '#ffffff',
  card: '#ffffff',
  rule: '#d0d0d0',
  ink: '#1a1a1a',
  brand: '#0b3d91',
  onBrand: '#ffffff',
  morning: '#fff4d6',
  afternoon: '#ffe0cc',
  night: '#e0e4ff',
};

const schedule: AttendedClassesSchedule[] = [
  {
    class: {
      id: 'ABC01-12345',
      name: 'Álgebra & Cálculo',
      class: '3',
      avaLocation: '',
      uerjLocation: 'Sala 6001',
      status: 'ACTIVE',
    },
    dayAlias: 'Terça-feira',
    dayNumber: 2,
    subject_id: 'ABC01-12345',
    periodAlias: 'M1',
    startTimeAlias: '7:00',
    endTimeAlias: '8:40',
    start_time_in_minutes: 420,
    end_time_in_minutes: 520,
  },
];

function decodeDataUri(uri: string) {
  expect(uri.startsWith(PREFIX)).toBe(true);
  const binary = atob(uri.slice(PREFIX.length));
  return new TextDecoder().decode(
    Uint8Array.from(binary, char => char.charCodeAt(0)),
  );
}

it('builds the week SVG with escaped, accented text', () => {
  const svg = buildWeekSvg(schedule, colors);
  expect(svg).toContain('Terça-feira');
  expect(svg).toContain('Álgebra &amp; Cálculo');
  expect(svg).toContain('Turma: 3');
});

it('encodes the SVG as UTF-8 base64', () => {
  expect(toSvgDataUri('<text>Terça – €</text>')).toBe(
    `${PREFIX}PHRleHQ+VGVyw6dhIOKAkyDigqw8L3RleHQ+`,
  );
  const svg = buildWeekSvg(schedule, colors);
  expect(decodeDataUri(toSvgDataUri(svg))).toBe(svg);
});

it('joins chunks of large SVGs without padding in the middle', () => {
  // 2-byte characters make chunk boundaries fall inside a character.
  const svg = `<svg>${'ç'.repeat(9000)}€</svg>`;
  const uri = toSvgDataUri(svg);
  expect(uri.slice(PREFIX.length, -2)).not.toContain('=');
  expect(decodeDataUri(uri)).toBe(svg);
});

it('draws the shared image with the light palette, whatever the app theme', () => {
  expect(SHARE_IMAGE_COLORS).toMatchObject({
    background: LIGHT.colors.surface,
    ink: LIGHT.colors.ink,
    brand: LIGHT.colors.brand,
    morning: LIGHT.shift.morning.bg,
  });
  const svg = buildWeekSvg(schedule, SHARE_IMAGE_COLORS);
  expect(svg).toContain(LIGHT.colors.ink);
  expect(svg).toContain(LIGHT.shift.morning.bg);
});
