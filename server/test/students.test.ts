import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, test } from 'node:test';

import { createServer, type Server } from '../src/composition.ts';
import { createPortalWatch } from '../src/modules/portal/application.ts';
import type { AppAttester } from '../src/modules/access/ports.ts';
import {
  AUTH_CACHE_MS,
  createStudentIdentity,
} from '../src/modules/students/application.ts';
import {
  matriculaLookup,
  open,
  seal,
  studentKeys,
  sessionId,
  studentSessionRequestHash,
} from '../src/modules/students/domain.ts';
import {
  manualClock,
  memoryAttachments,
  memoryRepositories,
  memorySingleUse,
  memoryStudents,
  silentLogger,
  switchableDatabase,
  testConfig,
} from './support.ts';
import { mintToken, privateKeyEntry, signingKeys } from './tokens.ts';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const DATA_KEY = randomBytes(32);

/* ----------------------------------------------------------------- domínio */

test('a sealed field opens only with its own name, and the lookup never shows the matrícula', () => {
  const keys = studentKeys(DATA_KEY);
  const sealed = seal(keys, 'matricula', '201810012345');
  assert.doesNotMatch(sealed, /201810012345/);
  assert.equal(open(keys, 'matricula', sealed), '201810012345');
  // o nome cifrado não abre como matrícula, nem com outra chave
  assert.equal(open(keys, 'name', sealed), null);
  assert.equal(open(studentKeys(randomBytes(32)), 'matricula', sealed), null);
  // duas cifras do mesmo valor são diferentes; o HMAC da busca é sempre o mesmo
  assert.notEqual(seal(keys, 'matricula', '201810012345'), sealed);
  assert.equal(
    matriculaLookup(keys, '201810012345'),
    matriculaLookup(keys, '201810012345'),
  );
  assert.doesNotMatch(matriculaLookup(keys, '201810012345'), /201810012345/);
});

test('the request hash covers the matrícula and the name, with their lengths', () => {
  const base = {
    challenge: Buffer.alloc(36, 1),
    installation: Buffer.alloc(32, 2),
    matricula: '201810012345',
    name: 'MARINA COSTA',
  };
  const hash = studentSessionRequestHash(base);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(
    studentSessionRequestHash({ ...base, matricula: '201810012346' }),
    hash,
  );
  // mover uma letra entre os campos muda o hash (o tamanho vai na frente)
  assert.notEqual(
    studentSessionRequestHash({
      ...base,
      matricula: '20181001234',
      name: '5MARINA COSTA',
    }),
    hash,
  );
});

/* ---------------------------------------------------------- casos de uso */

/** Uma atestação que só confia no hash esperado (como a Play faria). */
function hashAttester(): AppAttester & { seen: string[]; trust: boolean } {
  const seen: string[] = [];
  return {
    seen,
    trust: true,
    async verify(token, requestHash) {
      seen.push(requestHash);
      return this.trust && token === `ok:${requestHash}`
        ? { trusted: true }
        : { trusted: false, reason: 'device_integrity' };
    },
  };
}

function identity() {
  const clock = manualClock();
  const people = memoryStudents();
  const attester = hashAttester();
  const students = createStudentIdentity({
    students: people.studentRepository,
    sessions: people.sessionRepository,
    usedChallenges: memorySingleUse(),
    attester,
    dataKey: DATA_KEY,
    now: clock.now,
  });
  const enroll = async (
    matricula = '201810012345',
    installation = randomBytes(32),
    name = 'MARINA COSTA',
  ) => {
    const issued = students.challenge();
    assert.ok(issued);
    const requestHash = studentSessionRequestHash({
      challenge: issued.challenge,
      installation,
      matricula,
      name,
    });
    return students.enroll({
      challenge: issued.challenge,
      installation,
      integrityToken: `ok:${requestHash}`,
      matricula,
      name,
    });
  };
  return { clock, people, attester, students, enroll };
}

