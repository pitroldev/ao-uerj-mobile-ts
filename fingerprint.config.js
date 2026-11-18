// O runtime version das atualizações OTA (expo-updates, política fingerprint
// do app.json) é este hash do lado nativo. O build o grava no app (os assets
// do Android, o EXUpdates.bundle do iPhone) e o scripts/ota/runtime-version.cjs
// dá o mesmo valor ao publicador. Muda com android/ ou ios/, as versões dos
// módulos nativos, os patches, as specs do codegen e o certificado das
// atualizações; não muda com o JS nem com a versão do app (o bump). Ver
// docs/arquitetura.md.
const { codegenConfig } = require('./package.json');

/**
 * Tira o CR das quebras de linha: o Git do Windows (core.autocrlf) entrega os
 * arquivos com CRLF, e o mesmo código daria outro runtime version que o do CI.
 */
function withoutCarriageReturns(chunk) {
  if (chunk == null) return chunk;
  if (typeof chunk === 'string') return chunk.replaceAll('\r', '');
  return chunk.includes(0x0d)
    ? Buffer.from(chunk.filter(byte => byte !== 0x0d))
    : chunk;
}

/**
 * O projeto do Xcode guarda a versão do app (MARKETING_VERSION e
 * CURRENT_PROJECT_VERSION), que todo bump muda. Sem estas linhas no cálculo,
 * o bump não troca o runtime do iPhone: só o nativo de verdade barra um OTA,
 * como no Android, que tira a versão do package.json.
 */
const XCODE_PROJECT = 'ios/AOUerjMobile.xcodeproj/project.pbxproj';
const VERSION_SETTINGS =
  /^[ \t]*(?:MARKETING_VERSION|CURRENT_PROJECT_VERSION) = [^;\n]*;\n/gm;
/**
 * O arquivo chega em pedaços de 1 KB: junta tudo e tira as linhas no fim.
 * Cada leitura tem o próprio `source`, e duas leituras nunca se misturam.
 */
const xcodeProjectChunks = new WeakMap();

function withoutAppVersion(source, chunk, isEndOfFile) {
  const filePath = source.type === 'file' ? source.filePath : '';
  if (filePath.replaceAll('\\', '/') !== XCODE_PROJECT)
    return withoutCarriageReturns(chunk);
  const chunks = xcodeProjectChunks.get(source) ?? [];
  if (chunk != null) chunks.push(Buffer.from(withoutCarriageReturns(chunk)));
  if (!isEndOfFile) {
    xcodeProjectChunks.set(source, chunks);
    return null;
  }
  xcodeProjectChunks.delete(source);
  return Buffer.concat(chunks).toString('utf8').replace(VERSION_SETTINGS, '');
}

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  ignorePaths: [
    // arquivos desta máquina, fora do Git: o SDK, os segredos do release e os
    // caches do Android Studio e do Kotlin
    'android/local.properties',
    'android/keystore.properties',
    'android/**/*.keystore',
    'android/**/*.jks',
    'android/.idea/**/*',
    'android/**/*.iml',
    'android/.kotlin/**/*',
    // o que o pod install cria e o Git não guarda
    'ios/Podfile.lock',
    'ios/*.xcworkspace/**/*',
    'ios/**/xcuserdata/**/*',
    'ios/.xcode.env.updates',
  ],
  extraSources: [
    // as specs dos TurboModules locais: o codegen gera delas o lado nativo
    { type: 'dir', filePath: 'src/specs', reasons: ['codegenSpecs'] },
    {
      type: 'contents',
      id: 'codegenConfig',
      contents: JSON.stringify(codegenConfig),
      reasons: ['codegenConfig'],
    },
    // o certificado que confere as atualizações: com outro, é outro runtime
    {
      type: 'file',
      filePath: 'config/ota/certificate.pem',
      reasons: ['otaCodeSigningCertificate'],
    },
  ],
  fileHookTransform: withoutAppVersion,
};
