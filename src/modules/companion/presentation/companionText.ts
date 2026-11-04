import type { IconName } from '@components/ui/Icon/glyphs';
import { AppError, errorMessage } from '@root/shared/errors/AppError';
import {
  CompanionError,
  type CallKind,
  type CompanionCall,
  type DestinationId,
  type Membership,
  type PhraseId,
  type ReportReason,
  type SpotId,
} from '../domain/companion';
import type { CompanionReminderKey } from '../domain/reminders';

/** Onde fica cada ponto de encontro no Mapa do app (um lugar ou um desenho). */
export type MapAnchor = { place: string } | { shape: string };

export const SPOT_TEXT: Readonly<
  Record<
    SpotId,
    { name: string; short: string; detail: string; map: MapAnchor }
  >
> = {
  ru: {
    name: 'Restaurante Universitário (RU)',
    short: 'RU',
    detail: 'Na entrada do restaurante, no Centro Cultural',
    map: { place: 'ru' },
  },
  lago: {
    name: 'Lago dos Peixinhos',
    short: 'Lago dos Peixinhos',
    detail: 'No pátio entre os blocos A e B',
    map: { shape: 'lago-dos-peixinhos' },
  },
  concha: {
    name: 'Concha Acústica',
    short: 'Concha Acústica',
    detail: 'Em frente à Concha Acústica Marielle Franco',
    map: { place: 'concha' },
  },
  'portao-1': {
    name: 'Portão 1, do lado de dentro',
    short: 'Portão 1',
    detail: 'Av. Rei Pelé (Radial Oeste), saída para a Estação Maracanã',
    map: { place: 'portao-metro' },
  },
  'portao-5': {
    name: 'Portão 5, do lado de dentro',
    short: 'Portão 5',
    detail: 'Rua São Francisco Xavier, 524',
    map: { place: 'portao-sfx' },
  },
};

export const DESTINATION_TEXT: Readonly<
  Record<
    DestinationId,
    {
      name: string;
      /** "Volta para o metrô". */
      short: string;
      icon: IconName;
      /** Por onde se sai do campus. */
      exit: SpotId;
      /** O lugar do destino no Mapa, quando ele aparece no desenho. */
      place?: string;
    }
  >
> = {
  metro: {
    name: 'Estação Maracanã · Metrô Linha 2',
    short: 'metrô',
    icon: 'subway',
    exit: 'portao-1',
    place: 'metro',
  },
  trem: {
    name: 'Estação Maracanã · Trens',
    short: 'trem',
    icon: 'train',
    exit: 'portao-1',
    place: 'trem',
  },
  onibus: {
    name: 'Ponto de ônibus da São Francisco Xavier',
    short: 'ponto de ônibus',
    icon: 'directions_bus',
    exit: 'portao-5',
  },
};

/**
 * As palavras de cada tipo, para quem acabou de entrar na faculdade: no
 * almoço, uma "mesa"; na saída, um "grupo para voltar". Nunca "chamada", que
 * na faculdade é a lista de presença. Quem cria é "quem abriu".
 */
export const KIND_TEXT: Readonly<
  Record<
    CallKind,
    {
      label: string;
      icon: IconName;
      section: string;
      cta: string;
      join: string;
      joined: string;
      sheetTitle: string;
      /** O convite do Início com a lista vazia. */
      first: string;
      /** "mesa", "grupo". */
      noun: string;
      /** "a mesa", "o grupo". */
      the: string;
      /** "esta mesa", "este grupo". */
      this: string;
      /** "essa mesa", "esse grupo". */
      that: string;
      /** "desta mesa", "deste grupo". */
      ofThis: string;
      /** "da mesa", "do grupo". */
      ofThe: string;
      /** "nessa mesa", "nesse grupo". */
      inThat: string;
      /** "Sua mesa", "Seu grupo". */
      yours: string;
      /** "aberta", "aberto". */
      opened: string;
      /** "Lotada", "Lotado". */
      full: string;
      /** "Veja outra ou abra a sua", "Veja outro ou abra o seu". */
      another: string;
      /** "Mesa encerrada", "Grupo encerrado". */
      ended: string;
    }
  >