test('the app signs in with the matrícula under the attestation, and a second phone is the same student', async () => {
  const { people, students, enroll } = identity();
  const first = await enroll();
  assert.ok(first.ok);
  const second = await enroll(
    '201810012345',
    randomBytes(32),
    'MARINA  COSTA ',
  );
  assert.ok(second.ok);
  assert.equal(second.studentId, first.studentId);
  const [stored] = [...people.students.values()];
  assert.ok(stored);
  // nada em claro no banco
  assert.doesNotMatch(JSON.stringify(stored), /201810012345|MARINA/);
  assert.equal(stored.devices.length, 2);
  const opened = await students.find(first.studentId);
  assert.equal(opened?.matricula, '201810012345');
  assert.equal(opened?.name, 'MARINA COSTA');
  assert.equal(
    (await students.findByMatricula('201810012345'))?.id,
    first.studentId,
  );
  // outra matrícula é outro aluno
  const other = await enroll('201910099999');
  assert.ok(other.ok);
  assert.notEqual(other.studentId, first.studentId);
});

test('a reused challenge, a foreign attestation or a bad matrícula do not sign in', async () => {
  const { attester, students } = identity();
  const issued = students.challenge();
  assert.ok(issued);
  const installation = randomBytes(32);
  const request = {
    challenge: issued.challenge,
    installation,
    matricula: '201810012345',
    name: 'MARINA COSTA',
  };
  const requestHash = studentSessionRequestHash(request);
  // a atestação de outro pedido (outra matrícula) não vale para este
  const foreign = await students.enroll({
    ...request,
    integrityToken: `ok:${studentSessionRequestHash({ ...request, matricula: '201910099999' })}`,
  });
  assert.deepEqual(
    { ok: foreign.ok, reason: !foreign.ok && foreign.reason },
    { ok: false, reason: 'attestation_failed' },
  );
  // o desafio já foi gasto na tentativa acima
  const reused = await students.enroll({
    ...request,
    integrityToken: `ok:${requestHash}`,
  });
  assert.equal(!reused.ok && reused.reason, 'invalid_challenge');
  attester.trust = false;
  const fresh = students.challenge();
  assert.ok(fresh);
  await assert.rejects(
    students.enroll({
      ...request,
      challenge: fresh.challenge,
      matricula: '12ab',
      integrityToken: 'x',
    }),
    /matricula/,
  );
});

test('the session authenticates, a ban stops it right away, and the unban lets the student back', async () => {
  const { clock, students, enroll } = identity();
  const signed = await enroll();
  assert.ok(signed.ok);
  assert.deepEqual(await students.authenticate(signed.token), {
    ok: true,
    studentId: signed.studentId,
  });
  const banned = await students.ban(
    signed.studentId,
    7,
    'Assédio na Companhia',
  );
  assert.ok(banned?.ban);
  const refused = await students.authenticate(signed.token);
  assert.equal(!refused.ok && refused.reason, 'banned');
  // e não entra de novo por outro aparelho
  const again = await enroll();
  assert.equal(!again.ok && again.reason, 'banned');
  assert.equal(
    (await students.banned(10)).map(student => student.id).join(),
    signed.studentId,
  );
  await students.unban(signed.studentId);
  assert.equal((await students.authenticate(signed.token)).ok, true);
  // o banimento de 1 dia vence sozinho
  await students.ban(signed.studentId, 1, 'Spam');
  clock.advance(DAY + MINUTE);
  assert.equal((await students.authenticate(signed.token)).ok, true);
  // o logout encerra a sessão
  await students.endSession(signed.token);
  const ended = await students.authenticate(signed.token);
  assert.equal(!ended.ok && ended.reason, 'invalid_session');
});

