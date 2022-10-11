export const MAX_RETRIES = 3;

export const NOT_RETRY_ERRORS = ['NOT_LOGGED_IN', 'POSSIBLY_BLOCKED'];

export const SESSION_TIMED_OUT_ERRORS = [
  'REQ_ID_NOT_FOUND',
  'SUBJECT_REQ_ID_NOT_FOUND',
];

export async function retry<T>(
  fn: () => Promise<T>,
  count: number = MAX_RETRIES,
): Promise<T> {
  return await fn().catch(async (err: Error) => {
    if (NOT_RETRY_ERRORS.includes(err.message)) {
      throw err;
    }

    if (count > 0) {
      return await retry(fn, count - 1);
    }

    throw err;
  });
}