> = {
  lunch: {
    label: 'Almoço e pausa',
    icon: 'restaurant',
    section: 'Mesas abertas',
    cta: 'Abrir mesa',
    join: 'Sentar junto',
    joined: 'Você vai sentar junto',
    sheetTitle: 'Abrir uma mesa',
    first: 'Abrir a primeira mesa',
    noun: 'mesa',
    the: 'a mesa',
    this: 'esta mesa',
    that: 'essa mesa',
    ofThis: 'desta mesa',
    ofThe: 'da mesa',
    inThat: 'nessa mesa',
    yours: 'Sua mesa',
    opened: 'aberta',
    full: 'Lotada',
    another: 'Veja outra ou abra a sua',
    ended: 'Mesa encerrada',
  },
  home: {
    label: 'Voltar junto',
    icon: 'directions_walk',
    section: 'Grupos para voltar',
    cta: 'Abrir grupo',
    join: 'Entrar no grupo',
    joined: 'Você está no grupo',
    sheetTitle: 'Abrir um grupo para voltar',
    first: 'Abrir um grupo para voltar',
    noun: 'grupo',
    the: 'o grupo',
    this: 'este grupo',
    that: 'esse grupo',
    ofThis: 'deste grupo',
    ofThe: 'do grupo',
    inThat: 'nesse grupo',
    yours: 'Seu grupo',
    opened: 'aberto',
    full: 'Lotado',
    another: 'Veja outro ou abra o seu',
    ended: 'Grupo encerrado',
  },
};

/** A primeira letra em maiúscula ("Essa mesa…"). */
const capitalized = (text: string) =>
  text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);

export const PHRASE_TEXT: Readonly<Record<PhraseId, string>> = {
  on_my_way: 'Estou indo',
  at_spot: 'Cheguei no ponto',
  late: 'Atrasei 5 min',
  home_safe: 'Cheguei em casa',
};

/** "Não vou mais" é sair da chamada, com o mesmo lugar dos recados. */
export const LEAVE_PHRASE = 'Não vou mais';

export const REASON_TEXT: Readonly<Record<ReportReason, string>> = {
  harassment: 'Assédio ou ofensa',
  strange: 'Comportamento estranho',
  spam: 'Spam ou propaganda',
  other: 'Outro motivo',
};

const pad = (value: number) => String(value).padStart(2, '0');

/** "12:30", "9:05" (o formato dos horários da UERJ no app). */
export function clockText(ms: number): string {
  const date = new Date(ms);
  return `${date.getHours()}:${pad(date.getMinutes())}`;
}

