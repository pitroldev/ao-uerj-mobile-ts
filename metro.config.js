const { mergeConfig } = require('@react-native/metro-config');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/**
 * A configuração do Expo (`expo/metro-config`), com o Sentry por cima. O
 * `expo export` das atualizações OTA (scripts/ota/publish.cjs) exige o
 * serializer do Expo, e o `withSentryConfig` trocava o serializer: o export
 * parava em "Serializer did not return expected format". Ela também põe o
 * hash de cada imagem (fileHashes), sem o qual o manifesto embutido do
 * expo-updates e os updates OTA saem sem as imagens. O Debug ID do Sentry
 * continua no bundle e no source map, para simbolizar o Hermes. As opções do
 * SDK ficam no código (src/app/observability), sem sentry.options.json.
 */
const defaultConfig = getSentryExpoConfig(__dirname, {
  optionsFile: false,
  enableSourceContextInDevelopment: false,
});

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Native build outputs (also inside node_modules packages) churn during
    // Gradle/Xcode builds; watching them stalls Metro.
    blockList: [
      ...[defaultConfig.resolver.blockList ?? []].flat(),
      /[\\/]android[\\/](app[\\/])?build[\\/].*/,
      /[\\/]android[\\/]\.cxx[\\/].*/,
      /[\\/]ios[\\/]build[\\/].*/,
      /[\\/]\.claude[\\/]worktrees[\\/].*/,
    ],
  },
  transformer: {
    minifierConfig: {
      mangle: {
        keep_fnames: true,
      },
      output: {
        ascii_only: true,
        quote_style: 3,
        wrap_iife: true,
      },
      sourceMap: {
        includeSources: false,
      },
      toplevel: false,
      compress: {
        reduce_funcs: false,
      },
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
