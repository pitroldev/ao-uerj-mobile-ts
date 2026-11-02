import type { IssuanceCounter } from '../../../modules/access/ports.ts';
import { guarded, isDuplicateKey } from './guarded.ts';
import type { Models } from './models.ts';

/**
 * Os lotes por instalação e dia, contados numa operação só: o filtro só
 * acha o contador abaixo do limite, e no limite o upsert tenta criar outro
 * com o mesmo `_id` e perde na inserção. Esse mesmo erro aparece quando dois
 * pedidos criam o contador ao mesmo tempo; a segunda tentativa desempata.
 */
export function createIssuanceCounterRepository(
  model: Models['issuanceCounters'],
): IssuanceCounter {
  return {
    count: (id, limit, until) =>
      guarded(async () => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            await model.updateOne(
              { _id: id, count: { $lt: limit } },
              { $inc: { count: 1 }, $setOnInsert: { expiresAt: until } },
              { upsert: true },
            );
            return true;
          } catch (err) {
            if (!isDuplicateKey(err)) throw err;
          }
        }
        return false;
      }),
  };
}
