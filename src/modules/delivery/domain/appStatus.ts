/**
 * Aviso remoto (config/app-status.json, servido pelo GitHub). Versão 1 do
 * esquema; campos novos opcionais não mudam a versão, e um documento com outra
 * versão é ignorado inteiro.
 *
 * O arquivo é público e não tem assinatura: quem conseguir escrever na main
 * (ou tomar o nome da conta no GitHub) publica para todos os apps instalados.
 * Por isso a validação limita o estrago: links só para os destinos de
 * `LINK_DESTINATIONS`, texto sem endereços nem pedido de senha, listas com
 * tamanho máximo.
 */
const APP_STATUS_SCHEMA_VERSION = 1;

export type NoticeLevel = 'info' | 'warning' | 'critical';
type AppPlatform = 'android' | 'ios';

export type RemoteNotice = {
  id: string;
  level: NoticeLevel;
  title: string;
  message: string;
  /** Link "Saiba mais": https, só para os destinos de `LINK_DESTINATIONS`. */
  url?: string;
  /** Data ISO 8601; depois dela o aviso some sozinho. */
  until?: string;
  /** Sem a lista, vale para todas as plataformas. */
  platforms?: AppPlatform[];
};

export type AppStatus = {
  schemaVersion: typeof APP_STATUS_SCHEMA_VERSION;
  /**
   * Semver `MAJOR.MINOR.PATCH`; abaixo dela o app exige atualização. Só pode
   * subir para uma versão já com rollout de 100% na Play.
   */
  minSupportedVersion: string;
  notices: RemoteNotice[];
  /** Identificadores de `FeatureId` (até 32); os desconhecidos são ignorados. */
  disabledFeatures: string[];
};

/**
 * Recursos que o aviso remoto pode desligar (um por tela do menu).
 * `notifications` também cancela os lembretes e para a verificação no portal.
 */
export type FeatureId =
  | 'notifications'
  | 'documents'
  | 'progress'
  | 'graduation-plan'
  | 'schedule-generator'
  | 'message-board'
  | 'subjects-taken'
  | 'curriculum-subjects'
  | 'universal-subjects'
  | 'subject-search'
  | 'teacher-search';

const LEVELS: readonly NoticeLevel[] = ['info', 'warning', 'critical'];
const PLATFORMS: readonly AppPlatform[] = ['android', 'ios'];
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_TITLE = 80;
const MAX_MESSAGE = 400;
const MAX_NOTICES = 10;
const MAX_FEATURES = 32;
const MAX_URL = 300;

type LinkDestination = {
  host: string;
  /** Aceita também os subdomínios (`www.uerj.br`, `alunoonline.uerj.br`). */
  subdomains?: boolean;
  /** Começo obrigatório do caminho (seguido de fim, `/`, `?`, `#` ou `&`). */
  path?: string;
};

/**
 * Destinos do "Saiba mais". Mesmo com o arquivo adulterado, o botão não leva
 * a uma cópia do Aluno Online pedindo a senha, e o domínio aparece no botão
 * antes de abrir. Mantenha o `pattern` de `url` em
 * config/app-status.schema.json igual a esta lista.
 */
