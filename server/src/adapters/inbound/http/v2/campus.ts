import express, { type RequestHandler } from 'express';
import { z } from 'zod';

import type { Mural } from '../../../../modules/mural/ports.ts';
import {
  REPORT_LIMITS,
  type NewErrorReport,
} from '../../../../modules/reports/domain.ts';
import type { ErrorReports } from '../../../../modules/reports/ports.ts';
import type { TeacherDirectory } from '../../../../modules/teachers/ports.ts';
import {
  newMessageSchema,
  threadSchema,
  toMuralMessage,
} from '../aouerj/mural.ts';
import { teacherNameSchema, toTeacherJson } from '../aouerj/teachers.ts';
import type {
  MuralMessage,
  OkResponse,
  TeacherListResponse,
  TeacherSearchResponse,
} from '../contract.ts';
import { body, optionalText, parse, requiredText } from '../validation.ts';
import { actorOf } from './students.ts';

const reportSchema = body({
  page: requiredText('page', { max: REPORT_LIMITS.page }),
  description: optionalText('description', REPORT_LIMITS.description),
  html: z.preprocess(
    value => value ?? [],
    z
      .array(z.string({ error: 'each html document must be a string' }), {
        error: 'html must be an array',
      })
      .max(
        REPORT_LIMITS.attachments,
        `html must contain at most ${REPORT_LIMITS.attachments} documents`,
      ),
  ),
});

/** O aluno do pedido (a rota só chega aqui com `requireStudentSession`). */
const studentOf = (res: express.Response) => actorOf(res)?.studentId ?? null;

/**
 * O que o app identificado usa fora da Companhia, com a sessão de aluno: o
 * mural da turma, a busca de docentes e o relato de erro. Os corpos e as
 * respostas são os de `/aouerj`, mais o aluno guardado em cada gravação.
 */
export function campusRoutes({
  mural,
  teachers,
  reports,
  withDatabase,
  session,
  studentLimit,
}: {
  mural: Mural;
  teachers: TeacherDirectory;
  reports: ErrorReports;
  withDatabase: RequestHandler;
  /** A sessão exigida (`requireStudentSession`). */
  session: RequestHandler;
  /** As gravações, por aluno, por minuto. */
  studentLimit: RequestHandler;
}) {
  const routes = express.Router();

  routes.post('/mural/thread', session, withDatabase, async (req, res) => {
    const messages = await mural.listThread(parse(threadSchema, req.body));
    res.json(messages.map(toMuralMessage) satisfies MuralMessage[]);
  });

  routes.post(
    '/mural/messages',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const posted = await mural.post({
        ...parse(newMessageSchema, req.body),
        studentId: studentOf(res),
      });
      res.status(201).json(toMuralMessage(posted) satisfies MuralMessage);
    },
  );

  routes.get('/teachers', session, withDatabase, async (req, res) => {
    res.json({
      docentes: await teachers.names(),
    } satisfies TeacherListResponse);
  });

  routes.get('/teachers/:name', session, withDatabase, async (req, res) => {
    const found = await teachers.search(parse(teacherNameSchema, req.params));
    res.json({
      docentes: found.map(toTeacherJson),
    } satisfies TeacherSearchResponse);
  });

  routes.post(
    '/reports',
    session,
    studentLimit,
    withDatabase,
    async (req, res) => {
      const { html, ...report } = parse(reportSchema, req.body);
      await reports.submit({
        ...report,
        attachments: html,
        studentId: studentOf(res),
      } satisfies NewErrorReport);
      res.status(201).json({ status: 'ok' } satisfies OkResponse);
    },
  );

  return routes;
}
