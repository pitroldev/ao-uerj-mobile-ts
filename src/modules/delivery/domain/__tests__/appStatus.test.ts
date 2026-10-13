import committed from '@/config/app-status.json';
// o Jest lê o .json com JSON.parse: um escape inválido no esquema (`\d` no
// lugar de `\\d`) já quebra esta suíte
import schema from '@/config/app-status.schema.json';
import {
  compareVersions,
  isFeatureDisabled,
  isVersionSupported,
  noticeLinkHost,
  parseAppStatus,
  visibleNotices,
  type AppStatus,
} from '../appStatus';
import { validate } from './jsonSchema';

const notice = {
  id: 'notas-fora',
  level: 'warning',
  title: 'Notas indisponíveis',
  message: 'O Aluno Online mudou a página de notas; a correção está a caminho.',
};

const doc = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  minSupportedVersion: '1.3.0',
  notices: [notice],
  disabledFeatures: ['message-board'],
  ...overrides,
});

describe('parseAppStatus', () => {
  it('accepts the committed config/app-status.json whole (the $schema key is ignored)', () => {
    const status = parseAppStatus(committed);
    expect(status?.minSupportedVersion).toBe(committed.minSupportedVersion);
    // um aviso ou recurso que o app descartaria (link fora da lista, senha no
    // texto, id inválido) quebra o CI em vez de sumir em silêncio
    expect(status?.notices).toHaveLength(committed.notices.length);
    expect(status?.disabledFeatures).toEqual(committed.disabledFeatures);
  });

  it('keeps a valid document with optional notice fields', () => {
    const full = {
      ...notice,
      url: 'https://github.com/pitroldev/ao-uerj-mobile-ts/issues/1',
      until: '2026-10-20T00:00:00-03:00',
      platforms: ['android'],
    };
    expect(parseAppStatus(doc({ notices: [full] }))).toEqual({
      schemaVersion: 1,
      minSupportedVersion: '1.3.0',
      notices: [full],
      disabledFeatures: ['message-board'],
    });
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', '{"schemaVersion":1}'],
    ['another schema version', doc({ schemaVersion: 2 })],
    ['a missing minimum version', doc({ minSupportedVersion: undefined })],
    ['a non-semver minimum version', doc({ minSupportedVersion: 'v1.3' })],
    ['notices that are not a list', doc({ notices: {} })],
    ['disabled features that are not a list', doc({ disabledFeatures: 'x' })],
  ])('ignores %s', (_label, raw) => {
    expect(parseAppStatus(raw)).toBeNull();
  });

  it('drops only the malformed notices, the duplicated ids and unknown values', () => {
    const status = parseAppStatus(
      doc({
        notices: [
          notice,
          { ...notice, title: 'Repetido' },
          { ...notice, id: 'sem-nivel', level: 'urgent' },
          { ...notice, id: 'sem-titulo', title: '   ' },
          { ...notice, id: 'longo', message: 'x'.repeat(401) },
          { ...notice, id: 'http', url: 'http://example.com' },
          { ...notice, id: 'data', until: 'amanhã' },
          { ...notice, id: 'plataforma', platforms: ['web'] },
          { ...notice, id: 'ID Inválido' },
          'texto',
        ],
        disabledFeatures: ['progress', 3, 'Com Espaço', null],
      }),
    );
    expect(status?.notices).toEqual([notice]);
    expect(status?.disabledFeatures).toEqual(['progress']);
  });

  it('reads at most ten notices', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...notice,
      id: `aviso-${i}`,
    }));
    expect(parseAppStatus(doc({ notices: many }))?.notices).toHaveLength(10);
  });

  it('keeps at most 32 distinct disabled features', () => {
    const many = Array.from({ length: 40 }, (_, i) => `recurso-${i}`);
    const features = parseAppStatus(
      doc({ disabledFeatures: ['progress', 'progress', ...many] }),
    )?.disabledFeatures;
    expect(features).toHaveLength(32);
    expect(features?.filter(feature => feature === 'progress')).toHaveLength(1);
  });

  it.each([
    [
      'asks for the password',
      {
        message: 'Confirme matrícula e senha para continuar vendo suas notas.',
      },
    ],
    ['mentions the password in the title', { title: 'Troque a Senha' }],
    [
      'points to an address in the text',
      { message: 'Entre em alunoonline-uerj.com.br para continuar.' },
    ],
    ['carries a link in the text', { message: 'Veja https://example.com/x' }],
    [
      'carries an e-mail in the text',
      { message: 'Escreva para a@exemplo.com' },
    ],
  ])('drops a notice that %s', (_label, overrides) => {
    expect(
      parseAppStatus(doc({ notices: [{ ...notice, ...overrides }] }))?.notices,
    ).toEqual([]);
  });

  it('keeps ordinary text with versions, abbreviations and words like "resenha"', () => {
    const plain = {
      ...notice,
      message:
        'A versão 1.4.0 corrige a resenha das disciplinas (p. ex., notas etc.).',
    };
    expect(parseAppStatus(doc({ notices: [plain] }))?.notices).toEqual([plain]);
  });
});

