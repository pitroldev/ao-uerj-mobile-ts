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
  },
  home: {
    label: 'Volta junto',
    icon: 'directions_walk',
    section: 'Saindo agora',
    cta: 'Chamar',
    join: 'Ir junto',
    joined: 'Você vai junto',
    sheetTitle: 'Chamar para voltar junto',
  },
};

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

/** "Mesa no RU, 12:30" ou "Volta para o metrô, 22:15". */
export function callTitle(call: CallLike): string {
  const time = clockText(call.at);
  if (call.kind === 'home' && call.destination)
    return `Volta para o ${DESTINATION_TEXT[call.destination].short}, ${time}`;
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
  home: 'A chamada some 2 horas depois da saída, depois do "Cheguei em casa".',
};

/** O que dizer quando um pedido não deu certo. */
export function companionErrorMessage(error: unknown): string {
  if (error instanceof CompanionError) {
    switch (error.refusal) {
      case 'gone':
        return 'Essa chamada já acabou ou saiu do ar.';
      case 'full':
        return 'Essa chamada lotou. Veja outra ou abra a sua.';
      case 'closed':
        return 'Essa chamada já saiu. Veja outra ou abra a sua.';
      case 'ended':
        return 'Quem chamou encerrou a chamada.';
      case 'contact':
        return 'Telefone, @ e links ficam fora: combine aqui só o encontro.';
      case 'not_member':
        return 'Você não está mais nessa chamada.';
      case 'removed':
        return 'Quem chamou tirou você desta chamada.';
      case 'not_host':
        return 'Só quem chamou tira alguém da chamada.';
      case 'member_gone':
        return 'Essa pessoa já tinha saído da chamada.';
      case 'busy':
        return 'Há chamadas demais abertas agora. Tente de novo em alguns minutos.';
      default:
        return 'Não foi possível concluir. Tente novamente.';
    }
  }
  if (error instanceof AppError && error.code === 'STUDENT_PROOF_UNAVAILABLE')
    return 'Não foi possível confirmar agora que você é aluno da UERJ, sem dizer quem é. Abra o app com a internet ligada e tente de novo em alguns minutos.';
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

/** O pedido de "Me avise se abrirem", em curso. */
export function watchRequestText(kind: CallKind, until: number): string {
  return kind === 'lunch'
    ? `Você vai ser avisado se abrirem mesa até as ${clockText(until)}.`
    : `Você vai ser avisado se chamarem uma volta até as ${clockText(until)}.`;
}

/** O botão de pedir o aviso. */
export const WATCH_CTA: Readonly<Record<CallKind, string>> = {
  lunch: 'Me avise se abrirem',
  home: 'Me avise se chamarem',
};

/** O aviso da tarefa sem tela: abriram uma chamada na janela pedida. */
export function companionWatchMessage(call: CompanionCall, count: number) {
  const title =
    call.kind === 'lunch'
      ? count === 1
        ? 'Abriram uma mesa na sua janela'
        : `Abriram ${count} mesas na sua janela`
      : count === 1
        ? 'Chamaram uma volta para hoje'
        : `Chamaram ${count} voltas para hoje`;
  return {
    id: 'companion:watch',
    channel: 'companion' as const,
    title,
    body: `${callTitle(call)} · ${call.host} chamou · ${goingText(call.going)}.`,
    publicTitle: 'Companhia agora',
    publicBody: 'Uma chamada abriu na sua janela livre.',
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
      title: 'A volta é em 10 min',
      body: `${spot.name}, ${time}${destination}.`,
    };
  }
  return {
    title: 'A mesa é em 10 min',
    body: `${spot.name}, ${time} · ${spot.detail}.`,
  };
}
