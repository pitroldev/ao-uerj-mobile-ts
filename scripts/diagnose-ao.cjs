/* Live, read-only AO smoke test. Credentials and student data stay in memory. */
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const axios = require('axios');

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

// Execute the app's TypeScript and adapters, replacing only native storage and
// the native cookie jar with in-memory ports for this Node diagnostic.
require.extensions['.ts'] = (module, filename) => {
  module._compile(babel.transformFileSync(filename).code, filename);
};
global.__DEV__ = false;

function provide(moduleName, exports) {
  const id = require.resolve(moduleName);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const cookies = new Map();
provide('../src/services/cookies.ts', {
  clearAllCookies: async () => cookies.clear(),
  getCookies: async () =>
    Object.fromEntries(
      [...cookies].map(([name, value]) => [name, { name, value }]),
    ),
});
provide('@react-native-async-storage/async-storage', {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
});

const authApi = require('../src/services/UerjApi/authApi.ts').default;
const api = require('../src/services/UerjApi/UerjApi.ts').default;
const store = require('../src/store/index.ts').default;
const { handleLogin } = require('../src/features/Login/core.ts');
const { fetchClassGrades } = require('../src/features/ClassGrades/core.ts');
const {
  fetchAttendedClassesSchedule,
} = require('../src/features/AttendedClassesSchedule/core.ts');
const { fetchSubjectsTaken } = require('../src/features/SubjectsTaken/core.ts');
const {
  fetchCurriculumSubjects,
} = require('../src/features/CurriculumSubjects/core.ts');
const { getSubjectInfo } = require('../src/features/SubjectInfo/core.ts');
const { fetchPartialRID } = require('../src/features/PartialRID/core.ts');

const origin = 'https://www.alunoonline.uerj.br';
const http = axios.getAdapter('http');
let requests = 0;
let logins = 0;
let stage = 'credentials';

async function transport(config) {
  const url = new URL(config.url, config.baseURL);
  assert.equal(url.origin, origin, 'UNEXPECTED_ORIGIN');
  assert.equal(config.method, 'get', 'UNEXPECTED_METHOD');
  requests += 1;
  if (config.params?.matricula && config.params?.senha) logins += 1;
  config.headers.set(
    'Cookie',
    [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
  );
  const response = await http({ ...config, maxRedirects: 0 });
  for (const cookie of response.headers['set-cookie'] || []) {
    const pair = cookie.split(';')[0];
    const separator = pair.indexOf('=');
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return response;
}

authApi.defaults.adapter = transport;
api.defaults.adapter = transport;

function report(detail) {
  console.log(JSON.stringify({ stage, ...detail }));
}

function validSubjects(items) {
  assert.ok(Array.isArray(items), 'EXPECTED_LIST');
  assert.ok(
    items.every(item => /^[A-Z]+\d{2}-\d{5}$/.test(item.id)),
    'INVALID_SUBJECT_ID',
  );
}

async function main() {
  process.loadEnvFile(path.join(projectRoot, '.env'));
  const matricula = process.env.AO_MATRICULA;
  const password = process.env.AO_PASSWORD;
  assert.ok(matricula && password, 'MISSING_AO_CREDENTIALS');

  stage = 'login';
  const login = await handleLogin(matricula, password);
  assert.ok(login.nome && !login.fail_reason, 'LOGIN_FAILED');
  report({
    ok: true,
    menuEntries: Object.keys(store.getState().apiConfig.dictionary).length,
  });

  stage = 'grades';
  const grades = await fetchClassGrades();
  validSubjects(grades);
  report({ ok: true, count: grades.length });

  stage = 'schedule';
  const schedule = await fetchAttendedClassesSchedule();
  assert.ok(
    schedule.every(item => item.class?.id === item.subject_id),
    'INVALID_SCHEDULE',
  );
  report({ ok: true, count: schedule.length });

  stage = 'history';
  const history = await fetchSubjectsTaken();
  validSubjects(history);
  report({ ok: true, count: history.length });

  stage = 'curriculum';
  const curriculum = await fetchCurriculumSubjects();
  validSubjects(curriculum);
  report({ ok: true, count: curriculum.length });

  stage = 'partial-rid';
  const rid = await fetchPartialRID();
  validSubjects(rid.subjects);
  report({ ok: true, count: rid.subjects.length });

  const subjectId = curriculum[0]?.id?.split('-')[1];
  if (subjectId) {
    stage = 'subject-details';
    const subject = await getSubjectInfo(subjectId);
    assert.equal(subject.id, curriculum[0].id, 'SUBJECT_MISMATCH');
    report({ ok: true, classes: subject.classes.length });
  }

  if (process.argv.includes('--expire-session')) {
    stage = 'session-recovery';
    const before = store.getState().apiConfig;
    const previousLogins = logins;
    // Discard only this process's cookie jar; no logout endpoint is called.
    cookies.clear();
    const recovered = await fetchClassGrades();
    const after = store.getState().apiConfig;
    validSubjects(recovered);
    assert.deepEqual(recovered, grades, 'RECOVERED_GRADES_MISMATCH');
    assert.notEqual(after._token, before._token, 'TOKEN_NOT_RENEWED');
    assert.notEqual(
      after.dictionary.notas,
      before.dictionary.notas,
      'REQUEST_ID_NOT_RENEWED',
    );
    assert.equal(logins - previousLogins, 1, 'EXPECTED_ONE_REFRESH');
    report({
      ok: true,
      count: recovered.length,
      refreshes: logins - previousLogins,
    });

    if (subjectId) {
      stage = 'derived-request-recovery';
      await getSubjectInfo(subjectId);
      const beforeDerivedRefresh = logins;
      cookies.clear();
      const recoveredSubject = await getSubjectInfo(subjectId);
      assert.equal(
        recoveredSubject.id,
        curriculum[0].id,
        'RECOVERED_SUBJECT_MISMATCH',
      );
      assert.equal(logins - beforeDerivedRefresh, 1, 'EXPECTED_ONE_REFRESH');
      report({ ok: true, refreshes: logins - beforeDerivedRefresh });
    }
  }

  stage = 'complete';
  report({ ok: true, requests, logins });
}

main()
  .catch(error => {
    // Never print Axios errors: their config contains credentials/cookies/HTML.
    const candidate =
      error.code === 'ERR_ASSERTION'
        ? error.message
        : error.code || error.message;
    const code = /^[A-Z][A-Z0-9_]+$/.test(candidate)
      ? candidate
      : 'DIAGNOSTIC_FAILED';
    report({ ok: false, code, status: error.response?.status });
    process.exitCode = 1;
  })
  .finally(() => cookies.clear());
