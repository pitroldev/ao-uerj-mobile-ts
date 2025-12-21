const fs = require('fs');
const path = require('path');

function patchFile(relativePath, replacers) {
  const absolutePath = path.resolve(__dirname, '..', relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { absolutePath, changed: false, skipped: true, reason: 'missing' };
  }

  const before = fs.readFileSync(absolutePath, 'utf8');
  let after = before;

  for (const { from, to } of replacers) {
    after = after.split(from).join(to);
  }

  if (after === before) {
    return { absolutePath, changed: false, skipped: false };
  }

  fs.writeFileSync(absolutePath, after, 'utf8');
  return { absolutePath, changed: true, skipped: false };
}

const results = [];

// Fix for Gradle 7+ / 8+ / 9+: jcenter() is removed.
results.push(
  patchFile('node_modules/@react-native-cookies/cookies/android/build.gradle', [
    { from: 'jcenter()', to: 'mavenCentral()' },
  ]),
);

const changed = results.filter(r => r.changed);
const missing = results.filter(r => r.skipped);

if (changed.length > 0) {
  console.log('[postinstall] Patched Android deps:');
  for (const r of changed) console.log(`- ${r.absolutePath}`);
}

// Don’t fail installs if the dep isn’t present (e.g., optional installs).
if (missing.length > 0) {
  console.log(
    '[postinstall] Some Android dep patch targets not found (skipped).',
  );
}
