import type { Teacher } from '../../../modules/teachers/domain.ts';
import type { TeacherRepository } from '../../../modules/teachers/ports.ts';
import { guarded, type Stored } from './guarded.ts';
import type { Models } from './models.ts';

type StoredTeacher = Stored & { docente: string; disciplinas?: unknown };

export function toTeacher(doc: StoredTeacher): Teacher {
  return {
    id: String(doc._id),
    name: doc.docente,
    subjects: doc.disciplinas,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** O texto como literal numa expressão regular (a busca não aceita sintaxe). */
export function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createTeacherRepository(
  model: Models['teachers'],
): TeacherRepository {
  return {
    listNames: () =>
      guarded(async () => {
        const found = await model
          .find()
          .select({ _id: 0, docente: 1 })
          .lean<{ docente: string }[]>();
        // um documento sem nome não vira `null` na lista (o app recusaria a
        // lista inteira)
        return found
          .map(({ docente }) => docente)
          .filter(name => typeof name === 'string');
      }),
    searchByName: (fragment, limit) =>
      guarded(async () => {
        const found = await model
          .find({ docente: new RegExp(escapeRegularExpression(fragment), 'i') })
          .limit(limit)
          .lean<StoredTeacher[]>();
        return found.map(toTeacher);
      }),
  };
}
