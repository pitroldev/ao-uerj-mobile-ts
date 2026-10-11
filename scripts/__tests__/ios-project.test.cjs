const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');

test('iOS scheme references targets and the project that actually exist', () => {
  const scheme = read(
    'ios/AOUerjMobile.xcodeproj/xcshareddata/xcschemes/AOUerjMobile.xcscheme',
  );
  const project = read('ios/AOUerjMobile.xcodeproj/project.pbxproj');
  for (const [, id] of scheme.matchAll(
    /BlueprintIdentifier = "([A-F0-9]+)"/g,
  )) {
    assert.match(
      project,
      new RegExp(`${id} /\\* [^*]+ \\*/ = \\{\\s*isa = PBXNativeTarget;`),
    );
  }
  for (const [, container] of scheme.matchAll(
    /ReferencedContainer = "container:([^"]+)"/g,
  )) {
    assert.ok(fs.existsSync(path.join(root, 'ios', container)), container);
  }
});

test('iOS source resources exist with exact casing and privacy manifest is bundled', () => {
  const project = read('ios/AOUerjMobile.xcodeproj/project.pbxproj');
  for (const [, resource] of project.matchAll(
    /path = (AOUerjMobile\/[^;]+);/g,
  )) {
    const [directory, name] = resource.split('/');
    assert.ok(fs.readdirSync(path.join(root, 'ios')).includes(directory));
    assert.ok(
      fs.readdirSync(path.join(root, 'ios', directory)).includes(name),
      resource,
    );
  }
  assert.match(
    project,
    /PrivacyInfo\.xcprivacy in Resources \*\/ = \{isa = PBXBuildFile/,
  );
  const resources = project
    .split('/* Begin PBXResourcesBuildPhase section */')[1]
    .split('/* End PBXResourcesBuildPhase section */')[0];
  assert.match(resources, /PrivacyInfo\.xcprivacy in Resources/);
});

test('native module name agrees with JavaScript registration', () => {
  const { name } = JSON.parse(read('app.json'));
  const delegate = read('ios/AOUerjMobile/AppDelegate.swift');
  assert.ok(delegate.includes(`withModuleName: "${name}"`));
});
