// Same as @react-native/jest-preset's environment, but built on the project's
// jest-environment-node (Jest 30) instead of the Jest 29 copy nested in the
// preset.
const NodeEnv = require('jest-environment-node').TestEnvironment;

module.exports = class ReactNativeEnv extends NodeEnv {
  customExportConditions = ['require', 'react-native'];
};
