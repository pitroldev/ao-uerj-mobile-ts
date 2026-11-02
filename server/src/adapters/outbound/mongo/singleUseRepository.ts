import type { SingleUse } from '../../../modules/access/ports.ts';
import { guarded, isDuplicateKey } from './guarded.ts';
import type { Models } from './models.ts';

/**
 * O que só vale uma vez (os tokens gastos, os desafios de emissão usados).
 * O `_id` é o hash: um segundo uso perde na inserção, sem consulta antes e
 * sem corrida entre duas requisições.
 */
export function createSingleUseRepository(
  // os dois modelos (spentTokens e usedChallenges) têm o mesmo esquema
  model: Models['spentTokens'],
): SingleUse {
  return {
    spend: (id, until) =>
      guarded(async () => {
        try {
          await model.create({ _id: id, expiresAt: until });
          return true;
        } catch (err) {
          if (isDuplicateKey(err)) return false;
          throw err;
        }
      }),
  };
}
