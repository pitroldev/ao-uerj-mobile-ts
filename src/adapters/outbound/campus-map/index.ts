import type { CampusMapRepository } from '@root/modules/campus-map/application/ports';
import type { CampusAtlas } from '@root/modules/campus-map/domain/types';

let atlas: CampusAtlas | undefined;

/**
 * O atlas tem 636 KB (18 mil listas, 44 mil números) e só o Mapa, o Agora no
 * campus e a Companhia o leem. Com `import`, ele era montado na abertura do
 * app, para todo mundo; com `require` na primeira leitura, só para quem abre
 * uma dessas telas.
 *
 * Generated JSON contains tuples/enums; the generator and geometry tests check
 * their shape and fidelity against the source atlas.
 */
export const bundledCampusMap: CampusMapRepository = {
  read: () => (atlas ??= require('./atlas.json') as unknown as CampusAtlas),
};