test('peek knows a fresh session from the cache only, never past the session, the ban or the logout', async () => {
  const { clock, people, students, enroll } = identity();
  const signed = await enroll();
  assert.ok(signed.ok);
  const me = { studentId: signed.studentId };
  // a entrada já deixa a sessão no cache
  assert.deepEqual(students.peek(signed.token), me);
  assert.equal(students.peek(randomBytes(32)), null);
  assert.equal(students.peek(Buffer.alloc(3)), null);
  // vencido o cache, só o banco diz; depois, de novo do cache
  clock.advance(AUTH_CACHE_MS);
  assert.equal(students.peek(signed.token), null);
  assert.equal((await students.authenticate(signed.token)).ok, true);
  assert.deepEqual(students.peek(signed.token), me);
  // banido: nunca pelo cache, nem depois de o banco dizer que está banido
  await students.ban(signed.studentId, 1, 'Spam');
  assert.equal(students.peek(signed.token), null);
  assert.equal((await students.authenticate(signed.token)).ok, false);
  assert.equal(students.peek(signed.token), null);
  await students.unban(signed.studentId);
  assert.equal(students.peek(signed.token), null);
  assert.equal((await students.authenticate(signed.token)).ok, true);
  assert.deepEqual(students.peek(signed.token), me);
  // o logout tira do cache na hora
  await students.endSession(signed.token);
  assert.equal(students.peek(signed.token), null);
  assert.equal((await students.authenticate(signed.token)).ok, false);

  // a sessão que vence daqui a um minuto não fica no cache além disso
  const short = await enroll('201910054321', randomBytes(32), 'LUCAS SOUZA');
  assert.ok(short.ok);
  const stored = people.sessions.get(sessionId(short.token));
  assert.ok(stored);
  clock.advance(AUTH_CACHE_MS);
  stored.expiresAt = new Date(clock.now() + MINUTE);
  assert.equal((await students.authenticate(short.token)).ok, true);
  clock.advance(2 * MINUTE);
  assert.equal(students.peek(short.token), null);
  const gone = await students.authenticate(short.token);
  assert.equal(!gone.ok && gone.reason, 'invalid_session');

  // nem o banimento que acaba daqui a um minuto
  const brief = await enroll('202010011111', randomBytes(32), 'ANA LIMA');
  assert.ok(brief.ok);
  const student = people.students.get(brief.studentId);
  assert.ok(student);
  clock.advance(AUTH_CACHE_MS);
  student.ban = {
    until: new Date(clock.now() + MINUTE),
    reason: 'Teste',
    at: new Date(clock.now()),
  };
  assert.equal((await students.authenticate(brief.token)).ok, false);
  clock.advance(2 * MINUTE);
  assert.equal((await students.authenticate(brief.token)).ok, true);
});

test('without STUDENT_DATA_KEY or an attester, nobody signs in', async () => {
  const people = memoryStudents();
  const off = createStudentIdentity({
    students: people.studentRepository,
    sessions: people.sessionRepository,
    usedChallenges: memorySingleUse(),
    attester: null,
    dataKey: DATA_KEY,
  });
  assert.equal(off.challenge(), null);
  const keyless = createStudentIdentity({
    students: people.studentRepository,
    sessions: people.sessionRepository,
    usedChallenges: memorySingleUse(),
    attester: hashAttester(),
    dataKey: null,
  });
  assert.equal(keyless.challenge(), null);
  const refused = await keyless.enroll({
    challenge: Buffer.alloc(36),
    installation: randomBytes(32),
    integrityToken: 'x',
    matricula: '201810012345',
    name: 'X',
  });
  assert.equal(!refused.ok && refused.reason, 'unavailable');
});

/* -------------------------------------------------------------------- HTTP */

const [key] = signingKeys(1);
const ADMIN = 'b'.repeat(48);
const opened: Server[] = [];

after(async () => {
  await Promise.all(opened.map(server => server.stop()));
});

