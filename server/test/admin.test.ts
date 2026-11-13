import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { LOGIN_ATTEMPTS } from '../src/adapters/inbound/http/aouerj/admin/routes.ts';
import { createServer, type Server } from '../src/composition.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import {
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';

/*
 * A administração no navegador (`/aouerj/admin`): o login por token com o
 * cookie, a triagem dos relatos, os anexos e as sugestões.
 */

const TOKEN = 'token-de-administracao-com-folga';
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

type Answer = {
  status: number;
  headers: Headers;
  text: string;
};

async function serve(env: Record<string, string> = { ADMIN_TOKEN: TOKEN }) {
  const memory = memoryRepositories();
  const attachments = memoryAttachments();
  const db = switchableDatabase();
  const server = createServer(testConfig(env), silentLogger, {
    database: db.database,
    repositories: memory.repositories,
    attachments: attachments.store,
    portal: createPortalWatch({ probe: async () => 200 }),
  });
  opened.push(server);
  const { port } = await server.start(0);
  const base = `http://127.0.0.1:${port}`;

  let cookie = '';
  async function call(
    path: string,
    {
      method = 'GET',
      form,
      json,
      headers = {},
      signedIn = true,
    }: {
      method?: string;
      form?: Record<string, string>;
      json?: unknown;
      headers?: Record<string, string>;
      signedIn?: boolean;
    } = {},
  ): Promise<Answer> {
    const response = await fetch(`${base}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(form
          ? { 'content-type': 'application/x-www-form-urlencoded' }
          : {}),
        ...(json === undefined ? {} : { 'content-type': 'application/json' }),
        ...(signedIn && cookie ? { cookie } : {}),
        ...headers,
      },
      body: form
        ? new URLSearchParams(form).toString()
        : json === undefined
          ? undefined
          : JSON.stringify(json),
    });
    return {
      status: response.status,
      headers: response.headers,
      text: await response.text(),
    };
  }

  /** Entra com o token e guarda o cookie para as próximas chamadas. */
  async function signIn() {
    const answer = await call('/aouerj/admin/entrar', {
      method: 'POST',
      form: { token: TOKEN },
    });
    assert.equal(answer.status, 303);
    cookie = (answer.headers.get('set-cookie') ?? '').split(';')[0];
    return answer;
  }

  /** Um relato como os apps mandam: 2.x com o diagnóstico, 1.x com a página. */
  const report = (body: Record<string, unknown>) =>
    call('/aouerj/reportError', {
      method: 'POST',
      json: body,
      signedIn: false,
    });

  return { call, signIn, report, memory, attachments, db };
}

const csrfOf = (page: string) =>
  /name="csrf" value="([^"]+)"/.exec(page)?.[1] ?? '';

const diagnostic = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    schemaVersion: 1,
    operation: 'Notas',
    category: 'USER_REPORT',
    appVersion: '2.10.0',
    parserVersion: '2026.10.2',
    ...extra,
  });

test('without the token configured, the admin does not exist', async () => {
  const app = await serve({});
  assert.equal((await app.call('/aouerj/admin')).status, 404);
  assert.equal(
    (
      await app.call('/aouerj/admin/entrar', {
        method: 'POST',
        form: { token: 'qualquer-coisa' },
      })
    ).status,
    404,
  );
});

test('the page asks for the token, and the login sets a strict, http-only cookie that is not the token', async () => {
  const app = await serve();
  const login = await app.call('/aouerj/admin');
  assert.equal(login.status, 401);
  assert.match(login.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.equal(login.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(login.text, /Acesso restrito/);
  // a página que qualquer um vê não diz o que protege nem onde fica o token
  assert.doesNotMatch(
    login.text,
    /ADMIN_TOKEN|\.env|ao-uerj-server|Administração|relatos|sugest/i,
  );

  const wrong = await app.call('/aouerj/admin/entrar', {
    method: 'POST',
    form: { token: 'errado' },
  });
  assert.equal(wrong.status, 401);
  assert.match(wrong.text, /Token inválido\./);
  assert.equal(wrong.headers.get('set-cookie'), null);

  const right = await app.signIn();
  assert.equal(right.headers.get('location'), '/aouerj/admin');
  const cookie = right.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^ao_uerj_admin=[\w-]{43}; /);
  assert.match(
    cookie,
    /; Path=\/aouerj; HttpOnly; SameSite=Strict; Max-Age=2592000$/,
  );
  assert.doesNotMatch(cookie, new RegExp(TOKEN));

  const page = await app.call('/aouerj/admin');
  assert.equal(page.status, 200);
  assert.match(page.text, /Relatos de erro/);
});

test('wrong tokens are limited per address; the right one never counts', async () => {
  const app = await serve();
  const attempt = (token: string) =>
    app.call('/aouerj/admin/entrar', { method: 'POST', form: { token } });
  // acertar não gasta tentativas
  for (let i = 0; i < 3; i++) assert.equal((await attempt(TOKEN)).status, 303);
  for (let i = 0; i < LOGIN_ATTEMPTS; i++)
    assert.equal((await attempt(`errado-${i}`)).status, 401);
  const blocked = await attempt('mais-um');
  assert.equal(blocked.status, 429);
  assert.match(blocked.text, /Muitas tentativas/);
  // nem o certo passa até a janela acabar
  assert.equal((await attempt(TOKEN)).status, 429);
});

test('behind HTTPS the cookie is also Secure', async () => {
  const app = await serve({ ADMIN_TOKEN: TOKEN, TRUST_PROXY: '1' });
  const answer = await app.call('/aouerj/admin/entrar', {
    method: 'POST',
    form: { token: TOKEN },
    headers: { 'x-forwarded-proto': 'https' },
  });
  assert.match(answer.headers.get('set-cookie') ?? '', /; Secure$/);
});

test('the cookie also opens the JSON listings; another cookie does not, and leaving clears it', async () => {
  const app = await serve();
  await app.signIn();
  assert.equal((await app.call('/aouerj/reportError')).status, 200);
  assert.equal((await app.call('/aouerj/suggestions')).status, 200);

  const forged = await app.call('/aouerj/reportError', {
    signedIn: false,
    headers: { cookie: 'ao_uerj_admin=forjado' },
  });
  // sem o acesso, a listagem responde como uma rota que não existe
  assert.equal(forged.status, 404);
  // um Bearer errado não cai para o cookie
  const mixed = await app.call('/aouerj/reportError', {
    headers: { authorization: 'Bearer errado' },
  });
  assert.equal(mixed.status, 404);

  const out = await app.call('/aouerj/admin/sair', { method: 'POST' });
  assert.equal(out.status, 303);
  assert.match(
    out.headers.get('set-cookie') ?? '',
    /^ao_uerj_admin=; .*Max-Age=0/,
  );
});

test('the reports come escaped, newest first, with the diagnostic, and filter by screen', async () => {
  const app = await serve();
  await app.report({
    page: 'Login',
    description: 'Fica carregando',
    email: 'ana@example.com',
    html: [diagnostic({ category: 'PARSER_ERROR' })],
  });
  await app.report({
    page: 'Notas',
    description: '<script>alert("x")</script> e a P2 sumiu',
    html: [diagnostic({ subjectCode: 'IME02-10871' })],
  });
  await app.signIn();

  const page = (await app.call('/aouerj/admin')).text;
  assert.match(
    page,
    /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; e a P2 sumiu/,
  );
  assert.doesNotMatch(page, /<script>alert/);
  // os mais novos primeiro
  assert.ok(page.indexOf('a P2 sumiu') < page.indexOf('Fica carregando'));
  // o diagnóstico vira fatos no relato
  assert.match(page, /<dt>App<\/dt>\s*<dd>2\.10\.0<\/dd>/);
  assert.match(page, /<dt>Disciplina<\/dt>\s*<dd>IME02-10871<\/dd>/);
  assert.match(page, /<dt>Tipo<\/dt>\s*<dd>PARSER_ERROR<\/dd>/);
  assert.match(page, /href="mailto:ana@example\.com"/);
  assert.match(page, /2 abertos<\/b> em 2 telas/);

  const login = (await app.call('/aouerj/admin?tela=Login')).text;
  assert.match(login, /Fica carregando/);
  assert.doesNotMatch(login, /a P2 sumiu/);
});

test('resolving needs the page token and moves the report between the lists', async () => {
  const app = await serve();
  await app.report({ page: 'RID', description: 'Posição errada' });
  await app.signIn();
  const id = app.memory.data.reports[0].id;
  const page = (await app.call('/aouerj/admin')).text;
  const csrf = csrfOf(page);
  assert.ok(csrf.length > 20);

  // sem o csrf da página, nada muda
  const forged = await app.call(`/aouerj/admin/relatos/${id}/resolver`, {
    method: 'POST',
    form: { situacao: 'abertos' },
  });
  assert.equal(forged.status, 403);
  assert.equal(app.memory.data.reports[0].resolvedAt, null);

  const resolved = await app.call(`/aouerj/admin/relatos/${id}/resolver`, {
    method: 'POST',
    form: { csrf, situacao: 'abertos', tela: 'RID' },
  });
  assert.equal(resolved.status, 303);
  // some dos abertos: volta ao mesmo recorte, sem âncora
  assert.equal(resolved.headers.get('location'), '/aouerj/admin?tela=RID');
  // (o assert.equal acima estreitou o tipo para null)
  assert.ok(
    (app.memory.data.reports[0].resolvedAt as Date | null) instanceof Date,
  );
  assert.doesNotMatch((await app.call('/aouerj/admin')).text, /Posição errada/);
  const done = (await app.call('/aouerj/admin?situacao=resolvidos')).text;
  assert.match(done, /Posição errada/);
  assert.match(done, /Resolvido em/);

  const reopened = await app.call(`/aouerj/admin/relatos/${id}/reabrir`, {
    method: 'POST',
    form: { csrf, situacao: 'todos' },
  });
  // num recorte que o mostra, volta para o lugar dele
  assert.equal(
    reopened.headers.get('location'),
    `/aouerj/admin?situacao=todos#relato-${id}`,
  );
  assert.equal(app.memory.data.reports[0].resolvedAt, null);

  const missing = await app.call('/aouerj/admin/relatos/nao-existe/resolver', {
    method: 'POST',
    form: { csrf },
  });
  assert.equal(missing.status, 404);
});

