import { createContext, useContext } from 'react';

import type { ErrorCode } from '@root/shared/errors/AppError';

/**
 * - `off`: a prioridade está desligada (nada é consultado);
 * - `checking`: conferindo o currículo, o histórico e o que já foi lido;
 * - `missing`: faltam pré-requisitos (a leitura não começou, parou ou não
 *   leu alguma página);
 * - `reading`: lendo, uma página da Pesquisa de Disciplinas por obrigatória;
 * - `ready`: tudo lido;
 * - `unavailable`: sem o currículo e o histórico, ou com o plano desativado.
 */
export type CriticalityStatus =
  'off' | 'checking' | 'missing' | 'reading' | 'ready' | 'unavailable';

export type Criticality = {
  status: CriticalityStatus;
  /** Páginas lidas nesta leitura e quantas faltavam no começo dela. */
  done: number;
  total: number;
  /** Obrigatórias que faltam sem os pré-requisitos lidos. */
  unread: number;
  /** Obrigatórias que faltam: as que entram na conta. */
  pending: number;
  /** Por que a leitura parou antes do fim (bloqueio, rede, sessão). */
  stoppedBy: ErrorCode | null;
  /** Com a internet e o Aluno Online no ar: dá para ler agora. */
  canRead: boolean;
  /** Lê os pré-requisitos que faltam (de novo, depois de uma parada). */
  read: () => void;
  /**
   * Para o pedido ao gerador: quantas obrigatórias que faltam cada disciplina
   * trava, direta ou indiretamente, com o que já foi lido. Sem a conta
   * (desligada, conferindo, indisponível), nada.
   */
  criticalityFor: (
    subjectIds: readonly string[],
  ) => Record<string, number> | undefined;
};

export const noCount = () => undefined;

export const OFF: Criticality = {
  status: 'off',
  done: 0,
  total: 0,
  unread: 0,
  pending: 0,
  stoppedBy: null,
  canRead: false,
  read: noCount,
  criticalityFor: noCount,
};

/**
 * Fica à parte do provedor (que traz o plano inteiro, com os serviços do
 * app): os passos leem a conta sem carregar nada disso.
 */
export const CriticalityContext = createContext<Criticality>(OFF);

/** O que o gerador sabe sobre as matérias que travam outras. */
export const useCriticality = () => useContext(CriticalityContext);
