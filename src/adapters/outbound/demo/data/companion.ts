import type {
  CallKind,
  DestinationId,
  PhraseId,
  SpotId,
} from '@root/modules/companion/domain/companion';

/*
 * As chamadas que a Companhia agora da demo já mostra ao abrir: uma mesa no
 * bandejão e uma volta em grupo até o metrô. Apelidos inventados; os
 * horários saem de agora (ver `ports/companion.ts`).
 */

export type DemoCallSeed = {
  kind: CallKind;
  spot: SpotId;
  destination: DestinationId | null;
  note: string;
  capacity: number;
  /** Daqui a quantos minutos (arredondado para o próximo múltiplo de 5). */
  inMinutes: number;
  /** Quem chamou, e depois quem já entrou. */
  people: readonly string[];
  /** Os recados que já estão lá: de quem (pela ordem em `people`) e há quantos minutos. */
  feed: readonly { person: number; phrase: PhraseId; minutesAgo: number }[];
};

export const DEMO_CALL_SEEDS: readonly DemoCallSeed[] = [
  {
    kind: 'lunch',
    spot: 'ru',
    destination: null,
    note: 'Mesa perto da janela, perto do caixa',
    capacity: 6,
    inMinutes: 25,
    people: ['Bia', 'Caio'],
    feed: [{ person: 1, phrase: 'on_my_way', minutesAgo: 2 }],
  },
  {
    kind: 'home',
    spot: 'portao-1',
    destination: 'metro',
    note: 'Saindo depois da aula do bloco F',
    capacity: 8,
    inMinutes: 45,
    people: ['Duda', 'Léo', 'Iara'],
    feed: [],
  },
];

/**
 * Quem entra na chamada que o aluno da demo abre, um minuto depois, com um
 * "Estou indo": assim dá para ver a lista de quem vai e tirar alguém.
 */
export const DEMO_JOINERS: Readonly<Record<CallKind, string>> = {
  lunch: 'Nina',
  home: 'Rafa',
};
export const DEMO_JOIN_AFTER_MINUTES = 1;

/** Quantos outros alunos olharam a lista nos últimos 15 minutos. */
export const DEMO_WATCHING_OTHERS = 6;
