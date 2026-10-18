import { createAppServices } from './composition/createAppServices';

/**
 * Uma instância por runtime JS. A tela e a verificação de avisos em segundo
 * plano (tarefa sem tela, no mesmo runtime) compartilham sessão do portal,
 * identidade e cache.
 */
export const appServices = createAppServices();
