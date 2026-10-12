import type { LinkingOptions } from '@react-navigation/native';
import type { RootDrawerParamList } from '@root/routes';
import type { AppServices } from '../composition/createAppServices';

/**
 * Debug-only deep links (aouerj-dev://). Returns undefined in release builds:
 * Metro folds `__DEV__` to `false` and drops the require below.
 */
export function loadDevLinking(
  services: AppServices,
): LinkingOptions<RootDrawerParamList> | undefined {
  if (__DEV__) {
    const dev = require('./devLinking') as typeof import('./devLinking');
    return dev.createDevLinking(services);
  }
  return undefined;
}
