// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // SDK 57's eslint-config-expo enables React Compiler lint rules that flag
      // long-standing data-loading/ref patterns across this codebase (they were
      // not errors before the SDK upgrade). Keep them visible as warnings so
      // they can be cleaned up incrementally instead of blocking the upgrade.
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
