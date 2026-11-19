import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { LOGIN_ATTEMPTS } from '../src/adapters/inbound/http/aouerj/admin/routes.ts';
import { createServer, type Server } from '../src/composition.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import { groupKey } from '../src/modules/reports/application.ts';
import {
  parseDiagnostic,
  reportSignature,
} from '../src/modules/reports/domain.ts';
import {
  memoryAttachments,
  memoryRepositories,
  silentLogger,
  switchableDatabase,
  testConfig,
  tidy,
} from './support.ts';

/*
 * A administração no navegador (`/aouerj/admin`): o login por token com o
 * cookie, as áreas, os relatos agrupados, os anexos e as sugestões.
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
      text: tidy(await response.text()),
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
  assert.match(page.text, /<h1>Início<\/h1>/);
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

/** As linhas da lista de uma área: o link de cada uma e o texto. */
const rowsOf = (page: string) =>
  [...page.matchAll(/<a class="row" href="([^"]+)"[\s\S]*?<\/a\s*>/g)].map(
    match => ({
      href: match[1].replace(/&amp;/g, '&'),
      text: match[0],
    }),
  );

/** A chave do grupo dos relatos com esta tela e este diagnóstico. */
const keyOf = (page: string, diagnosticJson: string | null) =>
  groupKey(
    reportSignature(
      page,
      diagnosticJson ? parseDiagnostic(diagnosticJson) : null,
    ),
  );

test('the areas share the side bar with what asks you in each, and the page runs no inline script', async () => {
  const app = await serve();
  await app.report({
    page: 'Notas',
    description: 'A P2 sumiu',
    html: [diagnostic()],
  });
  await app.call('/aouerj/suggestions', {
    method: 'POST',
    json: {
      name: 'Bia',
      content: 'Modo escuro </script><script>alert(1)</script>',
    },
    signedIn: false,
  });
  await app.signIn();

  const home = await app.call('/aouerj/admin');
  assert.equal(home.status, 200);
  // uma área para cada coisa, na barra lateral, com o que pede você
  for (const area of [
    'Companhia agora',
    'Agora no campus',
    'Alunos',
    'Relatos',
    'Sugestões',
    'Status',
  ])
    assert.match(home.text, new RegExp(`<span class="lbl">${area}</span>`));
  assert.match(
    home.text,
    /<span class="lbl">Relatos<\/span><span class="n" title="pedem você">1<\/span>/,
  );
  assert.match(
    home.text,
    /<span class="lbl">Sugestões<\/span><span class="n" title="pedem você">1<\/span>/,
  );
  // cada cartão do Início leva à sua área
  assert.match(home.text, /class="acard-h" href="\/aouerj\/admin\/relatos"/);
  // só o script da própria administração (a CSP do helmet barra o resto)
  const scripts = [...home.text.matchAll(/<script\b([^>]*)>/g)].map(
    match => match[1],
  );
  assert.deepEqual(
    scripts.map(attributes => attributes.trim()),
    [
      'src="/aouerj/admin/admin.js" defer',
      'type="application/json" id="palette-data"',
    ],
  );
  // o "Ir para" leva o texto como dado: nada da sugestão fecha a tag
  const data =
    /<script type="application\/json" id="palette-data">([\s\S]*?)<\/script>/.exec(
      home.text,
    )?.[1] ?? '';
  assert.doesNotMatch(data, /<\/?script/i);
  assert.ok(
    (JSON.parse(data) as Array<{ label: string }>).some(entry =>
      entry.label.includes('</script><script>'),
    ),
  );
  assert.match(
    home.headers.get('content-security-policy') ?? '',
    /script-src 'self'/,
  );

  const script = await app.call('/aouerj/admin/admin.js', { signedIn: false });
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type') ?? '', /javascript/);
  assert.match(script.text, /data-hold/);
  const font = await app.call('/aouerj/admin/fonts/inter-regular.woff2', {
    signedIn: false,
  });
  assert.equal(font.status, 200);
  assert.equal(font.headers.get('content-type'), 'font/woff2');
  assert.equal(
    (await app.call('/aouerj/admin/fonts/../routes.ts', { signedIn: false }))
      .status,
    404,
  );
  assert.equal(
    (await app.call('/aouerj/admin/fonts/outra.woff2', { signedIn: false }))
      .status,
    404,
  );
});

