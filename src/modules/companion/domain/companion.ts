/*
 * Companhia agora: encontros que duram minutos, entre alunos que não se
 * conhecem. Uma mesa aberta no almoço ou a volta em grupo depois da última
 * aula da noite. Quem chama diz onde e quando; quem quiser vai junto. Nada
 * vira grupo, nada fica guardado depois do horário, e o ponto de encontro é
 * sempre um lugar movimentado dentro do campus. As regras do servidor estão
 * em server/src/modules/companion/domain.ts; aqui ficam as que o app usa.
 */

/** `lunch`: almoço e pausa. `home`: a volta junto até a estação ou o ponto. */
export type CallKind = 'lunch' | 'home';
export type SpotId = 'ru' | 'lago' | 'concha' | 'portao-1' | 'portao-5';
export type DestinationId = 'metro' | 'trem' | 'onibus';
export type PhraseId = 'on_my_way' | 'at_spot' | 'late' | 'home_safe';
export type ReportReason = 'harassment' | 'strange' | 'spam' | 'other';

export const CALL_KINDS: readonly CallKind[] = ['lunch', 'home'];
export const DESTINATION_IDS: readonly DestinationId[] = [
  'metro',
  'trem',
  'onibus',
];
export const REPORT_REASONS: readonly ReportReason[] = [
  'harassment',
  'strange',
  'spam',
  'other',
];

/** Os pontos de encontro de cada tipo, na ordem em que o app oferece. */
export const SPOTS_BY_KIND: Readonly<Record<CallKind, readonly SpotId[]>> = {
  lunch: ['ru', 'lago', 'concha'],
  home: ['concha', 'portao-1', 'portao-5'],
};

/** Os recados prontos; "Não vou mais" é sair da chamada. */
export const PHRASES_BY_KIND: Readonly<Record<CallKind, readonly PhraseId[]>> =
  {
    lunch: ['on_my_way', 'at_spot', 'late'],
    home: ['on_my_way', 'at_spot', 'late', 'home_safe'],
  };

/** Vagas, contando quem chamou: até 6 na mesa e 8 na volta. */
export const CAPACITY: Readonly<
  Record<CallKind, { min: number; max: number; initial: number }>
> = {
  lunch: { min: 2, max: 6, initial: 6 },
  home: { min: 2, max: 8, initial: 8 },
};

export const NOTE_MAX = 80;
export const NAME_MAX = 20;

const MINUTE = 60 * 1000;
/** Até quanto à frente se abre uma chamada (o servidor recusa depois). */
export const LEAD_MS = 3 * 60 * MINUTE;

/** Uma chamada como quem está fora a vê. Horários em ms desde 1970. */
export type CompanionCall = {
  id: string;
  kind: CallKind;
  at: number;
  spot: SpotId;
  destination: DestinationId | null;
  note: string;
  /** O primeiro nome de quem chamou. */
  host: string;
  going: number;
  capacity: number;
  /** Depois disso, ninguém mais entra. */
  listedUntil: number;
  /** Quando some de vez. */
  expiresAt: number;
};

export type CallMember = { name: string; host: boolean; you: boolean };
export type CallPhrase = {
  name: string;
  phrase: PhraseId;
  at: number;
  you: boolean;
};

/** A chamada como quem está dentro a vê: os primeiros nomes e os recados. */
export type MemberCall = CompanionCall & {
  endedAt: number | null;
  members: CallMember[];
  feed: CallPhrase[];
};

/**
 * Uma participação guardada no aparelho, no cofre: a chave de membro (que
 * vale só nesta chamada) e o bastante para os lembretes e o Início sem rede.
 */
export type Membership = {
  callId: string;
  memberKey: string;
  host: boolean;
  kind: CallKind;
  at: number;
  spot: SpotId;
  destination: DestinationId | null;
  expiresAt: number;
};

/** O pedido de quem chama. */
export type OpenCallRequest = {
  kind: CallKind;
  at: number;
  spot: SpotId;
  destination: DestinationId | null;
  note: string;
  capacity: number;
  name: string;
};

/** Por que o servidor recusou um pedido da Companhia agora. */
export type CompanionRefusal =
  /** Acabou, saiu do ar pelas denúncias ou nunca existiu. */
  | 'gone'
  | 'full'
  /** Já saiu (passou do horário) ou quem chamou encerrou. */
  | 'closed'
  | 'ended'
  /** Telefone, @ ou link no recado. */
  | 'contact'
  /** A chave não é desta chamada (outra instalação, dados apagados). */
  | 'not_member'
  /** O teto de chamadas do campus. */
  | 'busy'
  /** O passe de leitura venceu: pedir outro (o app faz sozinho). */
  | 'pass_expired';

export class CompanionError extends Error {
  constructor(readonly refusal: CompanionRefusal) {
    super(`companion: ${refusal}`);
    this.name = 'CompanionError';
  }
}

/**
 * Telefone, @, link ou o nome de um aplicativo de conversa: o recado combina
 * o encontro, não o contato (a mesma regra do servidor). Oito algarismos
 * seguidos, com espaço, ponto, traço ou parêntese no meio, já são um
 * telefone; um horário não.
 */
const CONTACT =
  /(?:\d[\s().-]*){8,}|@|https?:|www\.|\.(?:com|br|me)\b|whats|wpp|\bzap\b|insta|telegram|t\.me|discord|tiktok/i;

export const hasContact = (text: string) => CONTACT.test(text);

/**
 * Letras do alfabeto latino, com acento (o Hermes do app não garante os
 * `\p{L}` do servidor, que aceita qualquer letra).
 */
const LETTERS = 'A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u017F';
/** Os acentos que vêm separados da letra (NFD). */
const MARKS = '\\u0300-\\u036F';
const NAME = new RegExp(`^[${LETTERS}][${LETTERS}${MARKS}'\\u2019-]*$`);
const NOT_NAME = new RegExp(`[^${LETTERS}${MARKS}'\\u2019-]`, 'g');

/** Só o primeiro nome, uma palavra de letras: o que o servidor aceita. */
export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= NAME_MAX && NAME.test(trimmed);
}

/**
 * O primeiro nome do nome da conta, sem acento perdido nem sobrenome
 * ("MARINA DA SILVA" → "Marina"); vazio se não houver letra.
 */
export function firstNameOf(fullName: string): string {
  const [word = ''] = fullName.trim().split(/\s+/);
  const letters = word.replace(NOT_NAME, '').slice(0, NAME_MAX);
  if (!letters) return '';
  const lower = letters.toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}

/** Ainda dá para entrar: na lista, sem passar do horário e com vaga. */
export const canJoin = (call: CompanionCall, now: number) =>
  now < call.listedUntil && call.going < call.capacity;

export const seatsLeft = (call: CompanionCall) =>
  Math.max(0, call.capacity - call.going);

/** A participação ainda vale no aparelho. */
export const isCurrent = (membership: Membership, now: number) =>
  now < membership.expiresAt;

/** A participação a partir da chamada que o servidor devolveu. */
export function membershipOf(
  call: MemberCall,
  memberKey: string,
  host: boolean,
): Membership {
  return {
    callId: call.id,
    memberKey,
    host,
    kind: call.kind,
    at: call.at,
    spot: call.spot,
    destination: call.destination,
    expiresAt: call.expiresAt,
  };
}