async function serve(env: Record<string, string> = {}) {
  const memory = memoryRepositories();
  const db = switchableDatabase();
  const server = createServer(
    testConfig({
      PRIVATE_TOKEN_KEYS: privateKeyEntry(key),
      ADMIN_TOKEN: ADMIN,
      TOKEN_ATTESTATION: 'development',
      STUDENT_DATA_KEY: DATA_KEY.toString('base64'),
      ...env,
    }),
    silentLogger,
    {
      database: db.database,
      repositories: memory.repositories,
      attachments: memoryAttachments().store,
      portal: createPortalWatch({ probe: async () => 200 }),
    },
  );
  opened.push(server);
  const { port } = await server.start(0);
  let cookie = '';
  const call = async (
    method: 'GET' | 'POST',
    path: string,
    {
      headers = {},
      json,
      form,
      admin = false,
    }: {
      headers?: Record<string, string>;
      json?: object;
      form?: Record<string, string>;
      admin?: boolean;
    } = {},
  ) => {
    const init: RequestInit = {
      method,
      redirect: 'manual',
      headers: {
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...(form
          ? { 'content-type': 'application/x-www-form-urlencoded' }
          : {}),
        ...(admin && cookie ? { cookie } : {}),
        ...headers,
      },
    };
    if (json) init.body = JSON.stringify(json);
    if (form) init.body = new URLSearchParams(form).toString();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
    const text = await response.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: response.status, response, body, text };
  };

  /** Entra com uma matrícula (a atestação de desenvolvimento aceita tudo). */
  const signIn = async (
    matricula = '201810012345',
    name = 'MARINA COSTA',
    installation = randomBytes(32),
  ) => {
    const challenge = await call('GET', '/aouerj/v2/students/challenge');
    assert.equal(challenge.status, 200);
    const session = await call('POST', '/aouerj/v2/students/session', {
      json: {
        challenge: challenge.body.challenge,
        installation: installation.toString('base64url'),
        integrityToken: 'development',
        matricula,
        name,
      },
    });
    return session;
  };
  const as = (session: string) => ({ authorization: `Student ${session}` });

  const adminSignIn = async () => {
    const answer = await call('POST', '/aouerj/admin/entrar', {
      form: { token: ADMIN },
    });
    assert.equal(answer.status, 303);
    cookie =
      (answer.response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  };

  return { call, signIn, as, adminSignIn, memory, db };
}

const lunchAt = () => new Date(Date.now() + 20 * MINUTE).toISOString();
const lunch = (name: string) => ({
  kind: 'lunch',
  at: lunchAt(),
  spot: 'ru',
  capacity: 6,
  name,
});

