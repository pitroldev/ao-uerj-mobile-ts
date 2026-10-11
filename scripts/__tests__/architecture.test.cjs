const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { ESLint } = require('eslint');

test('domain/application reject frameworks and outbound implementation imports', async () => {
  const eslint = new ESLint({ cwd: path.resolve(__dirname, '../..') });
  for (const layer of ['domain', 'application']) {
    const filePath = `src/modules/example/${layer}/Boundary.ts`;
    for (const dependency of [
      'react',
      'axios',
      'react-native',
      '@react-native-community/netinfo',
      '@root/adapters/outbound/private-api',
      '@root/app/providers/AppServicesProvider',
      '@root/services/parser',
    ]) {
      const [result] = await eslint.lintText(
        `import dependency from '${dependency}';\nexport default dependency;\n`,
        { filePath },
      );
      assert.ok(
        result.messages.some(
          message => message.ruleId === 'no-restricted-imports',
        ),
        `${layer}: ${dependency}`,
      );
    }
    const [allowed] = await eslint.lintText(
      "import type { SomePort } from './ports';\nexport type Port = SomePort;\n",
      { filePath },
    );
    assert.ok(
      !allowed.messages.some(
        message => message.ruleId === 'no-restricted-imports',
      ),
    );
  }
});
