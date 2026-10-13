const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

const defaultConfig = getDefaultConfig(__dirname);

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

// Debug ID no bundle e no source map, para o Sentry simbolizar o Hermes. As
// opções do SDK ficam no código (src/app/observability), sem sentry.options.json.
module.exports = withSentryConfig(mergeConfig(defaultConfig, config), {
  optionsFile: false,
  enableSourceContextInDevelopment: false,
});
