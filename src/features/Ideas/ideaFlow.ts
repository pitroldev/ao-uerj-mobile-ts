import {
  draftProblems,
  isContact,
  isDraftReady,
  type FieldProblem,
  type IdeaArea,
  type IdeaDraft,
  type IdeaField,
  type MyIdea,
  type PortalAnswer,
  type SimilarIdea,
} from '@root/modules/ideas/domain/ideas';

/**
 * A folha em 3 passos: escrever, ver as parecidas (só se houver) e conferir
 * como fica pública. Depois de mandar (ou de somar o pedido), a confirmação.
 */
export type IdeaStep = 'write' | 'similar' | 'review' | 'done';

export type IdeaFlow = {
  step: IdeaStep;
  draft: IdeaDraft;
  /** "Como você imagina" aberto. */
  withIdea: boolean;
  /** O aluno tocou em "Próximo": os campos que faltam aparecem. */
  tried: boolean;
  /** O campo que o servidor recusou por contato (o filtro daqui não viu). */
  refused: IdeaField | null;
  /** Procurando as parecidas, mandando ou somando o pedido a um issue. */
  busy: 'searching' | 'sending' | { joining: number } | null;
  similar: SimilarIdea[];
  /** As parecidas que o aluno viu e disse que a dele é outra. */
  seenSimilar: number[];
  /** A sugestão mandada ou o pedido somado. */
  result: MyIdea | null;
};

type Event =
  | { type: 'text'; field: IdeaField; value: string }
  | { type: 'area'; value: IdeaArea }
  | { type: 'portal'; value: PortalAnswer }
  | { type: 'openIdea' }
  | { type: 'next' }
  | { type: 'found'; similar: SimilarIdea[] }
  | { type: 'other' }
  | { type: 'back' }
  | { type: 'send' }
  | { type: 'join'; issue: number }
  | { type: 'done'; idea: MyIdea }
  | { type: 'refused'; field: IdeaField | null }
  | { type: 'gone'; issue: number }
  | { type: 'failed' };

export const INITIAL_IDEA: IdeaFlow = {
  step: 'write',
  draft: { title: '', area: null, problem: '', idea: '', portal: 'unknown' },
  withIdea: false,
  tried: false,
  refused: null,
  busy: null,
  similar: [],
  seenSimilar: [],
  result: null,
};

/** O número do passo para "Passo N de 3". */
export const STEP_NUMBER: Readonly<Record<Exclude<IdeaStep, 'done'>, number>> =
  { write: 1, similar: 2, review: 3 };

/**
 * Os problemas que a folha mostra: o contato sempre (o aluno vê na hora o
 * que tirar); o tamanho e a área, só depois do "Próximo". `refused` é o
 * campo que o servidor recusou sem o filtro daqui ver.
 */
export function visibleProblems(
  flow: IdeaFlow,
): Partial<Record<IdeaField | 'area', FieldProblem | 'refused'>> {
  const problems = draftProblems(flow.draft);
  const shown: Partial<Record<IdeaField | 'area', FieldProblem | 'refused'>> =
    {};
  for (const [field, problem] of Object.entries(problems) as [
    IdeaField | 'area',
    FieldProblem,
  ][])
    if (isContact(problem) || flow.tried) shown[field] = problem;
  if (flow.refused && !shown[flow.refused]) shown[flow.refused] = 'refused';
  return shown;
}

/** Transições sem efeitos. Eventos fora do passo (ou com algo em andamento) não mudam nada. */
export function ideaFlow(state: IdeaFlow, event: Event): IdeaFlow {
  const idle = state.busy === null;
  switch (event.type) {
    case 'text':
      if (state.step !== 'write' || !idle) return state;
      return {
        ...state,
        draft: { ...state.draft, [event.field]: event.value },
        refused: state.refused === event.field ? null : state.refused,
      };
    case 'area':
      if (state.step !== 'write' || !idle) return state;
      return { ...state, draft: { ...state.draft, area: event.value } };
    case 'portal':
      if (state.step !== 'write' || !idle) return state;
      return { ...state, draft: { ...state.draft, portal: event.value } };
    case 'openIdea':
      return state.step === 'write' ? { ...state, withIdea: true } : state;
    case 'next':
      if (state.step !== 'write' || !idle) return state;
      return isDraftReady(state.draft) && !state.refused
        ? { ...state, tried: true, busy: 'searching' }
        : { ...state, tried: true };
    case 'found':
      if (state.busy !== 'searching') return state;
      return {
        ...state,
        busy: null,
        step: event.similar.length ? 'similar' : 'review',
        similar: event.similar,
        seenSimilar: [],
      };
    case 'other':
      if (state.step !== 'similar' || !idle) return state;
      return {
        ...state,
        step: 'review',
        seenSimilar: state.similar.map(item => item.number),
      };
    case 'back':
      if (!idle) return state;
      if (state.step === 'similar') return { ...state, step: 'write' };
      if (state.step === 'review')
        return {
          ...state,
          step: state.similar.length ? 'similar' : 'write',
          seenSimilar: [],
        };
      return state;
    case 'send':
      return state.step === 'review' && idle
        ? { ...state, busy: 'sending' }
        : state;
    case 'join':
      return state.step === 'similar' && idle
        ? { ...state, busy: { joining: event.issue } }
        : state;
    case 'done':
      if (idle) return state;
      return { ...state, busy: null, step: 'done', result: event.idea };
    case 'refused':
      if (state.busy !== 'sending') return state;
      // de volta ao texto, com o campo marcado (quando o servidor diz qual)
      return {
        ...state,
        busy: null,
        step: 'write',
        tried: true,
        refused: event.field,
        seenSimilar: [],
      };
    case 'gone': {
      if (idle) return state;
      const similar = state.similar.filter(item => item.number !== event.issue);
      return {
        ...state,
        busy: null,
        similar,
        step: similar.length ? state.step : 'review',
      };
    }
    case 'failed':
      return idle ? state : { ...state, busy: null };
  }
}
