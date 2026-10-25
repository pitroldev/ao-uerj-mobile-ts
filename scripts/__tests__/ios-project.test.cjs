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
  // React Native starts in the scene delegate (UIScene life cycle, RN 0.88)
  const delegate = read('ios/AOUerjMobile/SceneDelegate.swift');
  assert.ok(delegate.includes(`withModuleName: "${name}"`));
});

test('Info.plist points the app scene at the SceneDelegate class', () => {
  const plist = read('ios/AOUerjMobile/Info.plist');
  const delegate = read('ios/AOUerjMobile/SceneDelegate.swift');
  assert.match(plist, /<key>UIApplicationSceneManifest<\/key>/);
  assert.match(
    plist,
    /<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/,
  );
  assert.match(delegate, /class SceneDelegate: [^{]*UIWindowSceneDelegate/);
});