test('the reports come grouped by the error, escaped, the biggest group first, with the diagnostic', async () => {
  const app = await serve();
  const login = diagnostic({ category: 'PARSER_ERROR' });
  await app.report({
    page: 'Login',
    description: 'Fica carregando',
    email: 'ana@example.com',
    html: [login],
  });
  const notes = diagnostic({ subjectCode: 'IME02-10871' });
  await app.report({
    page: 'Notas',
    description: '<script>alert("x")</script> e a P2 sumiu',
    html: [notes],
  });
  await app.report({
    page: 'Notas',
    description: 'A P2 aparece 0,0',
    html: [notes],
  });
  await app.signIn();

  const page = (await app.call('/aouerj/admin/relatos')).text;
  assert.match(page, /3 relatos, em 2 grupos/);
  // o grupo maior primeiro, já aberto na prévia
  const rows = rowsOf(page);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].href.endsWith(`item=${keyOf('Notas', notes)}`));
  assert.match(rows[0].text, /×2/);
  assert.match(
    page,
    /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; e a P2 sumiu/,
  );
  assert.doesNotMatch(page, /<script>alert/);
  assert.match(page, /Disciplina IME02-10871/);
  assert.match(page, /2\.10\.0 · 2/);
  // o relato do aluno sem erro de leitura vira o título pelo começo do mais novo
  assert.match(rows[0].text, /A P2 aparece 0,0/);

  const other = (await app.call(rows[1].href)).text;
  assert.match(other, /Fica carregando/);
  assert.match(other, /href="mailto:ana@example\.com"/);
  assert.match(other, /<span class="code">PARSER_ERROR<\/span>/);
  assert.doesNotMatch(other, /e a P2 sumiu<\/p>/);
});

