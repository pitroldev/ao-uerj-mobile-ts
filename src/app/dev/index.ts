import type { LinkingOptions } from '@react-navigation/native';
import type { RootDrawerParamList } from '@root/routes';

/**
 * Debug-only deep links (aouerj-dev://). Returns undefined in release builds:
 * Metro folds `__DEV__` to `false` and drops the require below.
 */
export function loadDevLinking():
  LinkingOptions<RootDrawerParamList> | undefined {
  if (__DEV__) {
    const dev = require('./devLinking') as typeof import('./devLinking');
    return dev.createDevLinking();
  }
  return undefined;
}
