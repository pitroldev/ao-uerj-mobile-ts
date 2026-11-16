/* Opt-in, read-only portal diagnostic. Secrets and academic data stay in memory. */
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const { createNodePortalTransport } = require('./lib/ao-node-transport.cjs');
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);
require.extensions['.ts'] = (module, filename) => {
  module._compile(babel.transformFileSync(filename).code, filename);
};
const {
  createAlunoOnlineAdapter,
} = require('../src/adapters/outbound/aluno-online/index.ts');
const { transport, cookies, counts } = createNodePortalTransport();
let stage = 'credentials';
let adapter;
function report(detail) {
  console.log(JSON.stringify({ stage, ...detail }));
}
function validSubjects(items) {
  assert.ok(Array.isArray(items), 'EXPECTED_LIST');
  assert.ok(
    items.every(item => /^[A-Z]+\d+-\d+$/.test(item.id)),
    'INVALID_SUBJECT_ID',
  );
}
async function main() {
  process.loadEnvFile(path.join(projectRoot, '.env'));
  const credentials = {
    matricula: process.env.AO_MATRICULA,
    password: process.env.AO_PASSWORD,
  };
  assert.ok(
    credentials.matricula && credentials.password,
    'MISSING_AO_CREDENTIALS',
  );
  adapter = createAlunoOnlineAdapter({
    transport,
    cookies,
    readCredentials: async () => credentials,
  });
  const { authentication, records, diagnostics } = adapter;
  stage = 'login';
  await authentication.signIn(credentials);
  const menu = diagnostics.snapshot();
  report({
    ok: true,
    menuEntries: menu.operations.length,
    blockedEntries: menu.blocked.length,
  });
  // The portal blocks most of the menu during enrollment while the login
  // still works. A blocked page is reported and skipped: it says nothing
  // about the parsers, and the other pages are still worth checking.
  const blockedStages = [];
  async function page(name, read) {
    stage = name;
    try {
      return await read();
    } catch (error) {
      if (error?.code !== 'POSSIBLY_BLOCKED') throw error;
      blockedStages.push(name);
      report({ ok: false, code: 'POSSIBLY_BLOCKED' });
      return null;
    }
  }
  const grades = await page('grades', () => records.getGrades());
  if (grades) {
    validSubjects(grades);
    report({ ok: true, count: grades.length });
  }
  const schedule = await page('schedule', () => records.getSchedule());
  if (schedule) {
    assert.ok(
      schedule.every(item => item.class?.id === item.subject_id),
      'INVALID_SCHEDULE',
    );
    report({ ok: true, count: schedule.length });
  }
  const history = await page('history', () => records.getHistory());
  if (history) {
    validSubjects(history);
    report({ ok: true, count: history.length });
  }
  const curriculum = await page('curriculum', () => records.getCurriculum());
  if (curriculum) {
    validSubjects(curriculum);
    report({ ok: true, count: curriculum.length });
  }
  const universal = await page('universal-subjects', () =>
    records.getUniversalSubjects(),
  );
  if (universal) {
    validSubjects(universal);
    report({ ok: true, count: universal.length });
  }
  const rid = await page('partial-rid', () => records.getPartialRid());
  if (rid) {
    validSubjects(rid.subjects);
    report({ ok: true, count: rid.subjects.length });
  }
  const subjectId = curriculum?.[0]?.id;
  if (subjectId) {
    const subject = await page('subject-details', () =>
      records.getSubjectDetails(subjectId),
    );
    if (subject) {
      assert.equal(subject.id, subjectId, 'SUBJECT_MISMATCH');
      report({ ok: true, classes: subject.classes.length });
    }
  }
  if (process.argv.includes('--expire-session') && !grades) {
    stage = 'session-recovery';
    report({ ok: false, code: 'POSSIBLY_BLOCKED' });
  } else if (process.argv.includes('--expire-session')) {
    stage = 'session-recovery';
    const before = diagnostics.snapshot();
    const previousLogins = counts().logins;
    await cookies.clear();
    const [recovered, concurrent] = await Promise.all([
      records.getGrades(),
      records.getGrades(),
    ]);
    validSubjects(recovered);
    assert.deepEqual(recovered, grades, 'RECOVERED_GRADES_MISMATCH');
    assert.deepEqual(concurrent, grades, 'CONCURRENT_GRADES_MISMATCH');
    const after = diagnostics.snapshot();
    assert.notEqual(
      after.sessionGeneration,
      before.sessionGeneration,
      'SESSION_NOT_RENEWED',
    );
    assert.equal(
      after.identityGeneration,
      before.identityGeneration,
      'IDENTITY_CHANGED',
    );
    assert.equal(counts().logins - previousLogins, 1, 'EXPECTED_ONE_REFRESH');
    report({
      ok: true,
      count: recovered.length,
      refreshes: counts().logins - previousLogins,
    });
    if (subjectId) {
      stage = 'derived-request-recovery';
      await records.getSubjectDetails(subjectId);
      const beforeDerivedRefresh = counts().logins;
      await cookies.clear();
      const recoveredSubject = await records.getSubjectDetails(subjectId);
      assert.equal(
        recoveredSubject.id,
        subjectId,
        'RECOVERED_SUBJECT_MISMATCH',
      );
      assert.equal(
        counts().logins - beforeDerivedRefresh,
        1,
        'EXPECTED_ONE_REFRESH',
      );
      report({ ok: true, refreshes: counts().logins - beforeDerivedRefresh });
    }
  }
  stage = 'complete';
  report({ ok: true, ...counts(), blockedStages });
}
main()
  .catch(error => {
    // Axios errors carry credential-bearing request config; never print them.
    const candidate =
      error.code === 'ERR_ASSERTION'
        ? error.message
        : error.code || error.message;
    const code = /^[A-Z][A-Z0-9_]+$/.test(candidate)
      ? candidate
      : 'DIAGNOSTIC_FAILED';
    report({ ok: false, code });
    process.exitCode = 1;
  })
  // main() errors were handled above, so this runs on both outcomes.
  .then(async () => {
    if (adapter) await adapter.authentication.signOut();
    else await cookies.clear();
  })
  .catch(() => {
    // Same rule as above: never print the error itself.
    report({ ok: false, code: 'CLEANUP_FAILED' });
    process.exitCode = 1;
  });
