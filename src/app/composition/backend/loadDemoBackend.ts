import type { Backend } from './Backend';

type DemoModule = typeof import('@root/adapters/outbound/demo');

/**
 * O backend da conta de demonstração, carregado só quando ela entra: quem
 * usa a conta real não avalia os dados fictícios na abertura. O tipo de
 * retorno obriga a demo a responder o `Backend` inteiro.
 */
export function loadDemoBackend(): Backend {
  const { createDemoBackend } =
    require('@root/adapters/outbound/demo') as DemoModule;
  return createDemoBackend();
}
