import { hasContact } from '@root/modules/companion/domain/companion';
import {
  IDEA_FIELDS,
  IDEA_LIMITS,
  IdeaError,
  type MyIdea,
  type SimilarIdea,
} from '@root/modules/ideas/domain/ideas';
import type { IdeasServerPort } from '@root/modules/ideas/application/ports';
import type { DemoClock } from '../clock';
import {
  DEMO_IDEAS,
  DEMO_ISSUES,
  DEMO_ISSUES_URL,
  type DemoIssueSeed,
} from '../data/ideas';

/*
 * As sugestões da demo: as regras do servidor (server/src/modules/ideas), na
 * memória e simplificadas. Nada sai do aparelho: a sugestão mandada fica
 * "Recebida" até o app fechar, e o pedido somado só aumenta a contagem daqui.
 */

const pad = (value: number) => String(value).padStart(2, '0');
/** O dia no fuso do aparelho, AAAA-MM-DD. */
const dayOf = (ms: number) => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** As palavras de 4 letras ou mais, sem acento. */
function words(text: string): Set<string> {
  const plain = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return new Set(plain.split(/[^a-z0-9]+/).filter(word => word.length >= 4));
}

const isOpen = (issue: DemoIssueSeed) =>
  issue.status !== 'done' && issue.status !== 'closed';

export function createDemoIdeas(clock: DemoClock): IdeasServerPort {
  const issues = new Map(
    DEMO_ISSUES.map(issue => [issue.number, { ...issue }]),
  );
  let sequence = 0;
  const view = (idea: Omit<MyIdea, 'status' | 'requests'>): MyIdea => {
    const issue = idea.issue ? issues.get(idea.issue.number) : undefined;
    return {
      ...idea,
      status: issue?.status ?? 'received',
      requests: issue?.requests ?? 1,
    };
  };
  const issueOf = (number: number) => ({ number, url: DEMO_ISSUES_URL });
  let ideas: Omit<MyIdea, 'status' | 'requests'>[] = DEMO_IDEAS.map(
    (seed, index) => ({
      // o pedido somado tem o id do issue, como no servidor
      id:
        seed.kind === 'joined' && seed.issue
          ? `issue-${seed.issue}`
          : `demo-idea-seed-${index + 1}`,
      kind: seed.kind,
      title:
        seed.kind === 'joined' && seed.issue
          ? (issues.get(seed.issue)?.title ?? seed.title)
          : seed.title,
      area: seed.area,
      createdAt: clock.daysFromNow(-seed.daysAgo, 10).getTime(),
      issue: seed.issue ? issueOf(seed.issue) : null,
    }),
  );
  const sentToday = () =>
    ideas.filter(
      idea =>
        idea.kind === 'sent' && dayOf(idea.createdAt) === dayOf(clock.now()),
    ).length;

  return {
    mine: options =>
      clock.respond(
        () => ({
          ideas: ideas.map(view),
          remainingToday: Math.max(0, IDEA_LIMITS.perDay - sentToday()),
        }),
        options?.signal,
      ),
    similar: (text, options) =>
      clock.respond((): SimilarIdea[] => {
        const mine = words(text);
        return [...issues.values()]
          .filter(isOpen)
          .map(issue => ({
            issue,
            common: [...words(issue.title)].filter(word => mine.has(word))
              .length,
          }))
          .filter(item => item.common > 0)
          .sort((a, b) => b.common - a.common)
          .slice(0, 3)
          .map(({ issue }) => ({
            number: issue.number,
            title: issue.title,
            url: DEMO_ISSUES_URL,
            status: issue.status,
            requests: issue.requests,
          }));
      }, options?.signal),
    submit: request =>
      clock.respond(() => {
        const field = IDEA_FIELDS.find(name => hasContact(request[name] ?? ''));
        if (field) throw new IdeaError('contact', field);
        if (sentToday() >= IDEA_LIMITS.perDay) throw new IdeaError('limit');
        const created = {
          id: `demo-idea-${++sequence}`,
          kind: 'sent' as const,
          title: request.title,
          area: request.area,
          createdAt: clock.now(),
          issue: null,
        };
        ideas = [created, ...ideas];
        return view(created);
      }),
    vote: number =>
      clock.respond(() => {
        const issue = issues.get(number);
        if (!issue || !isOpen(issue)) throw new IdeaError('gone');
        const mine = ideas.find(idea => idea.issue?.number === number);
        // um pedido por aluno: somar de novo só devolve o que já estava
        if (mine)
          return view({
            ...mine,
            id: `issue-${number}`,
            kind: 'joined',
            title: issue.title,
            area: null,
          });
        issue.requests += 1;
        const joined = {
          id: `issue-${number}`,
          kind: 'joined' as const,
          title: issue.title,
          area: null,
          createdAt: clock.now(),
          issue: issueOf(number),
        };
        ideas = [joined, ...ideas];
        return view(joined);
      }),
  };
}
