/*
 * Modo demonstração: adaptadores fictícios para QA e capturas de tela.
 *
 * Só é carregado em builds de desenvolvimento, por `loadDemoBackend()` em
 * src/app/composition/demoMode.ts, dentro de `if (__DEV__)`. O Metro remove
 * esse ramo (e, com ele, estes dados) do bundle de release.
 */
export {
  createDemoBackend,
  type DemoBackend,
  type DemoBackendOptions,
  type DemoPorts,
} from './createDemoBackend';
export {
  DEMO_PASSWORD,
  DEMO_SCENARIOS,
  demoCredentials,
  demoScenarioOf,
  isDemoScenario,
  type DemoScenario,
} from './credentials';
export { DEMO_STUDENT } from './data';
