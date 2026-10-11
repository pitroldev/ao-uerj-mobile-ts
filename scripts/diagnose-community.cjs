/* Read-only private API diagnosis. No AO login, credentials, message or report send. */
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
process.chdir(path.resolve(__dirname, '..'));
require.extensions['.ts'] = (module, filename) => {
  module._compile(babel.transformFileSync(filename).code, filename);
};
const {
  createPrivateApiAdapters,
} = require('../src/adapters/outbound/private-api/index.ts');
const {
  Community,
} = require('../src/modules/community/application/Community.ts');
const { AppError } = require('../src/shared/errors/AppError.ts');

async function main() {
  const [subjectId, classNumber, period, extra] = process.argv.slice(2);
  assert.ok(subjectId && classNumber && period && !extra, 'EXPECTED_THREAD');
  const adapters = createPrivateApiAdapters();
  const community = new Community({
    ...adapters,
    // Read operations do not transmit this synthetic local identity.
    currentAccount: () => ({
      scope: 'read-only-diagnostic',
      name: 'Diagnostic',
    }),
  });
  const messages = await community.messages({ subjectId, classNumber, period });
  console.log(
    JSON.stringify({
      operation: 'messages/get',
      ok: true,
      count: messages.length,
      populatedThreadValidated: messages.length > 0,
      threadMatches: messages.every(
        message =>
          message.subjectId === subjectId.trim() &&
          message.classNumber === classNumber.trim() &&
          message.period === period.trim(),
      ),
    }),
  );
}

main().catch(error => {
  console.log(
    JSON.stringify({
      operation: 'messages/get',
      ok: false,
      code: error instanceof AppError ? error.code : 'DIAGNOSTIC_FAILED',
    }),
  );
  process.exitCode = 1;
});
