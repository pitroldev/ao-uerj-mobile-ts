import type { CampusMapRepository } from '@root/modules/campus-map/application/ports';
import type { CampusAtlas } from '@root/modules/campus-map/domain/types';
import data from './atlas.json';

// Generated JSON contains tuples/enums; the generator and geometry tests check
// their shape and fidelity against the source atlas.
const atlas = data as unknown as CampusAtlas;
export const bundledCampusMap: CampusMapRepository = { read: () => atlas };