test('an attachment opens: the diagnostic as a page, the portal page sandboxed, nothing else', async () => {
  const app = await serve();
  await app.report({ page: 'Notas', html: [diagnostic()] });
  await app.report({
    page: 'Notas',
    html: ['<html><script>steal()</script><p>Página do portal</p></html>'],
  });
  await app.signIn();
  const [modern, old] = app.memory.data.reports;

  const shown = await app.call(
    `/aouerj/admin/relatos/${modern.id}/anexos/${modern.attachmentIds[0]}`,
  );
  assert.equal(shown.status, 200);
  assert.match(shown.text, /Diagnóstico do relato/);
  assert.match(shown.text, /&quot;appVersion&quot;: &quot;2\.10\.0&quot;/);

  const portal = await app.call(
    `/aouerj/admin/relatos/${old.id}/anexos/${old.attachmentIds[0]}`,
  );
  assert.equal(portal.status, 200);
  assert.match(
    portal.headers.get('content-security-policy') ?? '',
    /^sandbox; default-src 'none'/,
  );
  assert.equal(portal.headers.get('x-content-type-options'), 'nosniff');
  assert.match(portal.text, /Página do portal/);
  // a lista diz o que é cada anexo
  const page = (await app.call('/aouerj/admin')).text;
  // (o Prettier quebra a tag de fechamento: `</a\n>`)
  assert.match(page, /<\/svg>\s*Diagnóstico\s*<\/a\s*>/);
  assert.match(page, /<\/svg>\s*Página do portal · 1 KB\s*<\/a\s*>/);

  // o anexo de outro relato, ou um que não existe, não abre
  for (const path of [
    `/aouerj/admin/relatos/${modern.id}/anexos/${old.attachmentIds[0]}`,
    `/aouerj/admin/relatos/${modern.id}/anexos/inexistente`,
    `/aouerj/admin/relatos/inexistente/anexos/${modern.attachmentIds[0]}`,
  ]) {
    assert.equal((await app.call(path)).status, 404, path);
  }
  // sem login, nem o anexo
  const anonymous = await app.call(
    `/aouerj/admin/relatos/${old.id}/anexos/${old.attachmentIds[0]}`,
    { signedIn: false },
  );
  assert.equal(anonymous.status, 401);
  assert.doesNotMatch(anonymous.text, /Página do portal/);
});

