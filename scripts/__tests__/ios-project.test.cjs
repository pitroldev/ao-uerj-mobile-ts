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

/** A build phase `phase` (e.g. Sources) of the app target, by its template id. */
function appPhase(project, id, phase) {
  const match = project.match(
    new RegExp(`${id} /\\* ${phase} \\*/ = \\{[\\s\\S]*?\\n\\t\\t\\};`),
  );
  assert.ok(match, `${phase} build phase of the app target`);
  return match[0];
}

test('every iOS TurboModule in codegenConfig is compiled into the app and matches its spec', () => {
  const { codegenConfig } = JSON.parse(read('package.json'));
  const project = read('ios/AOUerjMobile.xcodeproj/project.pbxproj');
  const sources = appPhase(project, '13B07F871A680F5B00A75B9A', 'Sources');
  for (const [name, className] of Object.entries(
    codegenConfig.ios.modulesProvider,
  )) {
    assert.ok(fs.existsSync(path.join(root, `src/specs/Native${name}.ts`)));
    assert.match(sources, new RegExp(`${className}\\.mm in Sources`));
    const module = read(`ios/AOUerjMobile/Native/${className}.mm`);
    assert.match(
      module,
      new RegExp(`@interface ${className} : \\w+ <Native${name}Spec[,>]`),
    );
    assert.ok(module.includes(`return @"${name}";`), `${className} name`);
    assert.ok(module.includes(`Native${name}SpecJSI>(params)`), className);
  }
});

test('App Attest has its entitlement and DeviceCheck linked into the app', () => {
  assert.match(
    read('ios/AOUerjMobile/AOUerjMobile.entitlements'),
    /<key>com\.apple\.developer\.devicecheck\.appattest-environment<\/key>\s*<string>production<\/string>/,
  );
  const project = read('ios/AOUerjMobile.xcodeproj/project.pbxproj');
  const frameworks = appPhase(
    project,
    '13B07F8C1A680F5B00A75B9A',
    'Frameworks',
  );
  assert.match(frameworks, /DeviceCheck\.framework in Frameworks/);
});

test('native module name agrees with JavaScript registration', () => {
  const { name } = JSON.parse(read('app.json'));
  // React Native starts in the scene delegate (UIScene life cycle, RN 0.88),
  // and AppDelegate hands the same name to Expo (ExpoReactNativeFactoryProvider)
  const delegate = read('ios/AOUerjMobile/SceneDelegate.swift');
  assert.ok(delegate.includes(`static let moduleName = "${name}"`));
  assert.ok(delegate.includes('withModuleName: Self.moduleName'));
  assert.ok(
    read('ios/AOUerjMobile/AppDelegate.swift').includes(
      'AppReactNative.moduleName',
    ),
  );
});

test('the background check task is permitted in Info.plist, with background fetch', () => {
  const plist = read('ios/AOUerjMobile/Info.plist');
  const delegate = read('ios/AOUerjMobile/AppDelegate.swift');
  // registering an identifier missing from the plist crashes at launch
  const [, identifier] = delegate.match(/static let identifier = "([^"]+)"/);
  const permitted = plist.match(
    /<key>BGTaskSchedulerPermittedIdentifiers<\/key>\s*<array>([\s\S]*?)<\/array>/,
  );
  assert.ok(permitted, 'BGTaskSchedulerPermittedIdentifiers');
  assert.ok(
    permitted[1].includes(`<string>${identifier}</string>`),
    identifier,
  );
  assert.match(
    plist,
    /<key>UIBackgroundModes<\/key>\s*<array>[\s\S]*?<string>fetch<\/string>/,
  );
});

test('the Swift background check answers every selector the notifications module sends it', () => {
  const module = read('ios/AOUerjMobile/Native/AppNotificationsModule.mm');
  const delegate = read('ios/AOUerjMobile/AppDelegate.swift');
  const scene = read('ios/AOUerjMobile/SceneDelegate.swift');
  // the module reaches Swift by name: a mismatch only fails on the iPhone
  assert.ok(module.includes('NSClassFromString(@"AOBackgroundCheck")'));
  assert.match(delegate, /@objc\(AOBackgroundCheck\)\s*public final class/);
  const protocol = module.match(
    /@protocol AOBackgroundCheckAPI <NSObject>([\s\S]*?)@end/,
  );
  assert.ok(protocol, 'AOBackgroundCheckAPI');
  const declarations = protocol[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map(text => text.trim())
    .filter(text => text.startsWith('- ('));
  assert.equal(declarations.length, 4);
  for (const declaration of declarations) {
    // "- (void)listen:(BOOL (^)(NSDictionary *round))deliver expire:(...)expire"
    const selector = [
      ...declaration.matchAll(/(?:^- \([^)]*\)|\)\w+\s+)(\w+:)/g),
    ]
      .map(([, part]) => part)
      .join('');
    assert.ok(delegate.includes(`@objc(${selector})`), selector);
  }
  // the window-less start: a category in the module, called by name
  assert.ok(
    module.includes('- (void)ao_startReactNativeWithoutWindow'),
    'category',
  );
  assert.ok(
    scene.includes('NSSelectorFromString("ao_startReactNativeWithoutWindow")'),
  );
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
