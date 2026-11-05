const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');

// A política publicada é a página deste arquivo no GitHub. O mesmo endereço
// está na Play Console e no Sobre de todo app publicado: mover ou renomear o
// arquivo quebra os dois, e a Play pode barrar a ficha do app.
const POLICY = 'docs/privacidade.md';
const POLICY_URL = `https://github.com/pitroldev/ao-uerj-mobile-ts/blob/main/${POLICY}`;

test('the privacy policy stays at the published address', () => {
  assert.ok(fs.existsSync(path.join(root, POLICY)), POLICY);
  const about = read('src/pages/About/About.tsx');
  const repo = about.match(/const GITHUB_REPO_URL = '([^']+)'/)?.[1];
  const link = about.match(/const PRIVACY_POLICY_URL = `([^`]+)`/)?.[1];
  assert.equal(link?.replace('${GITHUB_REPO_URL}', repo ?? ''), POLICY_URL);
});

test('the privacy policy has a date and the contact the app shows', () => {
  const policy = read(POLICY);
  assert.match(
    policy,
    /^\*\*Última atualização:\*\* \d{1,2} de [a-zç]+ de \d{4}$/m,
  );
  const email = read('src/pages/About/About.tsx').match(/mailto:([^?']+)/)?.[1];
  assert.ok(email && policy.includes(email), email);
});