const LINK_DESTINATIONS: readonly LinkDestination[] = [
  { host: 'uerj.br', subdomains: true },
  { host: 'pitrol.dev' },
  { host: 'github.com', path: '/pitroldev/ao-uerj-mobile-ts' },
  { host: 'play.google.com', path: '/store/apps/details?id=com.aouerjmobile' },
];
// host em minúsculas e sem usuário (@), porta, barra invertida, espaço ou
// caractere fora do ASCII visível: o host lido aqui é o mesmo que o navegador
// abre
const LINK = /^https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)((?:[/?#][!-~]*)?)$/;
const PATH_END = ['', '/', '?', '#', '&'];

/**
 * O texto não leva a outro endereço (o link vai só em `url`) nem fala em
 * senha: o app só pede a senha na tela de Login. Um ponto sem espaço depois
 * ("notas.Confira") também descarta o aviso; o teste do arquivo commitado
 * acusa.
 */
const UNSAFE_TEXT =
  /[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}|\b(?:senhas?|password)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max && !UNSAFE_TEXT.test(text) ? text : null;
}

/** Domínio de um link permitido do aviso; `null` fora da lista. */
export function noticeLinkHost(url: string): string | null {
  if (url.length > MAX_URL || /[@\\]/.test(url)) return null;
  const [, host, rest = ''] = LINK.exec(url) ?? [];
  if (!host) return null;
  const allowed = LINK_DESTINATIONS.some(
    destination =>
      (host === destination.host ||
        (destination.subdomains && host.endsWith(`.${destination.host}`))) &&
      (!destination.path ||
        (rest.startsWith(destination.path) &&
          PATH_END.includes(rest.charAt(destination.path.length)))),
  );
  return allowed ? host : null;
}

function parseNotice(raw: unknown): RemoteNotice | null {
  if (!isRecord(raw)) return null;
  const { id, level, url, until, platforms } = raw;
  const title = boundedText(raw.title, MAX_TITLE);
  const message = boundedText(raw.message, MAX_MESSAGE);
  if (typeof id !== 'string' || !ID.test(id) || !title || !message) return null;
  if (!LEVELS.includes(level as NoticeLevel)) return null;
  const notice: RemoteNotice = {
    id,
    level: level as NoticeLevel,
    title,
    message,
  };
  if (url !== undefined) {
    if (typeof url !== 'string' || !noticeLinkHost(url)) return null;
    notice.url = url;
  }
  if (until !== undefined) {
    if (typeof until !== 'string' || Number.isNaN(Date.parse(until)))
      return null;
    notice.until = until;
  }
  if (platforms !== undefined) {
    if (
      !Array.isArray(platforms) ||
      !platforms.every(p => PLATFORMS.includes(p as AppPlatform))
    )
      return null;
    notice.platforms = platforms as AppPlatform[];
  }
  return notice;
}

/**
 * Valida o documento remoto (ou a cópia salva). O formato geral inválido
 * descarta tudo (`null`); um aviso malformado sai sozinho, para que um erro de
 * digitação num aviso não derrube a versão mínima nem os recursos desativados.
 */
export function parseAppStatus(raw: unknown): AppStatus | null {
  if (!isRecord(raw)) return null;
  const { schemaVersion, minSupportedVersion, notices, disabledFeatures } = raw;
  if (schemaVersion !== APP_STATUS_SCHEMA_VERSION) return null;
  if (
    typeof minSupportedVersion !== 'string' ||
    !VERSION.test(minSupportedVersion)
  )
    return null;
  if (!Array.isArray(notices) || !Array.isArray(disabledFeatures)) return null;
  const seen = new Set<string>();
  const parsed: RemoteNotice[] = [];
  for (const item of notices.slice(0, MAX_NOTICES)) {
    const notice = parseNotice(item);
    if (notice && !seen.has(notice.id)) {
      seen.add(notice.id);
      parsed.push(notice);
    }
  }
  const features = disabledFeatures.filter(
    (feature): feature is string =>
      typeof feature === 'string' && ID.test(feature),
  );
  return {
    schemaVersion: APP_STATUS_SCHEMA_VERSION,
    minSupportedVersion,
    notices: parsed,
    disabledFeatures: [...new Set(features)].slice(0, MAX_FEATURES),
  };
}

/** Compara `MAJOR.MINOR.PATCH` (sufixos como `-rc.1` são ignorados). */
export function compareVersions(a: string, b: string): number {
  const parts = (version: string) =>
    (version.match(/^(\d+)\.(\d+)\.(\d+)/) ?? []).slice(1).map(Number);
  const [left, right] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/**
 * Sem aviso remoto (nem cópia salva), a versão instalada vale. Abaixo da
 * mínima o app ainda confere com a loja antes de bloquear (DeliveryProvider).
 */
export function isVersionSupported(
  current: string,
  status: AppStatus | null,
): boolean {
  return !status || compareVersions(current, status.minSupportedVersion) >= 0;
}

export function isFeatureDisabled(
  status: AppStatus | null,
  feature: FeatureId,
): boolean {
  return Boolean(status?.disabledFeatures.includes(feature));
}

/** Avisos vigentes nesta plataforma que o aluno ainda não dispensou. */
export function visibleNotices(
  status: AppStatus | null,
  {
    now,
    platform,
    dismissed,
  }: { now: number; platform: string; dismissed: ReadonlySet<string> },
): RemoteNotice[] {
  return (status?.notices ?? []).filter(
    notice =>
      !dismissed.has(notice.id) &&
      (!notice.until || Date.parse(notice.until) > now) &&
      (!notice.platforms || notice.platforms.includes(platform as AppPlatform)),
  );
}
