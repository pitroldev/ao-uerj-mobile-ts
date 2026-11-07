// O runtime version das atualizações OTA (expo-updates, política fingerprint
// do app.json) é este hash do lado nativo. O build o grava no app (os assets
// do Android, o EXUpdates.bundle do iPhone) e o scripts/ota/runtime-version.cjs
// dá o mesmo valor ao publicador. Muda com android/ ou ios/, as versões dos
// módulos nativos, os patches, as specs do codegen e o certificado das
// atualizações; não muda com o JS. Ver docs/arquitetura.md.
const { codegenConfig } = require('./package.json');

/**
 * Tira o CR das quebras de linha: o Git do Windows (core.autocrlf) entrega os
 * arquivos com CRLF, e o mesmo código daria outro runtime version que o do CI.
 */
function withoutCarriageReturns(_source, chunk) {
  if (chunk == null) return chunk;
  if (typeof chunk === 'string') return chunk.replaceAll('\r', '');
  return chunk.includes(0x0d)
    ? Buffer.from(chunk.filter(byte => byte !== 0x0d))
    : chunk;
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
  fileHookTransform: withoutCarriageReturns,
};
