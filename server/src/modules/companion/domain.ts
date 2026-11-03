import { createHash, randomBytes } from 'node:crypto';

import { DomainError, InvalidInputError } from '../../shared/errors.ts';

/*
 * Companhia agora: encontros que duram minutos, entre alunos que não se
 * conhecem. Uma mesa aberta no almoço ou a volta em grupo depois da última
 * aula da noite. Quem chama diz onde e quando; quem quiser vai junto. Nada
 * vira grupo: a chamada some sozinha pouco depois do horário, e o ponto de
 * encontro é sempre um lugar movimentado dentro do campus.
 */

/** `lunch`: almoço e pausa. `home`: a volta junto até a estação ou o ponto. */
export const CALL_KINDS = ['lunch', 'home'] as const;
export type CallKind = (typeof CALL_KINDS)[number];

/**
 * Os pontos de encontro: lugares do Mapa do app, dentro do campus, e os
 * tipos de chamada em que cada um vale. Nunca na rua, nunca na casa de
 * alguém.
 */
export const SPOTS = {
  ru: ['lunch'],
  lago: ['lunch'],
  concha: ['lunch', 'home'],
  'portao-1': ['home'],
  'portao-5': ['home'],
} as const satisfies Record<string, readonly CallKind[]>;
export type SpotId = keyof typeof SPOTS;
export const SPOT_IDS = Object.keys(SPOTS) as SpotId[];

/** O destino da volta, sempre genérico: nunca o bairro ou o endereço. */
export const DESTINATIONS = ['metro', 'trem', 'onibus'] as const;
export type DestinationId = (typeof DESTINATIONS)[number];

/**
 * Os recados prontos (não há conversa livre). "Não vou mais" é sair da
 * chamada, não um recado; "Cheguei em casa" só existe na volta.
 */
export const PHRASES = {
  on_my_way: ['lunch', 'home'],
  at_spot: ['lunch', 'home'],
  late: ['lunch', 'home'],
  home_safe: ['home'],
} as const satisfies Record<string, readonly CallKind[]>;
export type PhraseId = keyof typeof PHRASES;
export const PHRASE_IDS = Object.keys(PHRASES) as PhraseId[];

