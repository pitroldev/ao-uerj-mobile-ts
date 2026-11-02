import type { RequestHandler, Response } from 'express';

import type { StudentAccess } from '../../../../modules/access/ports.ts';
import type { ApiError } from '../contract.ts';
import { base64url } from './base64url.ts';

const refuse = (res: Response, status: number, body: ApiError) => {
  res.set('Cache-Control', 'no-store').status(status).json(body);
};

/**
 * As rotas de aluno da v2 exigem um token anônimo (Privacy Pass, RFC 9577):
 * `Authorization: PrivateToken token="…"`. Cada token vale uma requisição.
 *
 * Sem token válido, 401 com o desafio no `WWW-Authenticate` (o emissor e a
 * chave), para o app buscar tokens novos. A resposta é a mesma qualquer que
 * seja o motivo; o motivo vai só para o log, sem o token. Sem chave
 * configurada, 503 `student_access_unavailable`; o banco que cai no meio do
 * gasto, 503 `database_unavailable`.
 */
export function requireStudent(access: StudentAccess): RequestHandler {
  return (req, res, next) => {
    access
      .redeem(req.get('authorization'))
      .then(result => {
        if (result.authenticated) {
          next();
          return;
        }
        if (result.reason === 'unavailable') {
          refuse(res, 503, {
            error: 'student_access_unavailable',
            message: 'Student access is not available right now',
          });
          return;
        }
        req.log.info({ reason: result.reason }, 'student token refused');
        const challenge = access.challenge();
        if (challenge)
          res.set(
            'WWW-Authenticate',
            `PrivateToken challenge="${base64url(challenge.challenge)}", token-key="${base64url(challenge.tokenKey)}"`,
          );
        refuse(res, 401, {
          error: 'unauthenticated',
          message: 'A valid private token is required',
        });
      })
      // também o que falhar ao responder: sem isso, uma rejeição solta
      // derrubaria o processo
      .catch(next);
  };
}