test('resolving needs the page token, one report or the whole group, and the group comes back with Desfazer', async () => {
  const app = await serve();
  const rid = diagnostic({
    portalErrors: { 'partial-rid': 'PORTAL_LAYOUT_CHANGED' },
  });
  await app.report({ page: 'RID', description: 'Posição errada', html: [rid] });
  await app.report({
    page: 'RID',
    description: 'Não mostra a fila',
    html: [rid],
  });
  await app.report({
    page: 'Notas',
    description: 'Nota sumiu',
    html: [diagnostic()],
  });
  await app.signIn();
  const key = keyOf('RID', rid);
  const page = (await app.call(`/aouerj/admin/relatos?item=${key}`)).text;
  assert.match(page, /O RID: o portal mudou a página/);
  const csrf = csrfOf(page);
  assert.ok(csrf.length > 20);

  // sem o csrf da página, nada muda
  const forged = await app.call(
    `/aouerj/admin/relatos/grupos/${key}/resolver`,
    { method: 'POST', form: {} },
  );
  assert.equal(forged.status, 403);
  assert.ok(
    app.memory.data.reports.every(report => report.resolvedAt === null),
  );

  // o grupo inteiro, e a volta para o próximo da lista
  const notes = keyOf('Notas', diagnostic());
  const resolved = await app.call(
    `/aouerj/admin/relatos/grupos/${key}/resolver`,
    {
      method: 'POST',
      form: { csrf, aba: 'fila', proximo: notes },
    },
  );
  assert.equal(resolved.status, 303);
  const location = resolved.headers.get('location') ?? '';
  assert.match(
    location,
    new RegExp(
      `^/aouerj/admin/relatos\\?item=${notes}&feito=resolvidos&ref=${key}&n=2&em=\\d+$`,
    ),
  );
  const rids = app.memory.data.reports.filter(report => report.page === 'RID');
  assert.ok(rids.every(report => report.resolvedAt instanceof Date));
  const resolvedPage = await app.call(location);
  assert.doesNotMatch(resolvedPage.text, /Posição errada/);
  assert.match(resolvedPage.text, /2 relatos resolvidos/);
  // o "Desfazer" reabre só os que esse clique resolveu
  const em = /&em=(\d+)/.exec(location)?.[1] ?? '';
  assert.match(
    resolvedPage.text,
    new RegExp(`<input type="hidden" name="em" value="${em}" />`),
  );
  const older = app.memory.data.reports.find(
    report => report.page === 'Notas',
  )!;
  older.resolvedAt = new Date(Number(em) - 60_000);
  older.page = 'RID';
  older.attachmentIds = rids[0].attachmentIds;
  const undo = await app.call(`/aouerj/admin/relatos/grupos/${key}/reabrir`, {
    method: 'POST',
    form: { csrf, em },
  });
  assert.equal(undo.status, 303);
  assert.match(
    undo.headers.get('location') ?? '',
    /feito=reabertos&ref=[0-9a-f]+&n=2$/,
  );
  assert.ok(rids.every(report => report.resolvedAt === null));
  assert.ok(older.resolvedAt instanceof Date);

  // um relato só, de dentro do grupo
  const [one] = rids;
  const single = await app.call(`/aouerj/admin/relatos/${one.id}/resolver`, {
    method: 'POST',
    form: { csrf, volta: key, aba: 'fila' },
  });
  assert.equal(
    single.headers.get('location'),
    `/aouerj/admin/relatos?item=${key}&feito=resolvido&ref=${one.id}`,
  );
  assert.ok(one.resolvedAt instanceof Date);
  const done = (await app.call('/aouerj/admin/relatos?aba=feitos')).text;
  assert.match(done, /Reabrir/);
  const reopened = await app.call(`/aouerj/admin/relatos/${one.id}/reabrir`, {
    method: 'POST',
    form: { csrf },
  });
  assert.equal(reopened.status, 303);
  assert.equal(one.resolvedAt, null);

  const missing = await app.call('/aouerj/admin/relatos/nao-existe/resolver', {
    method: 'POST',
    form: { csrf },
  });
  assert.equal(missing.status, 404);
  const noGroup = await app.call(
    '/aouerj/admin/relatos/grupos/000000000000/resolver',
    { method: 'POST', form: { csrf } },
  );
  assert.equal(noGroup.status, 404);
});

