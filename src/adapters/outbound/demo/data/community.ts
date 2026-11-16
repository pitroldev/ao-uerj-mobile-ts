/*
 * Mural e professores da demonstração. As mensagens são inventadas, de
 * colegas com nomes que não deixam dúvida, sem links nem datas de prova; o
 * diretório de professores sai das turmas da Pesquisa de Disciplinas.
 */
import type { Teacher } from '@root/modules/community/domain/models';
import { CATALOG, subjectDetails } from './catalog';
import { DEMO_STUDENT_NAME } from './student';

/* ------------------------------------------------------------ mural */

export type MessageSeed = {
  subjectId: string;
  classNumber: string;
  authorName: string;
  /** Dias antes de hoje e a hora da mensagem. */
  daysAgo: number;
  hour: number;
  text: string;
};

const DISTRIBUTED = { subjectId: 'IME02-10892', classNumber: '2' };
const COMPILERS = { subjectId: 'IME02-10871', classNumber: '1' };

/** Do período corrente: o mural mostra só o período de quem lê. */
export const MESSAGE_SEEDS: MessageSeed[] = [
  {
    ...DISTRIBUTED,
    authorName: 'Bia Figurante',
    daysAgo: 9,
    hour: 21,
    text: 'Oi, turma! Alguém montou um grupo de estudo para a P2?',
  },
  {
    ...DISTRIBUTED,
    authorName: 'Caio Personagem',
    daysAgo: 8,
    hour: 8,
    text: 'Montei, sim. A gente se encontra na biblioteca depois da aula de quarta.',
  },
  {
    ...DISTRIBUTED,
    // mensagem "minha": o mesmo nome do perfil da demonstração
    authorName: DEMO_STUDENT_NAME,
    daysAgo: 8,
    hour: 9,
    text: 'Alguém tem as anotações da aula sobre consenso? Perdi a de segunda.',
  },
  {
    ...DISTRIBUTED,
    authorName: 'Duda Exemplar',
    daysAgo: 7,
    hour: 10,
    text: 'Tenho! Passo para você no intervalo.',
  },
  {
    ...COMPILERS,
    authorName: 'Léo Coadjuvante',
    daysAgo: 3,
    hour: 19,
    text: 'A lista 2 de análise sintática vale ponto extra se entregar até sexta.',
  },
  {
    ...COMPILERS,
    authorName: 'Bia Figurante',
    daysAgo: 2,
    hour: 7,
    text: 'Valeu pelo aviso!',
  },
];

/* ------------------------------------------------------- professores */

/** Cada professor com as disciplinas e turmas que dá neste período. */
export function teachers(updatedAt: string): Teacher[] {
  const byName = new Map<string, Teacher>();
  for (const entry of CATALOG) {
    const details = subjectDetails(entry.id);
    for (const group of details?.classes ?? []) {
      for (const name of group.teachers ?? []) {
        const teacher = byName.get(name) ?? {
          id: `demo-teacher-${byName.size + 1}`,
          name,
          updatedAt,
          subjects: [],
        };
        let subject = teacher.subjects.find(item => item.id === entry.id);
        if (!subject) {
          subject = { id: entry.id, name: entry.name, classes: [] };
          teacher.subjects.push(subject);
        }
        subject.classes.push({
          number: String(group.classNumber ?? ''),
          location: group.location ?? '',
        });
        byName.set(name, teacher);
      }
    }
  }
  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
}
