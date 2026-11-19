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

test('the app icon catalog has the light, dark and tinted 1024 px icons of iOS 18', () => {
  const directory = 'ios/AOUerjMobile/Images.xcassets/AppIcon.appiconset';
  const { images } = JSON.parse(read(`${directory}/Contents.json`));
  // um 1024 por modo (o Xcode gera os tamanhos menores)
  const mode = image =>
    image.appearances?.find(({ appearance }) => appearance === 'luminosity')
      ?.value ?? 'light';
  assert.deepEqual(
    images.map(mode).sort((a, b) => a.localeCompare(b)),
    ['dark', 'light', 'tinted'],
  );
  for (const image of images) {
    assert.deepEqual(
      [image.idiom, image.platform, image.size],
      ['universal', 'ios', '1024x1024'],
      image.filename,
    );
    const png = fs.readFileSync(path.join(root, directory, image.filename));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1024, image.filename);
    assert.equal(png.readUInt32BE(20), 1024, image.filename);
    // o claro vai à App Store (RGB, sem alfa); o tingido é cinza sobre preto;
    // o escuro tem o fundo transparente, para o fundo do sistema aparecer
    assert.equal(
      png[25],
      mode(image) === 'dark' ? 6 : 2,
      `${image.filename}: ${mode(image) === 'dark' ? 'RGBA' : 'RGB sem alfa'}`,
    );
  }
  assert.deepEqual(
    fs
      .readdirSync(path.join(root, directory))
      .sort((a, b) => a.localeCompare(b)),
    ['Contents.json', ...images.map(image => image.filename)].sort((a, b) =>
      a.localeCompare(b),
    ),
    'no icon outside the catalog',
  );
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

test('push notifications have their entitlement and the app delegate hands the token over', () => {
  // o "Me avise se tiver mesa" chega por push do servidor (APNs de produção)
  assert.match(
    read('ios/AOUerjMobile/AOUerjMobile.entitlements'),
    /<key>aps-environment<\/key>\s*<string>production<\/string>/,
  );
  const delegate = read('ios/AOUerjMobile/AppDelegate.swift');
  assert.match(delegate, /didRegisterForRemoteNotificationsWithDeviceToken/);
  assert.match(delegate, /didFailToRegisterForRemoteNotificationsWithError/);
  assert.match(delegate, /@objc\(AOPushToken\)/);
  assert.match(
    read('ios/AOUerjMobile/Native/AppNotificationsModule.mm'),
    /NSClassFromString\(@"AOPushToken"\)/,
  );
});

test('sharing a schedule declares both photo library purpose strings required by Apple', () => {
  const info = read('ios/AOUerjMobile/Info.plist');
  for (const key of [
    'NSPhotoLibraryUsageDescription',
    'NSPhotoLibraryAddUsageDescription',
  ]) {
    assert.match(
      info,
      new RegExp(`<key>${key}</key>\\s*<string>[^<]+grade[^<]+</string>`),
    );
  }
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

test('a locked screen only postpones the round when the saved account does not open', () => {
  const delegate = read('ios/AOUerjMobile/AppDelegate.swift');
  // o mesmo serviço do Keychain da conta salva, lido pelo Swift e gravado pelo JS
  const [, swiftService] = delegate.match(
    /static let credentialsService = "([^"]+)"/,
  );
  const [, jsService] = read(
    'src/adapters/outbound/persistence/credential-store.ts',
  ).match(/const service = '([^']+)'/);
  assert.equal(swiftService, jsService);
  assert.match(
    delegate,
    /isProtectedDataAvailable \|\| Self\.savedAccountReadable\(\)/,
  );
  // a conta salva abre depois do primeiro desbloqueio, e só neste aparelho
  assert.match(
    read('src/adapters/outbound/persistence/credential-store.ts'),
    /Keychain\.ACCESSIBLE\.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/,
  );
});

test('the server nudge wakes the app into the portal check round', () => {
  const delegate = read('ios/AOUerjMobile/AppDelegate.swift');
  assert.match(delegate, /userInfo\["portal"\] as\? String == "wake"/);
  assert.match(delegate, /func handlePortalWake\(/);
});

test('the silent push of Agora no campus wakes the app into a campus round', () => {
  // sem "remote-notification", o iOS não entrega o push silencioso ao app
  assert.match(
    read('ios/AOUerjMobile/Info.plist'),
    /<key>UIBackgroundModes<\/key>\s*<array>[\s\S]*?<string>remote-notification<\/string>[\s\S]*?<\/array>/,
  );
  const delegate = read('ios/AOUerjMobile/AppDelegate.swift');
  assert.match(delegate, /didReceiveRemoteNotification userInfo/);
  assert.match(delegate, /userInfo\["campus"\] as\? String == "wake"/);
  assert.match(delegate, /static let campus = "campus"/);
  // o mesmo modo que o JS roda (src/app/background/portalCheckTask.ts)
  assert.match(
    read('src/app/background/portalCheckTask.ts'),
    /data\?\.mode === 'campus'/,
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
