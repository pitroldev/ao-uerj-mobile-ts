import { ranksBefore, type Placing } from './ranking.ts';

/** Uma grade no placar: a posição, o número de disciplinas e a identidade. */
export type Standing<T> = Placing & {
  count: number;
  identity: string;
  value: T;
};

/**
 * As melhores grades até aqui, no máximo `limit`, sem repetir a mesma grade.
 *
 * Mais disciplinas sempre vem primeiro na ordem, então o placar cheio diz
 * quantas uma grade precisa ter para ainda entrar (`floor`): com menos, ela
 * perde para todas as que estão nele.
 */
export function createLeaderboard<T>(limit: number) {
  const standings: Standing<T>[] = [];
  const last = () =>
    standings.length === limit ? standings[limit - 1] : undefined;

  return {
    floor: () => last()?.count ?? 0,
    admits(placing: Placing): boolean {
      const threshold = last();
      return !threshold || ranksBefore(placing, threshold);
    },
    /**
     * Põe a grade no lugar dela. A mesma grade que já está no placar fica: ela
     * tem o mesmo placar e foi encontrada antes.
     */
    add(standing: Standing<T>): void {
      if (standings.some(entry => entry.identity === standing.identity)) return;
      const at = standings.findIndex(entry => ranksBefore(standing, entry));
      standings.splice(at === -1 ? standings.length : at, 0, standing);
      if (standings.length > limit) standings.pop();
    },
    standings: (): readonly Standing<T>[] => standings,
  };
}
