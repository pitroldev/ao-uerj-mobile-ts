import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, test } from 'node:test';

import { createServer, type Server } from '../src/composition.ts';
import { createIdeas } from '../src/modules/ideas/application.ts';
import {
  checkIdea,
  issueBody,
  issueStatusOf,
  similarIssues,
  VOTES_MARKER,
  type NewIdea,
} from '../src/modules/ideas/domain.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { DomainError } from '../src/shared/errors.ts';
import { fakeGitHub, memoryIdeas } from './ideasSupport.ts';
import {
  manualClock,
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
  tidy,
} from './support.ts';
import { privateKeyEntry, signingKeys } from './tokens.ts';

/*
 * As sugestões do app que viram issue no GitHub: as regras da ideia, o
 * limite do dia, a moderação (publicar, juntar, arquivar), os pedidos
 * somados, o estado que volta do GitHub, as rotas da v2 e a administração.
 */

/** Quinta, 19/11/2026, 10h em São Paulo. */
const THURSDAY = Date.UTC(2026, 10, 19, 13);

const ana = { studentId: 'ana' };
const bia = { studentId: 'bia' };

const idea = (extra: Partial<NewIdea> = {}): NewIdea => ({
  title: 'Cardápio do bandejão no Início',
  area: 'home',
  problem: 'Toda vez tenho que abrir o site do RU para ver o que tem hoje.',
  idea: 'Um cartão no Início com o almoço e o jantar do dia.',
  portal: 'no',
  appVersion: '2.20.0',
  platform: 'android',
  seenSimilar: [],
  ...extra,
});

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (err: unknown) => (err instanceof DomainError ? err.code : String(err)),
  );

function setup({ github = true, start = THURSDAY } = {}) {
  const clock = manualClock(start);
  const memory = memoryIdeas();
  const gh = fakeGitHub({ now: clock.now });
  const errors: unknown[] = [];
  const ideas = createIdeas({
    ideas: memory.repositories.ideas,
    votes: memory.repositories.ideaVotes,
    tracked: memory.repositories.trackedIssues,
    tracker: github ? gh.tracker : null,
    now: clock.now,
    onError: err => errors.push(err),
  });
  return { ideas, memory, gh, clock, errors };
}

/* --------------------------------------------------------------- domínio */

test('an idea is trimmed, loses a typed "[Sugestão]" and cannot carry a contact', () => {
  const checked = checkIdea(
    idea({
      title: '  [Sugestão]   Cardápio   do RU ',
      problem: 'Linha um\r\n\r\n\r\n\r\nLinha   dois',
      idea: '   ',
      seenSimilar: [31, 31, 0, 7],
    }),
  );
  assert.equal(checked.title, 'Cardápio do RU');
  assert.equal(checked.problem, 'Linha um\n\nLinha dois');
  assert.equal(checked.idea, null);
  assert.deepEqual(checked.seenSimilar, [31, 7]);

  assert.throws(() => checkIdea(idea({ title: 'RU' })), /title must have/);
  assert.throws(() => checkIdea(idea({ problem: 'curto' })), /problem must/);
  assert.throws(
    () => checkIdea(idea({ idea: 'x'.repeat(1001) })),
    /idea must have at most/,
  );
  for (const field of ['title', 'problem', 'idea'] as const)
    assert.throws(
      () =>
        checkIdea(idea({ [field]: 'me chama no insta @ana.uerj por favor' })),
      (err: unknown) =>
        err instanceof DomainError &&
        err.code === 'idea_contact' &&
        err.message.includes(field),
    );
});

