import { AppError } from '@root/shared/errors/AppError';

/** Accept the full AO identifier or its numeric suffix, with one cache identity. */
export function normalizeSubjectId(input: string | number): string {
  const match = /^(?:[A-Z]+\d+-)?(\d{1,5})$/i.exec(String(input).trim());
  if (!match || Number(match[1]) <= 0) {
    throw new AppError('INVALID_INPUT', 'Código de disciplina inválido.');
  }
  return String(Number(match[1]));
}

/**
 * Mesma identidade de `normalizeSubjectId` para cruzar notas, grade, histórico
 * e faltas, sem erro: o que não for um código do AO volta como texto.
 */
export function subjectKey(input: string | number): string {
  try {
    return normalizeSubjectId(input);
  } catch {
    return String(input).trim();
  }
}
