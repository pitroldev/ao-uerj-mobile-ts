import axios from 'axios';
import { AppError } from '@root/shared/errors/AppError';
import type { HttpOptions, PrivateApiHttpClient } from './index';

type Tokens = {
  /** O cabeçalho `Authorization` com um token, já fora do estoque; `null` sem token. */
  take(): Promise<string | null>;
};

const unauthorized = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 401;

/**
 * As rotas de aluno da v2 (`requireStudent` no servidor): cada requisição
 * leva um token anônimo, gasto ali. Um 401 (token já gasto, chave que saiu de
 * uso) troca o token uma vez; sem token, ou com dois recusados, o vínculo de
 * aluno não pode ser provado agora.
 */
export function createStudentClient(
  client: PrivateApiHttpClient,
  tokens: Tokens,
): PrivateApiHttpClient {
  async function send(
    options: HttpOptions | undefined,
    execute: (options: HttpOptions) => Promise<{ data: unknown }>,
  ) {
    for (let attempt = 1; ; attempt++) {
      const token = await tokens.take();
      if (!token) throw new AppError('STUDENT_PROOF_UNAVAILABLE');
      try {
        return await execute({
          ...options,
          headers: { ...options?.headers, Authorization: token },
        });
      } catch (error) {
        if (!unauthorized(error)) throw error;
        if (attempt === 2) throw new AppError('STUDENT_PROOF_UNAVAILABLE');
      }
    }
  }
  return {
    get: (url, options) => send(options, sent => client.get(url, sent)),
    post: (url, body, options) =>
      send(options, sent => client.post(url, body, sent)),
  };
}
