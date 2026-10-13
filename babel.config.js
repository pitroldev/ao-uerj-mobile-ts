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
    // Must run first, on the untouched source (it skips node_modules).
    'babel-plugin-react-compiler',
    // parse5 and htmlparser2 ship ESM with `export * as ns`, which the RN
    // preset does not transform (Metro resolves their "import" builds).
    '@babel/plugin-transform-export-namespace-from',
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ts', '.tsx', '.jsx', '.js', '.json'],
        alias,
      },
    ],
    'react-native-worklets/plugin',
  ],
};
