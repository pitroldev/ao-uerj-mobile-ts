import axios from 'axios';
import type { StudentSession } from '@root/modules/trust/application/StudentSession';
import type { HttpOptions, PrivateApiHttpClient } from './index';
import { banOf } from './studentSession';

type Session = Pick<StudentSession, 'token' | 'invalidate' | 'banned'>;

/** O 401 da sessão vencida, encerrada ou que faltou: vale entrar de novo, uma vez. */
const sessionRefused = (error: unknown) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401)
    return false;
  const code = (error.response.data as { error?: unknown } | undefined)?.error;
  return code === 'invalid_session' || code === 'session_required';
};

/**
 * As rotas de aluno da v2 com a sessão: cada pedido leva `Authorization:
 * Student <sessão>`. Uma sessão recusada (401) entra de novo uma vez; o
 * banimento (403 `student_banned`) vira o `STUDENT_BANNED`, com o prazo.
 */
export function createSessionClient(
  client: PrivateApiHttpClient,
  session: Session,
): PrivateApiHttpClient {
  async function send(
    options: HttpOptions | undefined,
    execute: (options: HttpOptions) => Promise<{ data: unknown }>,
  ) {
    for (let attempt = 1; ; attempt++) {
      const token = await session.token();
      try {
        return await execute({
          ...options,
          headers: { ...options?.headers, Authorization: `Student ${token}` },
        });
      } catch (error) {
        const ban = axios.isAxiosError(error)
          ? banOf(error.response?.data)
          : null;
        if (ban) throw session.banned(ban);
        if (!sessionRefused(error) || attempt === 2) throw error;
        await session.invalidate(token);
      }
    }
  }
  return {
    get: (url, options) => send(options, sent => client.get(url, sent)),
    post: (url, body, options) =>
      send(options, sent => client.post(url, body, sent)),
  };
}
