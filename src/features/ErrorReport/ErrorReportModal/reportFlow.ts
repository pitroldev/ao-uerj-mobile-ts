import type { ErrorReportDraft } from '@root/modules/support/application/ports';
import { SUBJECT_PAGE, isValidSubjectCode } from '../reportPages';

type Fields = { page: string; subjectCode: string; description: string };
type ReportFlow = {
  phase: 'selecting' | 'explaining' | 'submitting' | 'submitted';
  fields: Fields;
};
type Event =
  | { type: 'edit'; field: keyof Fields; value: string }
  | { type: 'next' | 'back' | 'submit' | 'failed' | 'sent' };

export const INITIAL_REPORT: ReportFlow = {
  phase: 'selecting',
  fields: { page: '', subjectCode: '', description: '' },
};

export function canExplain({ fields }: ReportFlow): boolean {
  return (
    Boolean(fields.page.trim()) &&
    (fields.page !== SUBJECT_PAGE || isValidSubjectCode(fields.subjectCode))
  );
}

/** Um único rascunho: voltar e trocar a página nunca conserva um código oculto no envio. */
export function reportDraft({ fields }: ReportFlow): ErrorReportDraft {
  return {
    page: fields.page,
    description: fields.description,
    ...(fields.page === SUBJECT_PAGE
      ? { subjectCode: fields.subjectCode.trim().toUpperCase() }
      : {}),
  };
}

/** Transições sem efeitos. Eventos fora do passo atual não mudam o relato. */
export function reportFlow(state: ReportFlow, event: Event): ReportFlow {
  switch (event.type) {
    case 'edit':
      if (
        (state.phase === 'selecting' && event.field !== 'description') ||
        (state.phase === 'explaining' && event.field === 'description')
      )
        return {
          ...state,
          fields: { ...state.fields, [event.field]: event.value },
        };
      return state;
    case 'next':
      return state.phase === 'selecting' && canExplain(state)
        ? { ...state, phase: 'explaining' }
        : state;
    case 'back':
      return state.phase === 'explaining'
        ? { ...state, phase: 'selecting' }
        : state;
    case 'submit':
      return state.phase === 'explaining' &&
        canExplain(state) &&
        state.fields.description.trim()
        ? { ...state, phase: 'submitting' }
        : state;
    case 'failed':
      return state.phase === 'submitting'
        ? { ...state, phase: 'explaining' }
        : state;
    case 'sent':
      return state.phase === 'submitting'
        ? { ...state, phase: 'submitted' }
        : state;
  }
}
