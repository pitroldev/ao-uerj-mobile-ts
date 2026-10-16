/* Opt-in diagnostic. No PDFs, identifiers, tokens or credentials are logged or saved. */
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const { createNodePortalTransport } = require('./lib/ao-node-transport.cjs');
const root = path.resolve(__dirname, '..');
process.chdir(root);
require.extensions['.ts'] = (module, filename) => {
  module._compile(babel.transformFileSync(filename).code, filename);
};
const {
  createAlunoOnlineAdapter,
} = require('../src/adapters/outbound/aluno-online/index.ts');
const { transport, cookies } = createNodePortalTransport();
let stage = 'credentials';
let adapter;
let reprintRevision;
const report = detail => console.log(JSON.stringify({ stage, ...detail }));

async function main() {
  process.loadEnvFile(path.join(root, '.env'));
  const credentials = {
    matricula: process.env.AO_MATRICULA,
    password: process.env.AO_PASSWORD,
  };
  assert.ok(
    credentials.matricula && credentials.password,
    'MISSING_AO_CREDENTIALS',
  );
  adapter = createAlunoOnlineAdapter({
    cookies,
    transport: {
      ...transport,
      request(request) {
        // Even if the selected document disappears while diagnosing, never
        // let this script issue a new document. There is no deletion call.
        if (
          request.method === 'POST' &&
          (!reprintRevision ||
            request.params?.identificacaoDocumento !== reprintRevision)
        ) {
          throw new Error('REPRINT_DOCUMENT_CHANGED');
        }
        return transport.request(request);
      },
    },
    readCredentials: async () => credentials,
  });
  stage = 'login';
  await adapter.authentication.signIn(credentials);
  report({ ok: true });
  stage = 'catalog';
  const documents = await adapter.documents.list();
  report({
    ok: true,
    count: documents.length,
    available: documents.filter(item => item.canIssue).length,
  });
  if (process.argv.includes('--reprint-existing')) {
    stage = 'reprint';
    const existing = documents.find(item => {
      if (!item.canIssue || !item.revision || !item.validUntil) return false;
      const [day, month, year] = item.validUntil.split('/').map(Number);
      return new Date(year, month - 1, day, 23, 59, 59).getTime() > Date.now();
    });
    if (!existing) {
      report({ skipped: true, reason: 'NO_VALID_EXISTING_DOCUMENT' });
      return;
    }
    reprintRevision = existing.revision;
    const pdf = await adapter.documents.issue(existing.id);
    const bytes = Buffer.from(pdf.base64, 'base64');
    assert.equal(
      bytes.subarray(0, 5).toString('ascii'),
      '%PDF-',
      'INVALID_PDF_SIGNATURE',
    );
    report({ ok: true, bytes: bytes.length, mimeType: pdf.mimeType });
  }
}

main()
  .catch(error => {
    const candidate =
      error.code === 'ERR_ASSERTION'
        ? error.message
        : error.code || error.message;
    report({
      ok: false,
      code: /^[A-Z][A-Z0-9_]+$/.test(candidate)
        ? candidate
        : 'DIAGNOSTIC_FAILED',
    });
    process.exitCode = 1;
  })
  .then(async () => {
    if (adapter) await adapter.authentication.signOut();
    else await cookies.clear();
  })
  .catch(() => {
    report({ ok: false, code: 'CLEANUP_FAILED' });
    process.exitCode = 1;
  });
