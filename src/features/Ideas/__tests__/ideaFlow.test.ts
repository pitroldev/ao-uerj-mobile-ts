import type { MyIdea, SimilarIdea } from '@root/modules/ideas/domain/ideas';
import {
  ideaFlow,
  INITIAL_IDEA,
  visibleProblems,
  type IdeaFlow,
} from '../ideaFlow';

const similar = (number: number): SimilarIdea => ({
  number,
  title: `Parecida ${number}`,
  url: `https://github.com/o/r/issues/${number}`,
  status: 'open',
  requests: 2,
});

const SENT: MyIdea = {
  id: 'i1',
  kind: 'sent',
  title: 'Avisar quando abrir vaga no RID',
  area: 'rid',
  createdAt: 1,
  status: 'received',
  issue: null,
  requests: 1,
};

/** Um rascunho pronto, no passo 1. */
function written(): IdeaFlow {
  return [
    { type: 'text', field: 'title', value: SENT.title },
    { type: 'area', value: 'rid' },
    {
      type: 'text',
      field: 'problem',
      value: 'Fico abrindo o portal toda hora.',
    },
  ].reduce(
    (state, event) => ideaFlow(state, event as Parameters<typeof ideaFlow>[1]),
    INITIAL_IDEA,
  );
}

it('shows the contact at once and the missing fields only after "Próximo"', () => {
  let state = ideaFlow(INITIAL_IDEA, {
    type: 'text',
    field: 'problem',
    value: 'Me chama no @duda',
  });
  expect(visibleProblems(state)).toEqual({ problem: 'at' });
  state = ideaFlow(state, { type: 'next' });
  expect(state).toMatchObject({ step: 'write', tried: true, busy: null });
  expect(visibleProblems(state)).toEqual({
    title: 'short',
    area: 'short',
    problem: 'at',
  });
});

it('searches the similar ones and shows them, or goes straight to the preview', () => {
  const searching = ideaFlow(written(), { type: 'next' });
  expect(searching.busy).toBe('searching');
  // nada muda no texto enquanto procura
  expect(
    ideaFlow(searching, { type: 'text', field: 'title', value: 'x' }),
  ).toBe(searching);

  const found = ideaFlow(searching, {
    type: 'found',
    similar: [similar(31), similar(24)],
  });
  expect(found).toMatchObject({ step: 'similar', busy: null });
  const other = ideaFlow(found, { type: 'other' });
  expect(other).toMatchObject({ step: 'review', seenSimilar: [31, 24] });
  // voltar das parecidas esquece o "a minha é outra"
  expect(ideaFlow(other, { type: 'back' })).toMatchObject({
    step: 'similar',
    seenSimilar: [],
  });

  const none = ideaFlow(searching, { type: 'found', similar: [] });
  expect(none.step).toBe('review');
  expect(ideaFlow(none, { type: 'back' }).step).toBe('write');
});

it('sends from the preview and confirms', () => {
  const review = ideaFlow(ideaFlow(written(), { type: 'next' }), {
    type: 'found',
    similar: [],
  });
  const sending = ideaFlow(review, { type: 'send' });
  expect(sending.busy).toBe('sending');
  expect(ideaFlow(sending, { type: 'back' })).toBe(sending);
  expect(ideaFlow(sending, { type: 'done', idea: SENT })).toMatchObject({
    step: 'done',
    busy: null,
    result: SENT,
  });
  expect(ideaFlow(sending, { type: 'failed' })).toMatchObject({
    step: 'review',
    busy: null,
  });
});

it('goes back to the text with the field the server refused, until it changes', () => {
  const sending = ideaFlow(
    ideaFlow(ideaFlow(written(), { type: 'next' }), {
      type: 'found',
      similar: [],
    }),
    { type: 'send' },
  );
  const refused = ideaFlow(sending, { type: 'refused', field: 'title' });
  expect(refused).toMatchObject({ step: 'write', refused: 'title' });
  expect(visibleProblems(refused)).toEqual({ title: 'refused' });
  expect(ideaFlow(refused, { type: 'next' }).busy).toBeNull();
  const edited = ideaFlow(refused, {
    type: 'text',
    field: 'title',
    value: 'Aviso de vaga no RID',
  });
  expect(edited.refused).toBeNull();
  expect(ideaFlow(edited, { type: 'next' }).busy).toBe('searching');
});

it('joins a similar issue, or drops it when it closed', () => {
  const found = ideaFlow(ideaFlow(written(), { type: 'next' }), {
    type: 'found',
    similar: [similar(31), similar(24)],
  });
  const joining = ideaFlow(found, { type: 'join', issue: 31 });
  expect(joining.busy).toEqual({ joining: 31 });
  expect(ideaFlow(joining, { type: 'join', issue: 24 })).toBe(joining);
  const gone = ideaFlow(joining, { type: 'gone', issue: 31 });
  expect(gone).toMatchObject({ step: 'similar', busy: null });
  expect(gone.similar.map(item => item.number)).toEqual([24]);
  // a última que fechou leva à prévia
  const last = ideaFlow(ideaFlow(gone, { type: 'join', issue: 24 }), {
    type: 'gone',
    issue: 24,
  });
  expect(last.step).toBe('review');
});
