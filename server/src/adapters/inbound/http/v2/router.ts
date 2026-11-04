import express, { type Request } from 'express';

import type {
  StudentAccess,
  TokenIssuer,
} from '../../../../modules/access/ports.ts';
import type { Companion } from '../../../../modules/companion/ports.ts';
import type { Mural } from '../../../../modules/mural/ports.ts';
import type { ErrorReports } from '../../../../modules/reports/ports.ts';
import type { StudentIdentity } from '../../../../modules/students/ports.ts';
import type { TeacherDirectory } from '../../../../modules/teachers/ports.ts';
import type { DatabaseHealth } from '../aouerj/status.ts';
import type { StudentAuthResponse } from '../contract.ts';
import { notFound } from '../errors.ts';
import { perKeyLimit, perMinuteLimit, requireDatabase } from '../middleware.ts';
import { campusRoutes } from './campus.ts';
import { companionRoutes } from './companion.ts';
import { requireStudent } from './studentAuth.ts';
import {
  actorOf,
  identifyStudent,
  requireStudentSession,
  sessionOrToken,
  studentRoutes,
} from './students.ts';
import { tokenRoutes } from './tokens.ts';

/**
 * A API v2, em `/aouerj/v2`: a identificação do aluno (a matrícula pela Play
 * Integrity, e a sessão em cada pedido) e as rotas de aluno. A emissão dos
 * tokens anônimos e o token nas rotas da Companhia ficam para os apps antigos
 * (2.11.1 a 2.13), enquanto `acceptTokens`. As de `/aouerj` continuam como
 * estão, para os apps publicados.
 */
export function createV2Router({
  access,
  tokens,
  companion,
  students,
  mural,
  teachers,
  reports,
  database,
  tokenRequestsPerMinute,
  tokenBatchSize,
  companionLimits,
  studentRequestsPerMinute,
  acceptTokens,
}: {
  access: StudentAccess;
  tokens: TokenIssuer;
  companion: Companion;
  students: StudentIdentity;
  mural: Mural;
  teachers: TeacherDirectory;
  reports: ErrorReports;
  database: DatabaseHealth;
  tokenRequestsPerMinute: number;
  tokenBatchSize: number;
  /** Por IP, por minuto: os desafios e as entradas dos alunos. */
  studentRequestsPerMinute: number;
  /** Os tokens anônimos ainda valem nas rotas de aluno. */
  acceptTokens: boolean;
  /**
   * A Companhia agora, por minuto: um teto folgado por IP e o limite de cada
   * chave de membro.
   */
  companionLimits: { perIp: number; perMember: number };
}) {
  const routes = express.Router();
  // toda rota de aluno leva os dois: o gasto do token grava no banco, e sem
  // ele é 503 na hora, como nas de /aouerj
  const withDatabase = requireDatabase(() => database.isReady());
  const student = sessionOrToken({
    token: requireStudent(access),
    acceptTokens,
  });

  routes.use(
    studentRoutes({
      identity: students,
      withDatabase,
      limit: perMinuteLimit(studentRequestsPerMinute),
    }),
  );

  routes.use(
    tokenRoutes({
      tokens,
      withDatabase,
      tokenLimit: perMinuteLimit(tokenRequestsPerMinute),
      batchSize: tokenBatchSize,
    }),
  );

  // daqui em diante, a sessão (se vier) identifica o aluno; banido, 403. O
  // teto por IP vem antes do banco
  routes.use(
    identifyStudent(students, {
      limit: perMinuteLimit(companionLimits.perIp),
    }),
  );

  // Diz se a requisição veio autenticada. Com o token, como toda rota de
  // aluno, gasta: a resposta 401 é o "não", com o desafio para buscar outro.
  routes.get('/auth', withDatabase, student, (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json({ authenticated: true } satisfies StudentAuthResponse);
  });

  routes.use(
    companionRoutes({
      companion,
      access,
      withDatabase,
      student,
      campusLimit: perMinuteLimit(companionLimits.perIp),
      memberLimit: perKeyLimit(companionLimits.perMember, req =>
        req.get('x-member-key'),
      ),
    }),
  );

  routes.use(
    campusRoutes({
      mural,
      teachers,
      reports,
      withDatabase,
      session: requireStudentSession,
      studentLimit: perKeyLimit(companionLimits.perMember, (req: Request) =>
        req.res ? actorOf(req.res)?.studentId : undefined,
      ),
    }),
  );

  // o que não existe na v2 termina aqui, sem passar pelas rotas de /aouerj
  routes.use(notFound);
  return routes;
}