test('the session comes from the matrícula and the attestation, and opens the student routes', async () => {
  const { call, signIn, as, memory } = await serve();

  const signed = await signIn();
  assert.equal(signed.status, 201);
  assert.match(signed.body.session, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(signed.response.headers.get('cache-control'), 'no-store');
  const [stored] = [...memory.data.students.values()];
  assert.doesNotMatch(JSON.stringify(stored), /201810012345|MARINA/);

  // sem a sessão, as rotas de aluno da v2 pedem uma
  const closed = await call('GET', '/aouerj/v2/teachers');
  assert.equal(closed.status, 401);
  assert.equal(closed.body.error, 'session_required');
  const listed = await call('GET', '/aouerj/v2/teachers', {
    headers: as(signed.body.session),
  });
  assert.equal(listed.status, 200);
  assert.ok(Array.isArray(listed.body.docentes));
  // uma sessão inventada é 401 invalid_session (o app entra de novo)
  const forged = await call('GET', '/aouerj/v2/teachers', {
    headers: as(randomBytes(32).toString('base64url')),
  });
  assert.equal(forged.status, 401);
  assert.equal(forged.body.error, 'invalid_session');

  // o mural e o relato guardam o aluno; a resposta não mostra
  const thread = { disciplina: '10892', turma: '2', periodo: '20262' };
  const posted = await call('POST', '/aouerj/v2/mural/messages', {
    headers: as(signed.body.session),
    json: { ...thread, fullName: 'Marina', message: 'Alguém tem a lista?' },
  });
  assert.equal(posted.status, 201);
  assert.equal(posted.body.studentId, undefined);
  assert.equal(memory.data.messages[0]?.studentId, signed.body.student.id);
  const read = await call('POST', '/aouerj/v2/mural/thread', {
    headers: as(signed.body.session),
    json: thread,
  });
  assert.equal(read.body.length, 1);
  const reported = await call('POST', '/aouerj/v2/reports', {
    headers: as(signed.body.session),
    json: { page: 'Notas', description: 'Some a nota', html: ['{}'] },
  });
  assert.equal(reported.status, 201);
  assert.equal(memory.data.reports[0]?.studentId, signed.body.student.id);

  // as rotas de /aouerj continuam como antes, sem sessão
  const legacy = await call('POST', '/aouerj/messages/post', {
    json: { ...thread, fullName: 'Ana', message: 'Oi' },
  });
  assert.equal(legacy.status, 200);
  assert.equal(memory.data.messages[1]?.studentId ?? null, null);
  const legacyReport = await call('POST', '/aouerj/reportError', {
    json: { page: 'Notas', html: ['{}'] },
  });
  assert.equal(legacyReport.status, 200);
  // a saída do app encerra a sessão
  await call('POST', '/aouerj/v2/students/session/end', {
    headers: as(signed.body.session),
  });
  const ended = await call('GET', '/aouerj/v2/teachers', {
    headers: as(signed.body.session),
  });
  assert.equal(ended.body.error, 'invalid_session');
});

test('in the Companhia, the session opens, lists and joins, and each student is one person', async () => {
  const { call, signIn, as, memory } = await serve();
  const marina = (await signIn('201810012345', 'MARINA COSTA')).body;
  const lucas = (await signIn('201910054321', 'LUCAS SOUZA')).body;
  const companion = '/aouerj/v2/companion';

  // a sessão dispensa o token e o passe
  const created = await call('POST', `${companion}/calls`, {
    headers: as(marina.session),
    json: lunch('Marina'),
  });
  assert.equal(created.status, 201);
  const callId = created.body.call.id;
  const list = await call('GET', `${companion}/calls`, {
    headers: as(lucas.session),
  });
  assert.equal(list.status, 200);
  assert.equal(list.body.calls.length, 1);

  const joined = await call('POST', `${companion}/calls/${callId}/members`, {
    headers: as(lucas.session),
    json: { name: 'Lucas' },
  });
  assert.equal(joined.status, 201);
  // a resposta nunca mostra o aluno de ninguém
  assert.doesNotMatch(JSON.stringify(joined.body), /student/);
  // o mesmo aluno não entra duas vezes (outro aparelho, outra chave)
  const twice = await call('POST', `${companion}/calls/${callId}/members`, {
    headers: as(lucas.session),
    json: { name: 'Lucas' },
  });
  assert.equal(twice.status, 409);
  assert.equal(twice.body.error, 'already_member');

  // a chave de membro sozinha não basta para quem entrou com a sessão
  const lucasKey = { 'x-member-key': joined.body.memberKey };
  const keyOnly = await call('GET', `${companion}/calls/${callId}`, {
    headers: lucasKey,
  });
  assert.equal(keyOnly.status, 403);
  assert.equal(keyOnly.body.error, 'session_required');
  const withSession = await call('GET', `${companion}/calls/${callId}`, {
    headers: { ...lucasKey, ...as(lucas.session) },
  });
  assert.equal(withSession.status, 200);
  const stolen = await call('GET', `${companion}/calls/${callId}`, {
    headers: { ...lucasKey, ...as(marina.session) },
  });
  assert.equal(stolen.status, 403);

  // quem abriu tira o Lucas, e ele não volta por outro aparelho
  const host = {
    'x-member-key': created.body.memberKey,
    ...as(marina.session),
  };
  const lucasRef = withSession.body.call.members.find(
    (member: { you: boolean }) => member.you,
  ).ref;
  const removed = await call(
    'POST',
    `${companion}/calls/${callId}/members/${lucasRef}/remove`,
    { headers: host },
  );
  assert.equal(removed.status, 200);
  const back = await call('POST', `${companion}/calls/${callId}/members`, {
    headers: as(lucas.session),
    json: { name: 'Lucas' },
  });
  assert.equal(back.status, 403);
  assert.equal(back.body.error, 'removed_from_call');

  // de fora, uma denúncia por aluno
  const ana = (await signIn('202010011111', 'ANA LIMA')).body;
  for (let i = 0; i < 2; i++) {
    const report = await call('POST', `${companion}/calls/${callId}/reports`, {
      headers: as(ana.session),
      json: { reason: 'spam' },
    });
    assert.equal(report.status, 200);
  }
  assert.equal(memory.data.callReports.length, 1);
  const [report] = memory.data.callReports;
  assert.equal(report?.reporterStudent, ana.student.id);
  assert.deepEqual(report?.people, [
    { name: 'Marina', host: true, student: marina.student.id },
  ]);

  // uma chamada aberta por vez: a segunda encerra a primeira
  const second = await call('POST', `${companion}/calls`, {
    headers: as(marina.session),
    json: lunch('Marina'),
  });
  assert.equal(second.status, 201);
  assert.ok(memory.data.calls.get(callId)?.endedAt);
});

test('the moderation bans from the admin, and the banned student is out everywhere', async () => {
  const { call, signIn, as, adminSignIn, memory } = await serve();
  const marina = (await signIn('201810012345', 'MARINA COSTA')).body;
  const lucas = (await signIn('201910054321', 'LUCAS SOUZA')).body;
  const companion = '/aouerj/v2/companion';
  // a Marina abriu uma mesa e está na do Lucas
  const hers = await call('POST', `${companion}/calls`, {
    headers: as(marina.session),
    json: lunch('Marina'),
  });
  const his = await call('POST', `${companion}/calls`, {
    headers: as(lucas.session),
    json: lunch('Lucas'),
  });
  const joined = await call(
    'POST',
    `${companion}/calls/${his.body.call.id}/members`,
    { headers: as(marina.session), json: { name: 'Marina' } },
  );
  assert.equal(joined.status, 201);
  await adminSignIn();

  // a busca vai por POST: a matrícula não fica na URL
  const tab = await call('GET', '/aouerj/admin/alunos', { admin: true });
  assert.equal(tab.status, 200);
  const csrf = /name="csrf" value="([^"]+)"/.exec(tab.text)?.[1] ?? '';
  assert.match(
    tab.text,
    /method="post" action="\/aouerj\/admin\/alunos\/busca"/,
  );
  const search = await call('POST', '/aouerj/admin/alunos/busca', {
    admin: true,
    form: { csrf, matricula: '2018.1001.2345' },
  });
  assert.equal(search.status, 200);
  assert.match(search.text, /MARINA COSTA/);
  const forged = await call('POST', '/aouerj/admin/alunos/busca', {
    admin: true,
    form: { csrf: 'outro', matricula: '201810012345' },
  });
  assert.equal(forged.status, 403);
  const page = await call('GET', `/aouerj/admin/alunos/${marina.student.id}`, {
    admin: true,
  });
  assert.equal(page.status, 200);
  assert.match(page.text, /Última entrada/);
  const banned = await call(
    'POST',
    `/aouerj/admin/alunos/${marina.student.id}/banir`,
    { admin: true, form: { csrf, prazo: '7', motivo: 'Assédio' } },
  );
  assert.equal(banned.status, 303);
  // a mesa dela acabou, e ela saiu da do Lucas
  assert.ok(memory.data.calls.get(hers.body.call.id)?.endedAt);
  const lucasCall = memory.data.calls.get(his.body.call.id);
  assert.equal(lucasCall?.endedAt ?? null, null);
  assert.deepEqual(
    lucasCall?.members.map(member => member.student),
    [lucas.student.id],
  );

  const refused = await call('GET', '/aouerj/v2/teachers', {
    headers: as(marina.session),
  });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.error, 'student_banned');
  assert.equal(refused.body.reason, 'Assédio');
  assert.ok(Date.parse(refused.body.until) > Date.now() + 6 * DAY);
  // nem entra de novo, nem gera grade
  const again = await signIn('201810012345');
  assert.equal(again.status, 403);
  assert.equal(again.body.error, 'student_banned');
  const generate = await call('POST', '/schedules/generate', {
    headers: as(marina.session),
    json: {},
  });
  assert.equal(generate.status, 403);

  const unbanned = await call(
    'POST',
    `/aouerj/admin/alunos/${marina.student.id}/desbanir`,
    { admin: true, form: { csrf } },
  );
  assert.equal(unbanned.status, 303);
  const back = await call('GET', '/aouerj/v2/teachers', {
    headers: as(marina.session),
  });
  assert.equal(back.status, 200);
});

