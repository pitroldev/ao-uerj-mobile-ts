import type {
  MessageBoardPort,
  TeacherDirectoryPort,
} from '@root/modules/community/application/ports';
import type { Message } from '@root/modules/community/domain/models';
import { createDemoClock, type DemoClock } from '../clock';
import { MESSAGE_SEEDS, teachers } from '../data/community';

/** "IME02-10892" vale "10892", e a turma "02" vale "2", como no mural real. */
function sameCode(left: string, right: string) {
  const numeric = (value: string) => Number(value.trim().split('-').pop());
  const [a, b] = [numeric(left), numeric(right)];
  return Number.isFinite(a) && Number.isFinite(b)
    ? a === b
    : left.trim() === right.trim();
}

/** Mensagens guardadas; as de exemplo valem para o período corrente. */
type Stored = Omit<Message, 'period'> & { period: string | null };

/**
 * O mural na memória: as mensagens de exemplo e as que se escrevem aqui, até
 * o app fechar. Nada sai do aparelho.
 */
export function createDemoMessageBoard(clock: DemoClock): MessageBoardPort {
  const messages: Stored[] = MESSAGE_SEEDS.map((seed, index) => ({
    id: `demo-message-${index + 1}`,
    authorName: seed.authorName,
    subjectId: seed.subjectId,
    classNumber: seed.classNumber,
    period: null,
    text: seed.text,
    createdAt: clock.daysFromNow(-seed.daysAgo, seed.hour).toISOString(),
  }));
  return {
    read: (thread, options) =>
      clock.respond(
        () =>
          messages
            .map(message => ({
              ...message,
              period: message.period ?? clock.period(),
            }))
            .filter(
              message =>
                message.period === thread.period.trim() &&
                sameCode(message.subjectId, thread.subjectId) &&
                sameCode(message.classNumber, thread.classNumber),
            ),
        options?.signal,
      ),
    post: (input, options) =>
      clock.respond(() => {
        const message: Message = {
          id: `demo-message-${messages.length + 1}`,
          authorName: input.authorName,
          subjectId: input.subjectId,
          classNumber: input.classNumber,
          period: input.period,
          text: input.text,
          createdAt: new Date(clock.now()).toISOString(),
        };
        messages.push(message);
        return message;
      }, options?.signal),
  };
}

/**
 * Os professores das turmas fictícias. Sem relógio na composição, usa o de
 * agora, com a mesma espera das outras respostas.
 */
export function createDemoTeacherDirectory(
  clock: DemoClock = createDemoClock(Date.now),
): TeacherDirectoryPort {
  const directory = () => teachers(clock.daysFromNow(-3, 9).toISOString());
  return {
    list: options =>
      clock.respond(
        () => directory().map(teacher => teacher.name),
        options?.signal,
      ),
    find: (name, options) =>
      clock.respond(() => {
        const wanted = name.trim().toLocaleLowerCase('pt-BR');
        return (
          directory().find(
            teacher => teacher.name.toLocaleLowerCase('pt-BR') === wanted,
          ) ?? null
        );
      }, options?.signal),
  };
}