const ALLOWED_LINKS = [
  ['https://uerj.br', 'uerj.br'],
  ['https://www.uerj.br/', 'www.uerj.br'],
  ['https://alunoonline.uerj.br/requisicaoaluno/', 'alunoonline.uerj.br'],
  ['https://pitrol.dev/aouerj', 'pitrol.dev'],
  ['https://github.com/pitroldev/ao-uerj-mobile-ts', 'github.com'],
  ['https://github.com/pitroldev/ao-uerj-mobile-ts/issues/1', 'github.com'],
  [
    'https://play.google.com/store/apps/details?id=com.aouerjmobile',
    'play.google.com',
  ],
  [
    'https://play.google.com/store/apps/details?id=com.aouerjmobile&hl=pt_BR',
    'play.google.com',
  ],
] as const;

const BLOCKED_LINKS = [
  'http://www.uerj.br/',
  'https://alunoonline-uerj.com.br/login',
  'https://uerj.br.example.com/',
  'https://exemplouerj.br/',
  'https://www.uerj.br@example.com/',
  'https://aluno:senha@www.uerj.br/',
  'https://www.uerj.br\\@example.com/',
  'https://www.uerj.br\\.example.com/',
  'https://www.uerj.br:8443/',
  'https://WWW.UERJ.BR/',
  'https://www.uerj.br/a b',
  'https://www.uerj.br/notícias',
  `https://www.uerj.br/${'x'.repeat(300)}`,
  'https://github.com/pitroldev',
  'https://github.com/pitroldev/ao-uerj-mobile-ts-falso',
  'https://github.com/outra-conta/ao-uerj-mobile-ts',
  'https://play.google.com/store/apps/details?id=com.aouerjmobile.falso',
  'https://play.google.com/store/apps/details?id=com.outro',
  'mailto:contato@pitrol.dev',
];

describe('notice links', () => {
  it.each(ALLOWED_LINKS)('accepts %s and shows %s', (url, host) => {
    expect(noticeLinkHost(url)).toBe(host);
    expect(
      parseAppStatus(doc({ notices: [{ ...notice, url }] }))?.notices,
    ).toHaveLength(1);
  });

  it.each(BLOCKED_LINKS)('drops a notice linking to %s', url => {
    expect(noticeLinkHost(url)).toBeNull();
    expect(
      parseAppStatus(doc({ notices: [{ ...notice, url }] }))?.notices,
    ).toEqual([]);
  });
});

describe('config/app-status.schema.json', () => {
  it('validates the committed config/app-status.json', () => {
    expect(validate(schema, committed)).toEqual([]);
  });

  it('flags what the app would ignore', () => {
    expect(validate(schema, doc())).toEqual([]);
    for (const invalid of [
      doc({ schemaVersion: 2 }),
      doc({ minSupportedVersion: 'v1.3' }),
      doc({ disabledFeatures: ['Com Espaço'] }),
      doc({ notices: [{ ...notice, id: 'ID Inválido' }] }),
      doc({ notices: [{ ...notice, level: 'urgent' }] }),
    ])
      expect(validate(schema, invalid)).not.toEqual([]);
  });

  it('accepts the same notice links as the app', () => {
    const { url } = schema.properties.notices.items.properties;
    for (const link of [
      ...ALLOWED_LINKS.map(([value]) => value),
      ...BLOCKED_LINKS,
    ])
      expect({ link, schema: validate(url, link).length === 0 }).toEqual({
        link,
        schema: noticeLinkHost(link) !== null,
      });
  });
});

describe('versions', () => {
  it.each([
    ['1.3.5', '1.3.5', 0],
    ['1.3.5', '1.3.4', 1],
    ['1.3.5', '1.4.0', -1],
    ['1.10.0', '1.9.9', 1],
    ['2.0.0', '10.0.0', -1],
    ['1.4.0-rc.1', '1.4.0', 0],
  ])('compares %s with %s', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it('blocks only versions below the minimum, and nothing without a status', () => {
    const status = parseAppStatus(doc()) as AppStatus;
    expect(isVersionSupported('1.3.0', status)).toBe(true);
    expect(isVersionSupported('1.12.0', status)).toBe(true);
    expect(isVersionSupported('1.2.9', status)).toBe(false);
    expect(isVersionSupported('0.0.1', null)).toBe(true);
  });

  it('knows which features are disabled', () => {
    const status = parseAppStatus(doc()) as AppStatus;
    expect(isFeatureDisabled(status, 'message-board')).toBe(true);
    expect(isFeatureDisabled(status, 'progress')).toBe(false);
    expect(isFeatureDisabled(null, 'message-board')).toBe(false);
  });
});

describe('visibleNotices', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  const status = parseAppStatus(
    doc({
      notices: [
        notice,
        { ...notice, id: 'expirado', until: '2026-10-12T11:59:59Z' },
        { ...notice, id: 'vigente', until: '2026-10-12T12:00:01Z' },
        { ...notice, id: 'so-ios', platforms: ['ios'] },
        { ...notice, id: 'dispensado' },
      ],
    }),
  );

  it('hides expired, dismissed and other-platform notices', () => {
    const ids = visibleNotices(status, {
      now,
      platform: 'android',
      dismissed: new Set(['dispensado']),
    }).map(n => n.id);
    expect(ids).toEqual(['notas-fora', 'vigente']);
  });

  it('shows platform-specific notices on that platform', () => {
    const ids = visibleNotices(status, {
      now,
      platform: 'ios',
      dismissed: new Set(),
    }).map(n => n.id);
    expect(ids).toContain('so-ios');
  });

  it('has nothing to show without a status', () => {
    expect(
      visibleNotices(null, { now, platform: 'android', dismissed: new Set() }),
    ).toEqual([]);
  });
});