test('the suggestions tab lists them escaped, and the pages say when the database is out', async () => {
  const app = await serve();
  await app.call('/aouerj/suggestions', {
    method: 'POST',
    json: { name: 'Bia <b>', content: 'Modo escuro', email: 'bia@example.com' },
    signedIn: false,
  });
  await app.signIn();
  const page = (await app.call('/aouerj/admin/sugestoes')).text;
  assert.match(page, /Bia &lt;b&gt;/);
  assert.match(page, /1 sugestão dos apps/);

  app.db.state.ready = false;
  const out = await app.call('/aouerj/admin');
  assert.equal(out.status, 503);
  assert.match(out.text, /Banco fora do ar/);
});

test('the review shows the OTA update and a generator summary from the diagnostic', async () => {
  const app = await serve();
  await app.report({
    page: 'Gerador de Grade',
    html: [
      diagnostic({
        operation: 'Gerador de Grade',
        appVersion: '2.16.2',
        updateId: '0195f2a1-7c1e-7d3a-9b2f-1a2b3c4d5e6f',
        generator: {
          step: 2,
          outcome: 'SHORTFALL_ROUTINE',
          goal: 'COMPACT',
          chosenSubjects: 7,
          universalSubjects: 1,
          eligibleSubjects: 7,
          subjectsWithFreeClass: 1,
          classes: 7,
          freeClasses: 1,
          busySlots: 77,
          saturdayBusySlots: 17,
          lunchMinutes: 50,
        },
      }),
    ],
  });
  await app.report({ page: 'Notas', html: [diagnostic()] });
  await app.signIn();
  const summary =
    'Passo 3 de 3 (Grades) · 7 escolhidas (1 universal), 7 podem entrar, 1 com turma livre · 1 de 7 turmas livres · 77 tempos ocupados (17 no sábado) · almoço de 50 min · menos intervalos · nenhuma disciplina cabe na rotina (ocupados e almoço)';

  const list = await app.call('/aouerj/admin');
  assert.equal(list.status, 200);
  assert.match(list.text, /<dt>OTA<\/dt>\s*<dd>0195f2a1…<\/dd>/);
  assert.ok(list.text.includes(summary), 'resumo do gerador na lista');

  const report = app.memory.data.reports.find(
    item => item.page === 'Gerador de Grade',
  )!;
  const shown = await app.call(
    `/aouerj/admin/relatos/${report.id}/anexos/${report.attachmentIds[0]}`,
  );
  assert.ok(shown.text.includes('0195f2a1-7c1e-7d3a-9b2f-1a2b3c4d5e6f'));
  assert.ok(shown.text.includes(summary), 'resumo do gerador no diagnóstico');

  // sem OTA, a página do diagnóstico diz que não veio
  const other = app.memory.data.reports.find(item => item.page === 'Notas')!;
  const plain = await app.call(
    `/aouerj/admin/relatos/${other.id}/anexos/${other.attachmentIds[0]}`,
  );
  assert.ok(
    plain.text.includes('nenhuma informada (JS da loja ou app antigo)'),
  );
});
