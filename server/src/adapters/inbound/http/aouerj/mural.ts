import express, { type RequestHandler } from 'express';

import {
  MESSAGE_LIMITS,
  type Message,
  type MessageThread,
  type NewMessage,
} from '../../../../modules/mural/domain.ts';
import type { Mural } from '../../../../modules/mural/ports.ts';
import type { MuralMessage } from '../contract.ts';
import { body, parse, requiredText } from '../validation.ts';

const threadFields = {
  disciplina: requiredText('disciplina', {
    max: MESSAGE_LIMITS.subjectId,
    numeric: true,
  }),
  periodo: requiredText('periodo', {
    max: MESSAGE_LIMITS.period,
    numeric: true,
  }),
  turma: requiredText('turma', {
    max: MESSAGE_LIMITS.classNumber,
    numeric: true,
  }),
};

const toThread = (fields: {
  disciplina: string;
  periodo: string;
  turma: string;
}): MessageThread => ({
  subjectId: fields.disciplina,
  period: fields.periodo,
  classNumber: fields.turma,
});

const threadSchema = body(threadFields).transform(toThread);

const newMessageSchema = body({
  fullName: requiredText('fullName', { max: MESSAGE_LIMITS.authorName }),
  ...threadFields,
  message: requiredText('message', { max: MESSAGE_LIMITS.text }),
}).transform((fields): NewMessage => ({
  thread: toThread(fields),
  authorName: fields.fullName,
  text: fields.message,
}));

/** A mensagem com os campos e a ordem do documento antigo, que os apps leem. */
export function toMuralMessage(message: Message): MuralMessage {
  return {
    _id: message.id,
    fullName: message.authorName,
    disciplina: message.thread.subjectId,
    periodo: message.thread.period,
    turma: message.thread.classNumber,
    message: message.text,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

/** `POST /messages/get` e `POST /messages/post` (que responde 200, como antes). */
export function muralRoutes({
  mural,
  withDatabase,
  writeLimit,
}: {
  mural: Mural;
  withDatabase: RequestHandler;
  writeLimit: RequestHandler;
}) {
  const routes = express.Router();

  routes.post('/messages/get', withDatabase, async (req, res) => {
    const messages = await mural.listThread(parse(threadSchema, req.body));
    res.json(messages.map(toMuralMessage));
  });

  routes.post('/messages/post', writeLimit, withDatabase, async (req, res) => {
    const posted = await mural.post(parse(newMessageSchema, req.body));
    res.json(toMuralMessage(posted));
  });

  return routes;
}
