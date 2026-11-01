import { z } from 'zod';

import { InvalidInputError } from '../../../shared/errors.ts';

/*
 * Os blocos dos esquemas de entrada. As mensagens de erro são as dos
 * servidores antigos ("fullName is required"); a ordem dos campos decide
 * qual aparece primeiro.
 */

type TextOptions = {
  max: number;
  min?: number;
  /** Aceita número (apps antigos mandavam a turma assim) e o guarda como texto. */
  numeric?: boolean;
};

/** Nulo vale como ausente; número, se permitido, vira texto. */
const normalize = (numeric: boolean) => (value: unknown) => {
  if (value === null) return undefined;
  if (numeric && typeof value === 'number' && Number.isFinite(value))
    return String(value);
  return value;
};

/** A mensagem de um campo que falta ou veio do tipo errado. */
export const required =
  (field: string, kind: string) => (issue: { input: unknown }) =>
    issue.input === undefined
      ? `${field} is required`
      : `${field} must be ${kind}`;

export const stringFor = (field: string) =>
  z.string({ error: required(field, 'a string') });

/** O valor ausente (ou nulo) vira `fallback`. */
export const absentAs =
  <T>(fallback: T) =>
  (value: unknown) =>
    value ?? fallback;

/** Texto obrigatório, sem os espaços das pontas. */
export function requiredText(
  field: string,
  { max, min = 1, numeric = false }: TextOptions,
) {
  return z.preprocess(
    normalize(numeric),
    stringFor(field)
      .trim()
      .min(min, `${field} is required`)
      .max(max, `${field} must be at most ${max} characters`),
  );
}

/**
 * Texto opcional: vazio vira ausente. O `.optional()` de fora é o que deixa
 * o campo faltar no objeto (no zod 4, a transformação não herda isso).
 */
export function optionalText(field: string, max: number) {
  return z
    .preprocess(
      normalize(false),
      stringFor(field)
        .trim()
        .max(max, `${field} must be at most ${max} characters`)
        .optional()
        .transform(value => value || undefined),
    )
    .optional();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E-mail de contato, opcional. Um inválido é descartado em vez de recusar o
 * pedido inteiro: o aluno não volta para corrigir.
 */
export const contactEmail = (max: number) =>
  z
    .unknown()
    .transform(value => {
      if (typeof value !== 'string') return undefined;
      const email = value.trim().toLowerCase();
      return email.length <= max && EMAIL.test(email) ? email : undefined;
    })
    .optional();

/** O corpo JSON como objeto; sem corpo, um objeto vazio. */
export const body = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.preprocess(
    value => value ?? {},
    z.object(shape, { error: 'the body must be a JSON object' }),
  );

/** "classes[3].schedules[0].week_day" */
const locationOf = (path: readonly PropertyKey[]) =>
  path
    .map((key, index) =>
      typeof key === 'number'
        ? `[${key}]`
        : `${index ? '.' : ''}${String(key)}`,
    )
    .join('');

/**
 * Confere a entrada; a primeira regra quebrada vira 400 `invalid_request`.
 * Dentro de listas e objetos, a mensagem diz onde.
 */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where =
      issue && issue.path.length > 1 ? ` (${locationOf(issue.path)})` : '';
    throw new InvalidInputError(
      `${issue?.message ?? 'invalid request'}${where}`,
    );
  }
  return result.data;
}