test('an attachment opens: the diagnostic as a page, the portal page sandboxed, nothing else', async () => {
  const app = await serve();
  const anonymized = diagnostic({
    portalErrors: { schedule: 'PORTAL_LAYOUT_CHANGED' },
    pages: ['schedule'],
  });
  await app.report({
    page: 'Horários',
    html: [anonymized, '<html><p>Xxxxxx da grade</p></html>'],
  });
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

  // a página anonimizada (2.x) aparece na prévia, isolada; a da 1.x, não
  const group = (
    await app.call(
      `/aouerj/admin/relatos?item=${keyOf('Horários', anonymized)}`,
    )
  ).text;
  assert.match(
    group,
    new RegExp(
      `<iframe sandbox="" [^>]*src="/aouerj/admin/relatos/${modern.id}/anexos/${modern.attachmentIds[1]}"`,
    ),
  );
  assert.match(group, /<\/svg>Diagnóstico 1<\/a>/);
  const legacy = (
    await app.call(`/aouerj/admin/relatos?item=${keyOf('Notas', null)}`)
  ).text;
  assert.doesNotMatch(legacy, /<iframe/);
  assert.match(legacy, /<\/svg>Página do portal · 1 KB<\/a>/);
  assert.match(legacy, /sem diagnóstico \(app 1\.x\)/);

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

test('suggestions come escaped, are archived with the page token and come back with Desfazer', async () => {
  const app = await serve();
  for (const content of ['Modo escuro', 'Widget das notas'])
    await app.call('/aouerj/suggestions', {
      method: 'POST',
      json: { name: 'Bia <b>', content, email: 'bia@example.com' },
      signedIn: false,
    });
  await app.signIn();
  const page = (await app.call('/aouerj/admin/sugestoes')).text;
  assert.match(page, /Bia &lt;b&gt;/);
  assert.match(page, /2 novas/);
  const [first, second] = [...app.memory.data.suggestions].reverse();
  const csrf = csrfOf(page);

  assert.equal(
    (
      await app.call(`/aouerj/admin/sugestoes/${first.id}/arquivar`, {
        method: 'POST',
        form: {},
      })
    ).status,
    403,
  );
  const archived = await app.call(
    `/aouerj/admin/sugestoes/${first.id}/arquivar`,
    {
      method: 'POST',
      form: { csrf, aba: 'fila', proximo: second.id },
    },
  );
  assert.equal(
    archived.headers.get('location'),
    `/aouerj/admin/sugestoes?item=${second.id}&feito=arquivada&ref=${first.id}`,
  );
  assert.ok(first.archivedAt instanceof Date);
  const archivedPage = (await app.call(archived.headers.get('location')!)).text;
  assert.match(archivedPage, /1 nova/);
  assert.match(
    archivedPage,
    new RegExp(`action="/aouerj/admin/sugestoes/${first.id}/desarquivar"`),
  );
  assert.match(
    (await app.call('/aouerj/admin/sugestoes?aba=feitos')).text,
    /Modo escuro/,
  );
  // a listagem em JSON dos apps antigos não muda
  const listed = await app.call('/aouerj/suggestions');
  assert.deepEqual(
    Object.keys((JSON.parse(listed.text) as object[])[0]).sort(),
    ['_id', 'content', 'createdAt', 'email', 'name', 'updatedAt'],
  );

  const back = await app.call(
    `/aouerj/admin/sugestoes/${first.id}/desarquivar`,
    { method: 'POST', form: { csrf } },
  );
  assert.equal(back.status, 303);
  assert.equal(first.archivedAt, null);
  assert.equal(
    (
      await app.call('/aouerj/admin/sugestoes/nao-existe/arquivar', {
        method: 'POST',
        form: { csrf },
      })
    ).status,
    404,
  );

  app.db.state.ready = false;
  const out = await app.call('/aouerj/admin');
  assert.equal(out.status, 503);
  assert.match(out.text, /Banco fora do ar/);
  // o status abre sem o banco: é quando ele mais importa
  const status = await app.call('/aouerj/admin/status');
  assert.equal(status.status, 200);
  assert.match(status.text, /fora do ar/);
});

test('the review shows the OTA update and a generator summary from the diagnostic', async () => {
  const app = await serve();
  const generator = diagnostic({
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
  });
  await app.report({ page: 'Gerador de Grade', html: [generator] });
  await app.report({ page: 'Notas', html: [diagnostic()] });
  await app.signIn();
  const summary =
    'Passo 3 de 3 (Grades) · 7 escolhidas (1 universal), 7 podem entrar, 1 com turma livre · 1 de 7 turmas livres · 77 tempos ocupados (17 no sábado) · almoço de 50 min · menos intervalos · nenhuma disciplina cabe na rotina (ocupados e almoço)';

  const list = await app.call(
    `/aouerj/admin/relatos?item=${keyOf('Gerador de Grade', generator)}`,
  );
  assert.equal(list.status, 200);
  assert.match(list.text, /Gerador: nenhuma disciplina cabe na rotina/);
  assert.match(list.text, /1 de 1 com a OTA 0195f2a1…/);
  assert.ok(list.text.includes(summary), 'resumo do gerador na prévia');
  // o resumo para a issue vai sem nome, matrícula nem e-mail
  assert.match(
    list.text,
    /data-copy="\*\*Gerador: nenhuma disciplina cabe na rotina/,
  );

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
