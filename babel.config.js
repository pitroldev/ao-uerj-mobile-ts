const tsconfig = require('./tsconfig.json');

const { paths } = tsconfig.compilerOptions;
const alias = {};
Object.keys(paths).forEach(key => {
  const [value] = paths[key];
  const parsedKey = key.replace('/*', '');
  const parsedValue = value.replace('/*', '');
  alias[parsedKey] = parsedValue;
});

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ts', '.tsx', '.jsx', '.js', '.json'],
        alias,
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