test('the old apps keep the anonymous token until STUDENT_TOKENS=refuse', async () => {
  const accepting = await serve();
  const token = mintToken({
    issuer: key,
    privateKey: key.privateKey,
    publicKey: key.key,
  });
  const anonymous = await accepting.call('POST', '/aouerj/v2/companion/calls', {
    headers: { authorization: token },
    json: lunch('Ana'),
  });
  assert.equal(anonymous.status, 201);

  const refusing = await serve({ STUDENT_TOKENS: 'refuse' });
  const refused = await refusing.call('POST', '/aouerj/v2/companion/calls', {
    headers: {
      authorization: mintToken({
        issuer: key,
        privateKey: key.privateKey,
        publicKey: key.key,
      }),
    },
    json: lunch('Ana'),
  });
  assert.equal(refused.status, 401);
  assert.equal(refused.body.error, 'session_required');
});

test('without STUDENT_DATA_KEY the sign-in answers 503, and the admin says why', async () => {
  const { call, adminSignIn } = await serve({ STUDENT_DATA_KEY: '' });
  const challenge = await call('GET', '/aouerj/v2/students/challenge');
  assert.equal(challenge.status, 503);
  assert.equal(challenge.body.error, 'student_identity_unavailable');
  await adminSignIn();
  const tab = await call('GET', '/aouerj/admin/alunos', { admin: true });
  assert.equal(tab.status, 503);
  assert.match(tab.text, /STUDENT_DATA_KEY/);
});

