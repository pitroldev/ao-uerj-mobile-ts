import { UnavailableError } from '../../../shared/errors.ts';

/** O que todo documento traz do banco. */
export type Stored = { _id: unknown; createdAt?: Date; updatedAt?: Date };

/** O erro do índice único: o mesmo `_id` já está lá. */
export const isDuplicateKey = (err: unknown) =>
  typeof err === 'object' &&
  err !== null &&
  (err as { code?: unknown }).code === 11000;

/** Documentos antigos sem data ficam com a de 1970. */
export const storedDate = (value: Date | undefined) => value ?? new Date(0);

const OFFLINE =
  /^Mongo(Network|ServerSelection|NotConnected)Error$|^MongooseServerSelectionError$/;

/**
 * Envolve uma operação do banco (decorador): um banco que caiu no meio da
 * requisição vira o mesmo 503 do banco fora do ar antes dela; o resto segue
 * como erro do servidor.
 */
export async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    const offline =
      err instanceof Error &&
      (OFFLINE.test(err.name) || /initial connection/.test(err.message));
    if (offline) {
      throw new UnavailableError(
        'database_unavailable',
        'The database is temporarily unavailable',
      );
    }
    throw err;
  }
}
