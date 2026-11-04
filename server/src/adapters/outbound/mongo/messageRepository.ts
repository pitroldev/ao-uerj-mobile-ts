import type { Message } from '../../../modules/mural/domain.ts';
import type { MessageRepository } from '../../../modules/mural/ports.ts';
import { guarded, storedDate, type Stored } from './guarded.ts';
import type { Models } from './models.ts';

type StoredMessage = Stored & {
  fullName: string;
  disciplina: string;
  periodo: string;
  turma: string | number;
  message: string;
  studentId?: string | null;
};

export function toMessage(doc: StoredMessage): Message {
  return {
    id: String(doc._id),
    thread: {
      subjectId: doc.disciplina,
      period: doc.periodo,
      // conversas antigas guardaram a turma como número
      classNumber: String(doc.turma),
    },
    authorName: doc.fullName,
    text: doc.message,
    studentId: doc.studentId ?? null,
    createdAt: storedDate(doc.createdAt),
    updatedAt: storedDate(doc.updatedAt),
  };
}

export function createMessageRepository(
  model: Models['muralMessages'],
): MessageRepository {
  return {
    listThread: (thread, limit) =>
      guarded(async () => {
        const newest = await model
          .find({
            disciplina: thread.subjectId,
            periodo: thread.period,
            turma: thread.classNumber,
          })
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .lean<StoredMessage[]>();
        return newest.reverse().map(toMessage);
      }),
    create: message =>
      guarded(async () => {
        const created = await model.create({
          fullName: message.authorName,
          disciplina: message.thread.subjectId,
          periodo: message.thread.period,
          turma: message.thread.classNumber,
          message: message.text,
          studentId: message.studentId ?? null,
        });
        return toMessage(created.toObject<StoredMessage>());
      }),
  };
}