test('the same student joining or opening twice at once ends up once', async () => {
  const { call, signIn, as, memory } = await serve();
  const marina = (await signIn('201810012345', 'MARINA COSTA')).body;
  const lucas = (await signIn('201910054321', 'LUCAS SOUZA')).body;
  const companion = '/aouerj/v2/companion';
  const created = await call('POST', `${companion}/calls`, {
    headers: as(marina.session),
    json: lunch('Marina'),
  });
  const callId = created.body.call.id;

  const joins = await Promise.all(
    [1, 2, 3].map(() =>
      call('POST', `${companion}/calls/${callId}/members`, {
        headers: as(lucas.session),
        json: { name: 'Lucas' },
      }),
    ),
  );
  assert.deepEqual(
    joins.map(answer => answer.status).sort((a, b) => a - b),
    [201, 409, 409],
  );
  assert.equal(memory.data.calls.get(callId)?.members.length, 2);

  const opens = await Promise.all(
    [1, 2, 3].map(() =>
      call('POST', `${companion}/calls`, {
        headers: as(lucas.session),
        json: lunch('Lucas'),
      }),
    ),
  );
  assert.ok(opens.every(answer => answer.status === 201));
  const hosted = [...memory.data.calls.values()].filter(
    item =>
      !item.endedAt &&
      item.members.some(
        member => member.host && member.student === lucas.student.id,
      ),
  );
  assert.equal(hosted.length, 1);
});

test('the generator does not wait for the database to know the student', async () => {
  const { call, signIn, as, db } = await serve();
  const marina = (await signIn()).body;
  db.state.ready = false;
  const generate = await call('POST', '/schedules/generate', {
    headers: as(marina.session),
    json: {},
  });
  // o corpo vazio é recusado pelo gerador, não pelo banco
  assert.equal(generate.status, 400);
});

test('a known session counts per student, not in the IP ceiling; an unknown one still pays per IP', async () => {
  const { call, signIn, as } = await serve({
    COMPANION_IP_LIMIT_PER_MINUTE: '3',
    STUDENT_SESSION_LIMIT_PER_MINUTE: '4',
  });
  // cinco alunos atrás do mesmo IP (o Wi-Fi da UERJ)
  const sessions: string[] = [];
  for (let i = 0; i < 5; i++) {
    const signed = await signIn(
      `20181001${String(1000 + i)}`,
      `ALUNO NUMERO ${i}`,
    );
    assert.equal(signed.status, 201);
    sessions.push(signed.body.session as string);
  }
  const list = (session: string) =>
    call('GET', '/aouerj/v2/campus-now', { headers: as(session) });
  // dez pedidos de um IP só, bem acima do teto de 3: a sessão é conhecida
  for (const session of sessions)
    for (let i = 0; i < 2; i++) assert.equal((await list(session)).status, 200);

  // um aluno só passa do limite dele
  const [first] = sessions;
  assert.equal((await list(first)).status, 200);
  assert.equal((await list(first)).status, 200);
  const over = await list(first);
  assert.equal(over.status, 429);
  assert.equal(over.body.error, 'rate_limited');
  assert.equal((await list(sessions[1])).status, 200);

  // os tokens inventados contam pelo IP: 401 até o teto, depois 429
  const bogus = () => list(randomBytes(32).toString('base64url'));
  for (let i = 0; i < 3; i++) assert.equal((await bogus()).status, 401);
  const blocked = await bogus();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'rate_limited');
  // e quem é conhecido segue
  assert.equal((await list(sessions[2])).status, 200);
});
