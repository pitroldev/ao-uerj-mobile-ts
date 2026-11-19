import express, { type RequestHandler, type Response } from 'express';
import { z } from 'zod';

import {
  IDEA_AREAS,
  IDEA_LIMITS,
  IDEA_PLATFORMS,
  PORTAL_ANSWERS,
} from '../../../../modules/ideas/domain.ts';
import type {
  Ideas,
  MyIdea as IdeaView,
  SimilarIssue,
} from '../../../../modules/ideas/ports.ts';
import type { StudentActor } from '../../../../modules/students/ports.ts';
import type {
  IdeaResponse,
  MyIdea,
  MyIdeasResponse,
  SimilarIdea,
  SimilarIdeasResponse,
} from '../contract.ts';
import { body, optionalText, parse, stringFor } from '../validation.ts';
import { actorOf } from './students.ts';

const enumField = <T extends string>(field: string, values: readonly T[]) =>
  z.enum(values as [T, ...T[]], {
    error: issue =>
      issue.input === undefined
        ? `${field} is required`
        : `${field} must be one of ${values.join(', ')}`,
  });

/** Os tamanhos ficam com o domínio (depois de juntar os espaços); aqui, só o teto. */
const ideaSchema = body({
  title: stringFor('title').max(IDEA_LIMITS.title.max * 2),
  area: enumField('area', IDEA_AREAS),
  problem: stringFor('problem').max(IDEA_LIMITS.problem.max * 2),
  idea: optionalText('idea', IDEA_LIMITS.idea.max * 2),
  portal: enumField('portal', PORTAL_ANSWERS),
  appVersion: stringFor('appVersion')
    .trim()
    .regex(/^[\w.+-]{1,20}$/, 'appVersion must be the version of the app'),
  platform: enumField('platform', IDEA_PLATFORMS),
  seenSimilar: z
    .array(
      z
        .number({ error: 'seenSimilar must be a list of issue numbers' })
        .int('seenSimilar must be a list of issue numbers')
        .positive('seenSimilar must be a list of issue numbers'),
      { error: 'seenSimilar must be a list of issue numbers' },
    )
    .max(
      IDEA_LIMITS.seenSimilar,
      `seenSimilar must have at most ${IDEA_LIMITS.seenSimilar} numbers`,
    )
    .optional(),
});

const SIMILAR_MAX = IDEA_LIMITS.title.max + IDEA_LIMITS.problem.max + 1;
const similarSchema = body({
  text: stringFor('text').max(
    SIMILAR_MAX,
    `text must be at most ${SIMILAR_MAX} characters`,
  ),
});

const voteSchema = body({
  issue: z
    .number({ error: 'issue must be the number of the issue' })
    .int('issue must be the number of the issue')
    .positive('issue must be the number of the issue'),
});

const noStore = (res: Response) => res.set('Cache-Control', 'no-store');

/** O aluno da sessão (a rota só chega aqui com `session`). */
const actor = (res: Response): StudentActor => actorOf(res)!;

const toMyIdea = (view: IdeaView): MyIdea => ({
  id: view.id,
  kind: view.kind,
  title: view.title,
  area: view.area,
  createdAt: view.createdAt.toISOString(),
  status: view.status,
  issue: view.issue,
  requests: view.requests,
});

const toSimilar = (issue: SimilarIssue): SimilarIdea => ({
  number: issue.number,
  title: issue.title.replace(/^\[sugest[ãa]o\]\s*/i, ''),
  url: issue.url,
  status: issue.status,
  requests: issue.requests,
});

/**
 * As sugestões do app em `/aouerj/v2/ideas`, só com a sessão de aluno. O
 * limite do dia (três) é do caso de uso; o por minuto, o mesmo das outras
 * gravações do aluno.
 */
export function ideaRoutes({
  ideas,
  withDatabase,
  session,
  studentLimit,
}: {
  ideas: Ideas;
  withDatabase: RequestHandler;
  /** A sessão exigida (`requireStudentSession`). */
  session: RequestHandler;
  /** As gravações e as buscas, por aluno, por minuto. */
  studentLimit: RequestHandler;
}) {
  const routes = express.Router();

  routes.get('/ideas', session, withDatabase, async (req, res) => {
    const mine = await ideas.mine(actor(res));
    noStore(res).json({
      ideas: mine.ideas.map(toMyIdea),
      remainingToday: mine.remainingToday,
    } satisfies MyIdeasResponse);
  });

  routes.post(
    '/ideas/similar',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const { text } = parse(similarSchema, req.body);
      const similar = await ideas.similar(text);
      noStore(res).json({
        similar: similar.map(toSimilar),
      } satisfies SimilarIdeasResponse);
    },
  );

  routes.post(
    '/ideas',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const request = parse(ideaSchema, req.body);
      const created = await ideas.submit(
        {
          ...request,
          idea: request.idea ?? null,
          seenSimilar: request.seenSimilar ?? [],
        },
        actor(res),
      );
      noStore(res)
        .status(201)
        .json({ idea: toMyIdea(created) } satisfies IdeaResponse);
    },
  );

  routes.post(
    '/ideas/votes',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const { issue } = parse(voteSchema, req.body);
      const joined = await ideas.vote(issue, actor(res));
      noStore(res).json({ idea: toMyIdea(joined) } satisfies IdeaResponse);
    },
  );

  return routes;
}
