import express, { type RequestHandler } from 'express';

import {
  TEACHER_NAME_LIMITS,
  type Teacher,
} from '../../../../modules/teachers/domain.ts';
import type { TeacherDirectory } from '../../../../modules/teachers/ports.ts';
import type {
  Teacher as TeacherJson,
  TeacherListResponse,
  TeacherSearchResponse,
} from '../contract.ts';
import { body, parse, requiredText } from '../validation.ts';

const teacherNameSchema = body({
  name: requiredText('name', {
    max: TEACHER_NAME_LIMITS.maximum,
    min: TEACHER_NAME_LIMITS.minimum,
  }),
}).transform(fields => fields.name);

export function toTeacherJson(teacher: Teacher): TeacherJson {
  return {
    _id: teacher.id,
    docente: teacher.name,
    disciplinas: teacher.subjects as TeacherJson['disciplinas'],
    createdAt: teacher.createdAt?.toISOString(),
    updatedAt: teacher.updatedAt?.toISOString(),
  };
}

/** `GET /docentes` e `GET /docentes/:name`. */
export function teacherRoutes({
  teachers,
  withDatabase,
}: {
  teachers: TeacherDirectory;
  withDatabase: RequestHandler;
}) {
  const routes = express.Router();

  routes.get('/docentes', withDatabase, async (req, res) => {
    res.json({
      docentes: await teachers.names(),
    } satisfies TeacherListResponse);
  });

  routes.get('/docentes/:name', withDatabase, async (req, res) => {
    const found = await teachers.search(parse(teacherNameSchema, req.params));
    res.json({
      docentes: found.map(toTeacherJson),
    } satisfies TeacherSearchResponse);
  });

  return routes;
}
