import { DARK, LIGHT, type AppTheme } from '../index';

/** Razão de contraste do WCAG 2 entre duas cores `#RRGGBB`. */
function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (hi + 0.05) / (lo + 0.05);
}

/** Pares de texto que as telas usam, com o mínimo AA para texto normal. */
function textPairs(theme: AppTheme): [string, string, string][] {
  const c = theme.colors;
  const sheet = { ...c, ...theme.sheetColors };
  const pairs: [string, string, string][] = [];
  for (const [name, bg] of [
    ['background', c.background],
    ['surface', c.surface],
    ['surfaceMuted', c.surfaceMuted],
    ['surfacePressed', c.surfacePressed],
    ['surfaceStrong', c.surfaceStrong],
    ['float', c.float],
    ['sheet surface', sheet.surface],
    ['sheet surfaceStrong', sheet.surfaceStrong],
  ] as const) {
    pairs.push([`ink on ${name}`, c.ink, bg]);
    pairs.push([`inkMuted on ${name}`, c.inkMuted, bg]);
  }
  for (const [name, bg] of [
    ['background', c.background],
    ['surface', c.surface],
    ['sheet surface', sheet.surface],
    ['accentSoft', c.accentSoft],
  ] as const) {
    pairs.push([`accent on ${name}`, c.accent, bg]);
  }
  pairs.push(['ink on accentSoft', c.ink, c.accentSoft]);
  pairs.push(['ink on selection', c.ink, c.selection]);
  pairs.push(['onFill on fill', c.onFill, c.fill]);
  pairs.push(['onFill on fillPressed', c.onFill, c.fillPressed]);
  pairs.push(['onBrand on brand', c.onBrand, c.brand]);
  for (const tone of ['good', 'warn', 'bad', 'neutral', 'info'] as const) {
    const t = theme.status[tone];
    pairs.push([`${tone} on its bg`, t.ink, t.bg]);
    pairs.push([`${tone} on its wash`, t.ink, t.wash]);
    pairs.push([`${tone} on background`, t.ink, c.background]);
    pairs.push([`ink on ${tone} wash`, c.ink, t.wash]);
  }
  for (const tone of ['morning', 'afternoon', 'night'] as const) {
    pairs.push([
      `${tone} on its bg`,
      theme.shift[tone].ink,
      theme.shift[tone].bg,
    ]);
  }
  pairs.push([
    'warn action on wash',
    c.noticeWarnAction,
    theme.status.warn.wash,
  ]);
  pairs.push(['bad action on wash', c.noticeBadAction, theme.status.bad.wash]);
  pairs.push(['onSnackbar on snackbar', c.onSnackbar, c.snackbar]);
  pairs.push(['snackbarSuccess on snackbar', c.snackbarSuccess, c.snackbar]);
  pairs.push(['snackbarError on snackbar', c.snackbarError, c.snackbar]);
  return pairs;
}

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('%s theme', (_name, theme) => {
  it.each(textPairs(theme))('%s reaches 4.5:1', (_pair, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

it('keeps field borders visible on the dark surfaces where fields sit', () => {
  const c = DARK.colors;
  const sheet = { ...c, ...DARK.sheetColors };
  for (const bg of [c.background, c.surface, sheet.surface]) {
    expect(contrast(c.fieldBorder, bg)).toBeGreaterThanOrEqual(3);
  }
});

it('raises each surface step inside the dark sheet and keeps the light one as is', () => {
  expect(DARK.sheetColors.background).toBe(DARK.colors.sheet);
  expect(DARK.sheetColors.surface).not.toBe(DARK.colors.surface);
  expect(LIGHT.sheetColors).toEqual({});
});
