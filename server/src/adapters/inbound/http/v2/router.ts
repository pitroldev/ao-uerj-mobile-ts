import express from 'express';

import type {
  StudentAccess,
  TokenIssuer,
} from '../../../../modules/access/ports.ts';
import type { DatabaseHealth } from '../aouerj/status.ts';
import type { StudentAuthResponse } from '../contract.ts';
import { notFound } from '../errors.ts';
import { perMinuteLimit, requireDatabase } from '../middleware.ts';
import { requireStudent } from './studentAuth.ts';
import { tokenRoutes } from './tokens.ts';

/**
 * A API v2, em `/aouerj/v2`: a emissão dos tokens anônimos e as rotas de
 * aluno, todas com um deles. As de `/aouerj` continuam como estão, para os
 * apps publicados.
 */
export function createV2Router({
  access,
  tokens,
  database,
  tokenRequestsPerMinute,
  tokenBatchSize,
}: {
  access: StudentAccess;
  tokens: TokenIssuer;
  database: DatabaseHealth;
  tokenRequestsPerMinute: number;
  tokenBatchSize: number;
}) {
  const routes = express.Router();
  // toda rota de aluno leva os dois: o gasto do token grava no banco, e sem
  // ele é 503 na hora, como nas de /aouerj
  const withDatabase = requireDatabase(() => database.isReady());
  const student = requireStudent(access);

  routes.use(
    tokenRoutes({
      tokens,
      withDatabase,
      tokenLimit: perMinuteLimit(tokenRequestsPerMinute),
      batchSize: tokenBatchSize,
    }),
  );

  // Diz se a requisição veio autenticada. Como toda rota de aluno, gasta o
  // token: a resposta 401 é o "não", com o desafio para buscar outro.
  routes.get('/auth', withDatabase, student, (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json({ authenticated: true } satisfies StudentAuthResponse);
  });

  // o que não existe na v2 termina aqui, sem passar pelas rotas de /aouerj
  routes.use(notFound);
  return routes;
}