/** "em 12 min", "agora", "há 5 min". */
export function relativeText(at: number, now: number): string {
  const minutes = Math.round((at - now) / 60000);
  if (minutes === 0) return 'agora';
  if (minutes > 0) {
    if (minutes < 60) return `em ${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `em ${h}h${m ? pad(m) : ''}`;
  }
  return `há ${-minutes} min`;
}

type CallLike = Pick<CompanionCall, 'kind' | 'at' | 'spot' | 'destination'>;

/** "Mesa no RU, 12:30" ou "Grupo para o metrô, 22:15". */
export function callTitle(call: CallLike): string {
  const time = clockText(call.at);
  if (call.kind === 'home' && call.destination)
    return `Grupo para o ${DESTINATION_TEXT[call.destination].short}, ${time}`;
  return `Mesa no ${SPOT_TEXT[call.spot].short}, ${time}`;
}

/** "1 vai", "3 vão". */
export const goingText = (going: number) =>
  `${going} ${going === 1 ? 'vai' : 'vão'}`;

/** "1 vaga", "4 vagas". */
export const seatsText = (seats: number) =>
  `${seats} ${seats === 1 ? 'vaga' : 'vagas'}`;

/** Por quanto tempo a chamada fica, dito ao abrir. */
export const LIFETIME_TEXT: Readonly<Record<CallKind, string>> = {
  lunch: 'A mesa some 30 minutos depois do horário.',
  home: 'O grupo some 2 horas depois da saída.',
};

/**
 * O que dizer quando um pedido não deu certo; com o tipo, fala "mesa" ou
 * "grupo" (sem ele, a frase fica sem o nome).
 */
export function companionErrorMessage(error: unknown, kind?: CallKind): string {
  if (error instanceof CompanionError) {
    const words = kind ? KIND_TEXT[kind] : null;
    switch (error.refusal) {
      case 'gone':
        return words
          ? `${capitalized(words.that)} já acabou ou saiu do ar.`
          : 'Já acabou ou saiu do ar.';
      case 'full':
        return words
          ? `${capitalized(words.that)} lotou. ${words.another}.`
          : 'Lotou. Veja outra opção ou abra a sua.';
      case 'closed':
        return words
          ? `${capitalized(words.that)} já saiu. ${words.another}.`
          : 'Já saiu. Veja outra opção ou abra a sua.';
      case 'ended':
        return words
          ? `Quem abriu encerrou ${words.the}.`
          : 'Quem abriu encerrou.';
      case 'contact':
        return 'Telefone, @ e links ficam fora: combine aqui só o encontro.';
      case 'not_member':
        return words
          ? `Você não está mais ${words.inThat}.`
          : 'Você não está mais aqui.';
      case 'removed':
        return words
          ? `Quem abriu tirou você ${words.ofThis}.`
          : 'Quem abriu tirou você daqui.';
      case 'not_host':
        return 'Só quem abriu pode tirar alguém.';
      case 'member_gone':
        return 'Essa pessoa já tinha saído.';
      case 'already_member':
        return words
          ? `Você já está ${words.inThat}, por outro aparelho.`
          : 'Você já está aqui, por outro aparelho.';
      case 'busy':
        return 'Tem muita gente abrindo agora. Tente de novo em alguns minutos.';
      default:
        return 'Não deu certo. Tente de novo.';
    }
  }
  if (error instanceof AppError && error.code === 'STUDENT_PROOF_UNAVAILABLE')
    return 'Não foi possível confirmar agora que você é aluno da UERJ. Abra o app com a internet ligada e tente de novo mais tarde.';
  return errorMessage(error);
}

/**
 * Os outros alunos de olho na lista agora (o número do servidor conta quem
 * pergunta): "12 alunos de olho agora", ou nada se só há você.
 */
export function watchingText(watching: number): string | null {
  const others = watching - 1;
  if (others < 1) return null;
  return `${others} ${others === 1 ? 'aluno' : 'alunos'} de olho agora`;
}

/** O pedido de "Me avise se tiver mesa", em curso. */
export function watchRequestText(kind: CallKind, until: number): string {
  return kind === 'lunch'
    ? `Se alguém abrir uma mesa até as ${clockText(until)}, o app avisa.`
    : `Se alguém abrir um grupo para voltar até as ${clockText(until)}, o app avisa.`;
}

/** O botão de pedir o aviso. */
export const WATCH_CTA: Readonly<Record<CallKind, string>> = {
  lunch: 'Me avise se tiver mesa',
  home: 'Me avise se tiver grupo',
};

/** O aviso da tarefa sem tela: abriram uma mesa ou um grupo no horário pedido. */
export function companionWatchMessage(call: CompanionCall, count: number) {
  const title =
    call.kind === 'lunch'
      ? count === 1
        ? 'Abriram uma mesa no seu intervalo'
        : `Abriram ${count} mesas no seu intervalo`
      : count === 1
        ? 'Abriram um grupo para voltar'
        : `Abriram ${count} grupos para voltar`;
  return {
    id: 'companion:watch',
    channel: 'companion' as const,
    title,
    body: `${callTitle(call)} · ${call.host} abriu · ${goingText(call.going)}.`,
    publicTitle: 'Companhia agora',
    publicBody: 'Tem companhia no seu horário livre.',
    target: 'companion' as const,
  };
}

/** Os textos dos lembretes agendados no aparelho. */
export function companionReminderText(
  membership: Membership,
  key: CompanionReminderKey,
): { title: string; body: string } {
  const spot = SPOT_TEXT[membership.spot];
  const time = clockText(membership.at);
  if (key === 'arrived')
    return {
      title: 'Chegou bem?',
      body: 'Se quiser, avise quem voltou com você: é um toque em "Cheguei em casa".',
    };
  if (membership.kind === 'home') {
    const destination = membership.destination
      ? ` · destino ${DESTINATION_TEXT[membership.destination].name}`
      : '';
    return {
      title: 'Seu grupo sai em 10 min',
      body: `${spot.name}, ${time}${destination}.`,
    };
  }
  return {
    title: 'Sua mesa começa em 10 min',
    body: `${spot.name}, ${time} · ${spot.detail}.`,
  };
}