test('the issue body has the form sections and nothing about who sent it', () => {
  const body = issueBody(
    idea({ problem: '# não vira título\n> nem citação', idea: null }),
  );
  assert.match(body, /### Qual problema isso resolve\?/);
  assert.match(body, /\\# não vira título\n\\> nem citação/);
  assert.match(body, /_Não descreveu._/);
  assert.match(body, /### O Aluno Online já faz isso\?\n\nNão/);
  assert.match(body, /### Onde no app\n\nInício/);
  assert.match(body, /AO UERJ 2\.20\.0 \(Android\)/);
  assert.doesNotMatch(body, /ana|matr[ií]cula: \d/i);
});

test('the status follows the labels and how the issue was closed', () => {
  const open = { state: 'open' as const, stateReason: null };
  assert.equal(issueStatusOf({ ...open, labels: ['enhancement'] }), 'open');
  assert.equal(issueStatusOf({ ...open, labels: ['planejada'] }), 'planned');
  assert.equal(
    issueStatusOf({ ...open, labels: ['planejada', 'em andamento'] }),
    'in_progress',
  );
  assert.equal(
    issueStatusOf({ state: 'closed', stateReason: 'completed', labels: [] }),
    'done',
  );
  assert.equal(
    issueStatusOf({ state: 'closed', stateReason: 'not_planned', labels: [] }),
    'closed',
  );
});

test('similar issues share the words that matter, accents and plurals aside', () => {
  const issues = [
    { title: '[Sugestão] Cardápio do bandejão' },
    { title: 'Aviso de vagas nas turmas do RID' },
    { title: 'Modo escuro' },
  ];
  assert.deepEqual(
    similarIssues('Cardapio do bandejao no inicio', issues).map(i => i.title),
    ['[Sugestão] Cardápio do bandejão'],
  );
  assert.deepEqual(
    similarIssues('avisar quando abrir vaga na turma', issues).map(
      i => i.title,
    ),
    ['Aviso de vagas nas turmas do RID'],
  );
  assert.deepEqual(similarIssues('queria uma tela', issues), []);
});

/* --------------------------------------------------------- caso de uso */

test('three a day per student, counted by the São Paulo day', async () => {
  const { ideas, clock } = setup();
  for (let i = 0; i < 3; i += 1) await ideas.submit(idea(), ana);
  assert.equal(await code(ideas.submit(idea(), ana)), 'idea_limit');
  // outro aluno tem as dele
  assert.equal(await code(ideas.submit(idea(), bia)), 'ok');
  assert.equal((await ideas.mine(ana)).remainingToday, 0);

  // 23h59 em São Paulo ainda é o mesmo dia; meia-noite, não
  clock.advance(Date.UTC(2026, 10, 20, 2, 59) - clock.now());
  assert.equal(await code(ideas.submit(idea(), ana)), 'idea_limit');
  clock.advance(60 * 1000);
  assert.equal(await code(ideas.submit(idea(), ana)), 'ok');
  assert.equal((await ideas.mine(ana)).remainingToday, 2);
});

test('publishing opens one issue with the labels, counts the author and shows it as open', async () => {
  const { ideas, gh } = setup();
  const sent = await ideas.submit(idea({ area: 'rid' }), ana);
  assert.equal(sent.status, 'received');
  assert.equal(gh.calls.length, 0);

  const published = await ideas.publish(sent.id);
  assert.equal(published.result, 'published');
  const [issue] = [...gh.issues.values()];
  assert.equal(issue.title, '[Sugestão] Cardápio do bandejão no Início');
  assert.deepEqual(issue.labels, [
    'enhancement',
    'sugestão do app',
    'área: RID',
  ]);
  assert.doesNotMatch(issue.body, /ana/);

  // duas abas: a segunda não abre outro
  assert.deepEqual(await ideas.publish(sent.id), { result: 'gone' });
  assert.equal(gh.issues.size, 1);

  const mine = await ideas.mine(ana);
  assert.equal(mine.ideas.length, 1);
  assert.deepEqual(mine.ideas[0], {
    id: sent.id,
    kind: 'sent',
    title: 'Cardápio do bandejão no Início',
    area: 'rid',
    createdAt: sent.createdAt,
    status: 'open',
    issue: { number: issue.number, url: issue.url },
    requests: 1,
  });
  // o próprio pedido não vira comentário
  assert.equal(gh.comments.length, 0);
});

test('GitHub failing leaves the idea waiting, to publish again', async () => {
  const { ideas, gh, memory } = setup();
  const sent = await ideas.submit(idea(), ana);
  gh.fail();
  await assert.rejects(ideas.publish(sent.id), /github is down/);
  assert.equal(memory.ideas[0].status, 'received');
  gh.fail(false);
  assert.equal((await ideas.publish(sent.id)).result, 'published');
});

test('merging and voting add one request per student, in one bot comment', async () => {
  const { ideas, gh } = setup();
  const old = gh.add({ title: 'Aviso de vaga nas turmas do RID', plusOnes: 2 });
  gh.add({ title: 'Um bug', labels: ['bug'] });
  const closed = gh.add({ title: 'Modo escuro' });
  gh.close(closed.number, 'completed');

  const sent = await ideas.submit(
    idea({ title: 'Avisar quando abrir vaga no RID' }),
    ana,
  );
  // só um issue de sugestão aberto
  assert.equal(await ideas.merge(sent.id, 102), 'issue_not_found');
  assert.equal(await ideas.merge(sent.id, closed.number), 'issue_not_found');
  assert.equal(await ideas.merge(sent.id, 999), 'issue_not_found');
  assert.equal(await ideas.merge(sent.id, old.number), 'merged');
  assert.equal(await ideas.merge(sent.id, old.number), 'gone');
  assert.deepEqual(gh.comments, [
    {
      issue: old.number,
      marker: VOTES_MARKER,
      body: `${VOTES_MARKER}\n**1 aluno pediu** isto pelo app AO UERJ (sem nome, matrícula nem e-mail).`,
    },
  ]);

  // Bia soma o pedido pelo app, duas vezes: conta uma
  const joined = await ideas.vote(old.number, bia);
  assert.equal(joined.kind, 'joined');
  assert.equal(joined.requests, 4);
  await ideas.vote(old.number, bia);
  assert.equal(gh.comments.length, 1);
  assert.match(gh.comments[0].body, /\*\*2 alunos pediram\*\*/);

  assert.equal(await code(ideas.vote(closed.number, bia)), 'issue_not_found');

  // na lista da Ana, a dela aponta para o issue; na da Bia, o pedido somado
  const anas = (await ideas.mine(ana)).ideas;
  assert.equal(anas.length, 1);
  assert.equal(anas[0].kind, 'sent');
  assert.equal(anas[0].issue?.number, old.number);
  assert.equal(anas[0].requests, 4);
  const bias = (await ideas.mine(bia)).ideas;
  assert.deepEqual(
    bias.map(item => [item.kind, item.title, item.area]),
    [['joined', 'Aviso de vaga nas turmas do RID', null]],
  );
});

test('the sync brings the labels and the closing back to "Minhas sugestões"', async () => {
  const { ideas, gh } = setup();
  const sent = await ideas.submit(idea(), ana);
  const published = await ideas.publish(sent.id);
  assert.equal(published.result, 'published');
  const number = published.result === 'published' ? published.issue.number : 0;
  const statusNow = async () => (await ideas.mine(ana)).ideas[0].status;

  gh.label(number, 'planejada');
  assert.equal(await statusNow(), 'open');
  assert.equal(await ideas.syncIssues(), 1);
  assert.equal(await statusNow(), 'planned');

  gh.close(number, 'completed');
  await ideas.syncIssues();
  assert.equal(await statusNow(), 'done');

  // apagado no GitHub: fica o último estado conhecido
  gh.issues.delete(number);
  assert.equal(await ideas.syncIssues(), 0);
  assert.equal(await statusNow(), 'done');
});

test('archiving shows "not published" and can be undone; decided ones stay in the review', async () => {
  const { ideas } = setup();
  const sent = await ideas.submit(idea(), ana);
  assert.equal(await ideas.archive(sent.id), 'archived');
  assert.equal(await ideas.archive(sent.id), 'gone');
  assert.equal((await ideas.mine(ana)).ideas[0].status, 'not_published');
  let review = await ideas.forReview();
  assert.deepEqual([review.received.length, review.decided.length], [0, 1]);

  assert.equal(await ideas.reopen(sent.id), 'reopened');
  assert.equal(await ideas.reopen(sent.id), 'gone');
  review = await ideas.forReview();
  assert.deepEqual([review.received.length, review.decided.length], [1, 0]);
});

test('similar issues come from the open suggestions, cached, with the requests', async () => {
  const { ideas, gh, clock } = setup();
  const issue = gh.add({ title: 'Cardápio do bandejão', plusOnes: 3 });
  const [found] = await ideas.similar('cardápio do RU no início');
  assert.deepEqual(found, {
    number: issue.number,
    title: 'Cardápio do bandejão',
    url: issue.url,
    status: 'open',
    requests: 3,
  });
  // dentro dos dez minutos, nada de GitHub
  gh.add({ title: 'Cardápio no widget' });
  const lists = () => gh.calls.filter(call => call.startsWith('list')).length;
  await ideas.similar('cardápio');
  assert.equal(lists(), 1);
  clock.advance(11 * 60 * 1000);
  assert.equal((await ideas.similar('cardápio')).length, 2);
  assert.equal(lists(), 2);
});

test('without GitHub, ideas still arrive but nothing is published', async () => {
  const { ideas } = setup({ github: false });
  assert.equal(ideas.publishing(), false);
  assert.equal(ideas.repository(), null);
  const sent = await ideas.submit(idea(), ana);
  assert.deepEqual(await ideas.similar('cardápio'), []);
  assert.deepEqual(await ideas.publish(sent.id), { result: 'unavailable' });
  assert.equal(await ideas.merge(sent.id, 31), 'unavailable');
  assert.equal(await code(ideas.vote(31, ana)), 'suggestions_unavailable');
  assert.equal(await ideas.syncIssues(), 0);
});

/* ------------------------------------------------------------- HTTP v2 */

const [key] = signingKeys(1);
const DATA_KEY = randomBytes(32);
const ADMIN_TOKEN = 'token-de-administracao-com-folga';
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

async function serve({ github = true } = {}) {
  const memory = memoryRepositories();
  const gh = fakeGitHub();
  const server = createServer(
    testConfig({
      PRIVATE_TOKEN_KEYS: privateKeyEntry(key),
      TOKEN_ATTESTATION: 'development',
      STUDENT_DATA_KEY: DATA_KEY.toString('base64'),
      ADMIN_TOKEN,
    }),
    silentLogger,
    {
      database: switchableDatabase().database,
      repositories: memory.repositories,
      attachments: memoryAttachments().store,
      portal: createPortalWatch({ probe: async () => 200 }),
      issueTracker: github ? gh.tracker : null,
    },
  );
  opened.push(server);
  const { port } = await server.start(0);
  const origin = `http://127.0.0.1:${port}`;

  const call = async (
    method: 'GET' | 'POST',
    path: string,
    {
      headers = {},
      json,
    }: { headers?: Record<string, string>; json?: unknown } = {},
  ) => {
    const response = await fetch(`${origin}/aouerj/v2${path}`, {
      method,
      headers: {
        ...(json === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    });
    const text = await response.text();
    const body: any = text ? JSON.parse(text) : null;
    return { status: response.status, body };
  };

  const signIn = async (matricula: string, name: string) => {
    const challenge = await call('GET', '/students/challenge');
    const session = await call('POST', '/students/session', {
      json: {
        challenge: challenge.body.challenge,
        installation: randomBytes(32).toString('base64url'),
        integrityToken: 'development',
        matricula,
        name,
      },
    });
    assert.equal(session.status, 201);
    return { authorization: `Student ${session.body.session}` };
  };

  let cookie = '';
  const admin = async (
    path: string,
    form?: Record<string, string>,
  ): Promise<{ status: number; location: string; text: string }> => {
    const response = await fetch(`${origin}/aouerj/admin${path}`, {
      method: form ? 'POST' : 'GET',
      redirect: 'manual',
      headers: {
        ...(form
          ? { 'content-type': 'application/x-www-form-urlencoded' }
          : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    if (path === '/entrar')
      cookie = (response.headers.get('set-cookie') ?? '').split(';')[0];
    return {
      status: response.status,
      location: response.headers.get('location') ?? '',
      text: tidy(await response.text()),
    };
  };

  return { call, signIn, admin, memory, gh };
}

const body = (extra: Record<string, unknown> = {}) => ({
  title: 'Cardápio do bandejão no Início',
  area: 'home',
  problem: 'Toda vez tenho que abrir o site do RU para ver o que tem hoje.',
  portal: 'no',
  appVersion: '2.20.0',
  platform: 'android',
  ...extra,
});

test('the routes: only with the session; sending, the limits and the list', async () => {
  const { call, signIn, gh } = await serve();
  assert.equal((await call('GET', '/ideas')).status, 401);
  assert.equal((await call('POST', '/ideas', { json: body() })).status, 401);

  const session = await signIn('201810012345', 'ANA LIMA');
  for (const [wrong, message] of [
    [{ area: 'nada' }, /area must be one of/],
    [{ portal: undefined }, /portal is required/],
    [{ platform: 'web' }, /platform must be one of/],
    [{ appVersion: 'v 2' }, /appVersion/],
    [{ title: 'RU' }, /title must have/],
    [{ seenSimilar: ['31'] }, /seenSimilar/],
  ] as const) {
    const refused = await call('POST', '/ideas', {
      headers: session,
      json: body(wrong),
    });
    assert.equal(refused.status, 400, JSON.stringify(wrong));
    assert.match(refused.body.message, message);
  }
  const contact = await call('POST', '/ideas', {
    headers: session,
    json: body({ problem: 'me chama no zap 21 99999-8888 pra explicar' }),
  });
  assert.equal(contact.status, 422);
  assert.equal(contact.body.error, 'idea_contact');

  const created = await call('POST', '/ideas', {
    headers: session,
    json: body({ seenSimilar: [31] }),
  });
  assert.equal(created.status, 201);
  assert.deepEqual(
    { ...created.body.idea, id: undefined, createdAt: undefined },
    {
      id: undefined,
      kind: 'sent',
      title: 'Cardápio do bandejão no Início',
      area: 'home',
      createdAt: undefined,
      status: 'received',
      issue: null,
      requests: 1,
    },
  );
  await call('POST', '/ideas', { headers: session, json: body() });
  await call('POST', '/ideas', { headers: session, json: body() });
  const limited = await call('POST', '/ideas', {
    headers: session,
    json: body(),
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, 'idea_limit');

  const mine = await call('GET', '/ideas', { headers: session });
  assert.equal(mine.status, 200);
  assert.equal(mine.body.ideas.length, 3);
  assert.equal(mine.body.remainingToday, 0);

  // as parecidas e o pedido somado
  const issue = gh.add({ title: '[Sugestão] Cardápio do bandejão' });
  const similar = await call('POST', '/ideas/similar', {
    headers: session,
    json: { text: 'cardápio do RU' },
  });
  assert.deepEqual(similar.body.similar, [
    {
      number: issue.number,
      title: 'Cardápio do bandejão',
      url: issue.url,
      status: 'open',
      requests: 0,
    },
  ]);
  const vote = await call('POST', '/ideas/votes', {
    headers: session,
    json: { issue: issue.number },
  });
  assert.equal(vote.status, 200);
  assert.equal(vote.body.idea.kind, 'joined');
  assert.equal(vote.body.idea.requests, 1);
  assert.equal(
    (
      await call('POST', '/ideas/votes', {
        headers: session,
        json: { issue: 9999 },
      })
    ).body.error,
    'issue_not_found',
  );
  assert.equal(
    (
      await call('POST', '/ideas/votes', {
        headers: session,
        json: { issue: 'um' },
      })
    ).status,
    400,
  );
});

test('the admin publishes, merges, archives and undoes; GitHub off is said on the page', async () => {
  const { call, signIn, admin, gh, memory } = await serve();
  const session = await signIn('201810012345', 'ANA LIMA');
  const old = gh.add({ title: 'Cardápio do bandejão' });
  for (const title of [
    'Cardápio do bandejão no Início',
    'Avisar vaga no RID',
    'Modo escuro de verdade',
  ])
    await call('POST', '/ideas', { headers: session, json: body({ title }) });
  const [first, second, third] = memory.data.ideas;

  assert.equal((await admin('/entrar', { token: ADMIN_TOKEN })).status, 303);
  const page = await admin(`/sugestoes?item=app-${first.id}`);
  assert.equal(page.status, 200);
  assert.match(page.text, /Cardápio do bandejão no Início/);
  assert.match(page.text, /pelo app 2\.20\.0, Android/);
  assert.match(page.text, /ANA LIMA|Ana Lima/);
  // a parecida aparece, com o "Juntar à #N"
  assert.match(page.text, new RegExp(`Juntar à #${old.number}`));
  assert.match(page.text, /Publicar no GitHub/);
  const csrf = /name="csrf" value="([^"]+)"/.exec(page.text)?.[1] ?? '';

  // publicar: volta com o aviso e o número
  const published = await admin(`/sugestoes/app/${first.id}/publicar`, {
    csrf,
    aba: 'fila',
  });
  assert.equal(published.status, 303);
  assert.match(published.location, /feito=publicada/);
  const number = memory.data.ideas[0].issue;
  assert.ok(number);
  assert.match(published.location, new RegExp(`n=${number}`));
  assert.match(
    (await admin(published.location.replace(/^\/aouerj\/admin/, ''))).text,
    new RegExp(`Publicada como #${number}`),
  );

  // juntar pelo número digitado
  const merged = await admin(`/sugestoes/app/${second.id}/juntar`, {
    csrf,
    issue: `#${old.number}`,
  });
  assert.match(merged.location, /feito=juntada/);
  assert.equal(memory.data.ideas[1].status, 'merged');
  const wrong = await admin(`/sugestoes/app/${third.id}/juntar`, {
    csrf,
    issue: 'abc',
  });
  assert.match(wrong.location, /feito=sem-issue/);

  // arquivar e desfazer
  const archived = await admin(`/sugestoes/app/${third.id}/arquivar`, {
    csrf,
  });
  assert.match(archived.location, /feito=guardada/);
  const flash = await admin(archived.location.replace(/^\/aouerj\/admin/, ''));
  assert.match(
    flash.text,
    new RegExp(`action="/aouerj/admin/sugestoes/app/${third.id}/desarquivar"`),
  );
  assert.equal(
    (await admin(`/sugestoes/app/${third.id}/desarquivar`, { csrf })).status,
    303,
  );
  assert.equal(memory.data.ideas[2].status, 'received');

  // sem o csrf, nada
  assert.equal(
    (await admin(`/sugestoes/app/${third.id}/publicar`, {})).status,
    403,
  );

  // o GitHub fora do ar: a página diz, e a sugestão continua nas novas
  gh.fail();
  const down = await admin(`/sugestoes/app/${third.id}/publicar`, { csrf });
  assert.equal(down.status, 502);
  assert.match(down.text, /O GitHub não respondeu/);
  assert.equal(memory.data.ideas[2].status, 'received');
  // e a prévia abre, com as parecidas do cache (dez minutos)
  const without = await admin(`/sugestoes?item=app-${third.id}`);
  assert.equal(without.status, 200);
  assert.match(without.text, /Nenhuma aberta parecida/);

  // o status diz onde publica
  assert.match(
    (await admin('/status')).text,
    /publica em <span class="code">pitroldev\/ao-uerj-mobile-ts<\/span>/,
  );
});

test('without the GitHub App, the admin says so and does not offer to publish', async () => {
  const { call, signIn, admin, memory } = await serve({ github: false });
  const session = await signIn('201810012345', 'ANA LIMA');
  await call('POST', '/ideas', { headers: session, json: body() });
  const [first] = memory.data.ideas;
  await admin('/entrar', { token: ADMIN_TOKEN });
  const page = await admin(`/sugestoes?item=app-${first.id}`);
  assert.doesNotMatch(page.text, /Publicar no GitHub/);
  assert.match(page.text, /falta o GitHub App no \.env/);
  assert.match((await admin('/status')).text, /desligado \(falta o GitHub App/);
  // os da v2 continuam respondendo
  const similar = await call('POST', '/ideas/similar', {
    headers: session,
    json: { text: 'cardápio' },
  });
  assert.deepEqual(similar.body, { similar: [] });
});