export const REPORT_REASONS = [
  'harassment',
  'strange',
  'spam',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Tamanhos e vagas, os mesmos no HTTP e no banco. */
export const COMPANION_LIMITS = {
  /** Só o primeiro nome. */
  name: 20,
  note: 80,
  /** Os recados mais recentes que a chamada guarda. */
  feed: 60,
  capacity: {
    lunch: { min: 2, max: 6 },
    home: { min: 2, max: 8 },
  },
} as const;

const MINUTE = 60 * 1000;

/** Quando a chamada aparece, sai da lista e some de vez. */
export const CALL_TIMES = {
  /** Aparece na lista 1 hora antes do horário. */
  visibleBeforeMs: 60 * MINUTE,
  /** Sai da lista depois do horário: ninguém mais entra. */
  listedAfterMs: { lunch: 30 * MINUTE, home: 10 * MINUTE },
  /**
   * Some de vez (do banco também): a mesa 30 minutos depois do horário, a
   * volta 2 horas depois da saída, para dar tempo do "Cheguei em casa".
   */
  lifetimeMs: { lunch: 30 * MINUTE, home: 120 * MINUTE },
  /** Até quanto à frente se abre uma chamada. */
  leadMs: 3 * 60 * MINUTE,
  /** Um horário que acabou de passar ainda vale (o relógio do aparelho). */
  lateMs: 5 * MINUTE,
} as const;

/**
 * Com tantas denúncias de pessoas diferentes de dentro da chamada (fora quem
 * chamou), ela sai do ar. Assédio denunciado por quem está nela tira na hora.
 * A denúncia de fora não tira nada sozinha: cada uma gasta um token, e uma
 * pessoa só, com três tokens, derrubaria qualquer chamada. Ela vai para a
 * moderação, que pode tirar a chamada do ar.
 */
export const MEMBER_REPORTS_TO_HIDE = 2;
/** Teto de chamadas valendo ao mesmo tempo, no campus inteiro. */
export const MAX_ALIVE_CALLS = 500;
/** As denúncias ficam para a moderação por 30 dias; a chamada, não. */
export const REPORT_RETENTION_MS = 30 * 24 * 60 * MINUTE;

/** A marca de quem denunciou de fora (o resto é o id de um membro). */
export const OUTSIDER_PREFIX = 'outsider:';

/** Quem está na chamada: o hash da chave de membro e o primeiro nome. */
export type Member = {
  /** SHA-256 (hex) da chave que só o aparelho dessa pessoa tem. */
  id: string;
  /**
   * Um apelido ao acaso que só os membros veem: quem chamou tira alguém
   * da chamada por ele, sem o servidor mostrar o hash da chave.
   */
  ref: string;
  name: string;
  host: boolean;
  joinedAt: Date;
};

/** De onde veio a denúncia, para a moderação. */
export type ReportSource = 'member' | 'host' | 'outsider';

export type FeedEntry = {
  member: string;
  name: string;
  phrase: PhraseId;
  at: Date;
};

export type Call = {
  id: string;
  kind: CallKind;
  /** O horário do encontro (ou da saída, na volta). */
  at: Date;
  spot: SpotId;
  destination: DestinationId | null;
  /** Recado de quem chamou; vazio sem recado. */
  note: string;
  capacity: number;
  members: Member[];
  feed: FeedEntry[];
  /** Quem denunciou: o membro, ou uma marca ao acaso para quem está fora. */
  reporters: string[];
  /** Os ids de quem quem chamou tirou da chamada. */
  removed: string[];
  /** Quem chamou encerrou. */
  endedAt: Date | null;
  /** Saiu do ar pelas denúncias ou pela moderação. */
  hiddenAt: Date | null;
  /** Quando chegou a duas pessoas (para os números do dia). */
  filledAt: Date | null;
  /** O primeiro "Cheguei no ponto" (para os números do dia). */
  arrivedAt: Date | null;
  visibleFrom: Date;
  listedUntil: Date;
  expiresAt: Date;
};

/** O pedido de quem chama, já com os tipos conferidos. */
export type CallRequest = {
  kind: CallKind;
  at: Date;
  spot: SpotId;
  destination: DestinationId | null;
  note: string;
  capacity: number;
  name: string;
};

/** O que quem está fora vê: o primeiro nome de quem chamou e quantos vão. */
export type PublicCall = {
  id: string;
  kind: CallKind;
  at: Date;
  spot: SpotId;
  destination: DestinationId | null;
  note: string;
  host: string;
  going: number;
  capacity: number;
  listedUntil: Date;
  expiresAt: Date;
};

/** O que quem está dentro vê: os primeiros nomes e os recados. */
export type MemberCall = PublicCall & {
  endedAt: Date | null;
  members: { ref: string; name: string; host: boolean; you: boolean }[];
  feed: { name: string; phrase: PhraseId; at: Date; you: boolean }[];
};

/** O que a moderação recebe: a chamada como estava, sem as chaves. */
export type CallReport = {
  id: string;
  callId: string;
  kind: CallKind;
  at: Date;
  spot: SpotId;
  destination: DestinationId | null;
  note: string;
  names: string[];
  reason: ReportReason;
  /** De dentro, de quem chamou ou de fora; `null` nas de antes do campo. */
  source: ReportSource | null;
  /** As denúncias da chamada até aqui, esta inclusive. */
  count: number;
  hidden: boolean;
  /** Quando a chamada some de vez: até lá, a moderação ainda a tira do ar. */
  callExpiresAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
};

/** A chave de membro: só o aparelho a guarda; o servidor, o hash. */
export const MEMBER_KEY_BYTES = 32;
export const newMemberKey = () => randomBytes(MEMBER_KEY_BYTES);
export const memberId = (key: Buffer) =>
  createHash('sha256').update(key).digest('hex');

/** 16 caracteres ao acaso: o id não diz a ordem nem a hora da criação. */
export const newCallId = () => randomBytes(12).toString('base64url');

/** 11 caracteres ao acaso: o apelido do membro dentro da chamada. */
export const newMemberRef = () => randomBytes(8).toString('base64url');

/**
 * Quem olha a lista, para a contagem de "de olho agora": o hash do passe
 * de aluno, que vale uma hora e não se liga a ninguém.
 */
export const viewerId = (pass: string) =>
  createHash('sha256').update(pass).digest('hex');

/** Quanto tempo quem olhou a lista conta como "de olho agora". */
export const WATCH_WINDOW_MS = 15 * MINUTE;

/** A denúncia de dentro (fora quem chamou) que tira a chamada do ar. */
export function hidesCall(
  call: Call,
  reason: ReportReason,
  source: ReportSource,
): boolean {
  if (source !== 'member') return false;
  if (reason === 'harassment') return true;
  const host = call.members.find(member => member.host)?.id;
  const fromMembers = call.reporters.filter(
    reporter => !reporter.startsWith(OUTSIDER_PREFIX) && reporter !== host,
  );
  return fromMembers.length >= MEMBER_REPORTS_TO_HIDE;
}

/* -------------------------------------------------------- os números do dia */

/**
 * Os números anônimos da Companhia agora, por dia de São Paulo: só
 * contagens, sem id, nome, recado ou hora exata. Servem para saber se a
 * mesa enche, se as pessoas chegam e onde a lista fica vazia.
 */
export const STAT_KEYS = [
  'opened_lunch',
  'opened_home',
  /** Chamadas que chegaram a duas pessoas. */
  'filled_lunch',
  'filled_home',
  /** Chamadas que lotaram. */
  'full',
  'joined',
  'left',
  'ended',
  'removed',
  'phrase_on_my_way',
  'phrase_at_spot',
  'phrase_late',
  'phrase_home_safe',
  /** Chamadas com pelo menos um "Cheguei no ponto". */
  'arrived_lunch',
  'arrived_home',
  'reports_member',
  'reports_host',
  'reports_outsider',
  'hidden_reports',
  'hidden_moderation',
  /** Aberturas recusadas pelo teto do campus. */
  'busy',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** Por hora (0–23): quem chegou à lista e quem a achou vazia. */
export type HourStatKey = `lookers_h${number}` | `empty_h${number}`;

export type DayStats = {
  /** O dia em São Paulo, AAAA-MM-DD. */
  day: string;
  counts: Partial<Record<StatKey | HourStatKey, number>>;
};

/** Os números ficam meio ano. */
export const STATS_RETENTION_MS = 183 * 24 * 60 * MINUTE;

const SAO_PAULO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** O dia (AAAA-MM-DD) e a hora (0–23) de `date` em São Paulo. */
export function statSlot(date: Date): { day: string; hour: number } {
  const parts = Object.fromEntries(
    SAO_PAULO.formatToParts(date).map(part => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
  };
}

const NAME = /^[\p{L}\p{M}][\p{L}\p{M}'’-]*$/u;

/** O primeiro nome, uma palavra só, sem número nem símbolo. */
export function checkName(raw: string): string {
  const name = raw.trim();
  if (!name || name.length > COMPANION_LIMITS.name || !NAME.test(name))
    throw new InvalidInputError(
      `name must be a first name of up to ${COMPANION_LIMITS.name} letters`,
    );
  return name;
}

/**
 * Telefone, @, link ou o nome de um aplicativo de conversa: o recado
 * combina o encontro, não o contato. Oito algarismos seguidos (com espaço,
 * ponto, traço ou parêntese no meio) já são um telefone; um horário não.
 */
const CONTACT =
  /(?:\d[\s().-]*){8,}|@|https?:|www\.|\.(?:com|br|me)\b|whats|wpp|\bzap\b|insta|telegram|t\.me|discord|tiktok/i;

export const hasContact = (text: string) => CONTACT.test(text);

/** O recado numa linha, sem os espaços repetidos. */
export const normalizeNote = (text: string) => text.replace(/\s+/g, ' ').trim();

/** A chamada nova, com os prazos; recusa o que não cabe nas regras. */
export function planCall(
  request: CallRequest,
  { id, now, host }: { id: string; now: Date; host: Member },
): Call {
  const { kind, at, spot, destination, capacity } = request;
  const allowedSpots: readonly CallKind[] = SPOTS[spot];
  if (!allowedSpots.includes(kind))
    throw new InvalidInputError(
      `spot ${spot} is not a meeting point for ${kind}`,
    );
  if (kind === 'home' && !destination)
    throw new InvalidInputError('destination is required for home');
  if (kind === 'lunch' && destination)
    throw new InvalidInputError('destination is only for home');
  const limits = COMPANION_LIMITS.capacity[kind];
  if (
    !Number.isInteger(capacity) ||
    capacity < limits.min ||
    capacity > limits.max
  )
    throw new InvalidInputError(
      `capacity must be from ${limits.min} to ${limits.max} for ${kind}`,
    );
  const time = at.getTime();
  if (
    !Number.isFinite(time) ||
    time < now.getTime() - CALL_TIMES.lateMs ||
    time > now.getTime() + CALL_TIMES.leadMs
  )
    throw new InvalidInputError('at must be within the next 3 hours');
  const note = normalizeNote(request.note);
  if (note.length > COMPANION_LIMITS.note)
    throw new InvalidInputError(
      `note must be at most ${COMPANION_LIMITS.note} characters`,
    );
  if (hasContact(note))
    throw new DomainError(
      'note_not_allowed',
      'The note cannot carry a phone number, an @ or a link',
    );
  return {
    id,
    kind,
    at,
    spot,
    destination: kind === 'home' ? destination : null,
    note,
    capacity,
    members: [host],
    feed: [],
    reporters: [],
    removed: [],
    endedAt: null,
    hiddenAt: null,
    filledAt: null,
    arrivedAt: null,
    visibleFrom: new Date(time - CALL_TIMES.visibleBeforeMs),
    listedUntil: new Date(time + CALL_TIMES.listedAfterMs[kind]),
    expiresAt: new Date(time + CALL_TIMES.lifetimeMs[kind]),
  };
}

/** Na lista agora: já apareceu, ainda não passou e ninguém a tirou. */
export const isListed = (call: Call, now: Date) =>
  call.visibleFrom <= now &&
  now < call.listedUntil &&
  !call.endedAt &&
  !call.hiddenAt;

/** Ainda vale para quem está dentro (recados, "Cheguei em casa"). */
export const isAlive = (call: Call, now: Date) =>
  now < call.expiresAt && !call.hiddenAt;

export const phraseFits = (phrase: PhraseId, kind: CallKind) =>
  (PHRASES[phrase] as readonly CallKind[]).includes(kind);

export function publicView(call: Call): PublicCall {
  return {
    id: call.id,
    kind: call.kind,
    at: call.at,
    spot: call.spot,
    destination: call.destination,
    note: call.note,
    host: call.members.find(member => member.host)?.name ?? '',
    going: call.members.length,
    capacity: call.capacity,
    listedUntil: call.listedUntil,
    expiresAt: call.expiresAt,
  };
}

export function memberView(call: Call, member: string): MemberCall {
  return {
    ...publicView(call),
    endedAt: call.endedAt,
    members: call.members.map(item => ({
      ref: item.ref,
      name: item.name,
      host: item.host,
      you: item.id === member,
    })),
    feed: call.feed.map(entry => ({
      name: entry.name,
      phrase: entry.phrase,
      at: entry.at,
      you: entry.member === member,
    })),
  };
}
